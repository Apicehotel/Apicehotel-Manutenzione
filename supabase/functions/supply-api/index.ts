import postgres from "npm:postgres@3.4.7";

const API_URL = Deno.env.get("SUPABASE_URL")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

function namedKey(envName:string, legacyName:string){
  const raw=Deno.env.get(envName);
  if(raw){
    try{
      const parsed=JSON.parse(raw);
      return String(parsed?.default || Object.values(parsed || {})[0] || "");
    }catch{}
  }
  return Deno.env.get(legacyName) || "";
}

const PUBLIC_KEY = namedKey("SUPABASE_PUBLISHABLE_KEYS","SUPABASE_ANON_KEY");
const sql = postgres(DB_URL,{prepare:false,max:3,connect_timeout:5,idle_timeout:10});

const cors = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}
});

function text(value:unknown){ return String(value ?? "").trim() }
function boundedLimit(value:unknown){ const n=Number(value); return Number.isFinite(n)?Math.max(1,Math.min(100,Math.trunc(n))):40 }

async function authenticatedUser(req:Request){
  const authorization=req.headers.get("authorization") || "";
  const token=authorization.replace(/^Bearer\s+/i,"").trim();
  if(!token) return null;
  const response=await fetch(`${API_URL}/auth/v1/user`,{
    headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`,Accept:"application/json"}
  });
  if(!response.ok) return null;
  const user=await response.json().catch(()=>null);
  return user?.id ? { id:String(user.id) } : null;
}

async function membership(userId:string,hotelId:string){
  const rows=await sql`
    select role,active,can_access_admin
    from public.hotel_memberships
    where auth_user_id=${userId}::uuid and hotel_id=${hotelId}
    limit 1
  `;
  return rows[0] || null;
}

async function can(userId:string,hotelId:string,module:string,action:string){
  const member:any=await membership(userId,hotelId);
  if(!member?.active) return false;
  if(member.role==="admin") return true;
  const rows=await sql`
    select allowed
    from public.role_permissions
    where role=${member.role} and module=${module} and action=${action}
    limit 1
  `;
  return rows[0]?.allowed===true;
}

async function requirePermission(userId:string,hotelId:string,action:string){
  if(!await can(userId,hotelId,"supplies",action)) throw new Error("PERMISSION_DENIED");
}

async function listProducts(userId:string,hotelId:string,includeInactive:boolean){
  await requirePermission(userId,hotelId,"view");
  if(includeInactive) await requirePermission(userId,hotelId,"manage");
  return includeInactive
    ? await sql`select id,hotel_id,category,name,active,sort_order,created_at,updated_at
                from public.supply_products where hotel_id=${hotelId}
                order by category,sort_order,name`
    : await sql`select id,hotel_id,category,name,active,sort_order,created_at,updated_at
                from public.supply_products where hotel_id=${hotelId} and active=true
                order by category,sort_order,name`;
}

async function listRequests(userId:string,hotelId:string,limit:number){
  await requirePermission(userId,hotelId,"view");
  const requests=await sql`
    select id,hotel_id,requested_by_name,note,area_code,area_label,floor_number,floor_label,created_at,completed_at
    from public.supply_requests
    where hotel_id=${hotelId}
    order by created_at desc
    limit ${limit}
  `;
  if(!requests.length) return [];
  const ids=requests.map((r:any)=>String(r.id));
  const items=await sql`
    select id,request_id,product_id,product_name,category,status,resolved_by_name,resolved_at
    from public.supply_request_items
    where request_id = any(${ids}::uuid[])
    order by category,product_name
  `;
  const byRequest=new Map<string,any[]>();
  for(const item of items){
    const key=String(item.request_id);
    const list=byRequest.get(key) || [];
    list.push(item);
    byRequest.set(key,list);
  }
  return requests.map((request:any)=>({...request,supply_request_items:byRequest.get(String(request.id)) || []}));
}

async function floorContexts(userId:string,hotelId:string){
  const allowed = await can(userId,hotelId,"supplies","view") || await can(userId,hotelId,"housekeeping","view");
  if(!allowed) throw new Error("PERMISSION_DENIED");
  return await sql`
    select area_code,area_label,floor_number,floor_label,sort_order
    from public.hotel_floor_contexts
    where hotel_id=${hotelId} and active=true
    order by sort_order,area_label,floor_number
  `;
}

async function saveProduct(userId:string,body:any){
  const hotelId=text(body.hotel_id);
  await requirePermission(userId,hotelId,"manage");
  const name=text(body.name);
  const category=text(body.category);
  const active=body.active!==false;
  const sortOrder=Number.isFinite(Number(body.sort_order))?Number(body.sort_order):0;
  if(!name || name.length>120) throw new Error("PRODUCT_NAME_INVALID");
  if(!["minibar","consumo"].includes(category)) throw new Error("PRODUCT_CATEGORY_INVALID");
  if(body.id){
    const rows=await sql`
      update public.supply_products
      set name=${name},category=${category},active=${active},sort_order=${sortOrder},updated_at=now()
      where id=${String(body.id)}::uuid and hotel_id=${hotelId}
      returning id
    `;
    if(!rows.length) throw new Error("PRODUCT_NOT_FOUND");
    return rows[0].id;
  }
  const rows=await sql`
    insert into public.supply_products(hotel_id,category,name,active,sort_order,created_by)
    values(${hotelId},${category},${name},${active},${sortOrder},${userId}::uuid)
    returning id
  `;
  return rows[0].id;
}

async function deleteProduct(userId:string,hotelId:string,id:string){
  await requirePermission(userId,hotelId,"manage");
  const rows=await sql`
    delete from public.supply_products
    where hotel_id=${hotelId} and id=${id}::uuid
    returning id
  `;
  if(!rows.length) throw new Error("PRODUCT_NOT_FOUND");
}

async function createRequest(userId:string,body:any){
  const hotelId=text(body.hotel_id);
  await requirePermission(userId,hotelId,"create");
  const productIds=Array.from(new Set((Array.isArray(body.product_ids)?body.product_ids:[]).map(String).filter(Boolean)));
  if(!productIds.length) throw new Error("SUPPLY_PRODUCTS_REQUIRED");

  const member:any=await membership(userId,hotelId);
  const profileRows=await sql`select display_name,phone from public.profiles where auth_user_id=${userId}::uuid limit 1`;
  const profile:any=profileRows[0] || {};
  if(["Governante","Capo Governante"].includes(String(member?.role)) && !text(profile.phone)) throw new Error("PHONE_REQUIRED");

  let floor:any=null;
  const areaCode=body.area_code==null?null:text(body.area_code).toLowerCase();
  const floorNumber=body.floor_number==null?null:Number(body.floor_number);
  const configured=await sql`select 1 from public.hotel_floor_contexts where hotel_id=${hotelId} and active=true limit 1`;
  if(areaCode!==null || floorNumber!==null){
    if(!areaCode || !Number.isFinite(floorNumber)) throw new Error("SUPPLY_FLOOR_CONTEXT_INCOMPLETE");
    const rows=await sql`
      select area_code,area_label,floor_number,floor_label
      from public.hotel_floor_contexts
      where hotel_id=${hotelId} and active=true and area_code=${areaCode} and floor_number=${floorNumber}
      limit 1
    `;
    floor=rows[0] || null;
    if(!floor) throw new Error("SUPPLY_FLOOR_CONTEXT_INVALID");
  }else if(configured.length){
    throw new Error("SUPPLY_FLOOR_CONTEXT_REQUIRED");
  }

  return await sql.begin(async(tx)=>{
    const products=await tx`
      select id,name,category
      from public.supply_products
      where hotel_id=${hotelId} and active=true and id = any(${productIds}::uuid[])
    `;
    if(products.length!==productIds.length) throw new Error("SUPPLY_PRODUCT_INVALID");
    const requestRows=await tx`
      insert into public.supply_requests(
        hotel_id,requested_by,requested_by_name,note,area_code,area_label,floor_number,floor_label
      ) values(
        ${hotelId},${userId}::uuid,${text(profile.display_name)||"Governante"},${text(body.note)||null},
        ${floor?.area_code||null},${floor?.area_label||null},${floor?.floor_number??null},${floor?.floor_label||null}
      )
      returning id
    `;
    const requestId=String(requestRows[0].id);
    for(const product of products){
      await tx`
        insert into public.supply_request_items(hotel_id,request_id,product_id,product_name,category)
        values(${hotelId},${requestId}::uuid,${product.id}::uuid,${product.name},${product.category})
      `;
    }
    return requestId;
  });
}

async function resolveItem(userId:string,body:any){
  const id=text(body.item_id);
  const status=text(body.status);
  if(!["delivered","missing"].includes(status)) throw new Error("SUPPLY_STATUS_INVALID");
  await sql.begin(async(tx)=>{
    const rows=await tx`
      select hotel_id,request_id
      from public.supply_request_items
      where id=${id}::uuid
      for update
    `;
    const item:any=rows[0];
    if(!item) throw new Error("SUPPLY_ITEM_NOT_FOUND");
    if(!await can(userId,String(item.hotel_id),"supplies","complete")) throw new Error("PERMISSION_DENIED");
    const profileRows=await tx`select display_name from public.profiles where auth_user_id=${userId}::uuid limit 1`;
    const displayName=text(profileRows[0]?.display_name) || "Manutentore";
    await tx`
      update public.supply_request_items
      set status=${status},resolved_by=${userId}::uuid,resolved_by_name=${displayName},resolved_at=now()
      where id=${id}::uuid
    `;
    await tx`
      update public.supply_requests r
      set completed_at=case
        when not exists(select 1 from public.supply_request_items i where i.request_id=${String(item.request_id)}::uuid and i.status='pending')
          then coalesce(r.completed_at,now())
        else null
      end
      where r.id=${String(item.request_id)}::uuid
    `;
  });
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const user=await authenticatedUser(req);
    if(!user) return reply({ok:false,error:"AUTH_REQUIRED"},401);
    const body=await req.json().catch(()=>({}));
    const action=text(body.action);
    const hotelId=text(body.hotel_id);

    if(action==="list-products") return reply({ok:true,data:await listProducts(user.id,hotelId,Boolean(body.include_inactive))});
    if(action==="list-requests") return reply({ok:true,data:await listRequests(user.id,hotelId,boundedLimit(body.limit))});
    if(action==="floor-contexts") return reply({ok:true,data:await floorContexts(user.id,hotelId)});
    if(action==="save-product") return reply({ok:true,id:await saveProduct(user.id,body)});
    if(action==="delete-product"){ await deleteProduct(user.id,hotelId,text(body.id)); return reply({ok:true}); }
    if(action==="create-request") return reply({ok:true,id:await createRequest(user.id,body)});
    if(action==="resolve-item"){ await resolveItem(user.id,body); return reply({ok:true}); }
    return reply({ok:false,error:"ACTION_NOT_SUPPORTED"},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error||"UNKNOWN");
    const status=message==="PERMISSION_DENIED"?403:
      message==="AUTH_REQUIRED"?401:
      /REQUIRED|INVALID|NOT_FOUND|PHONE_REQUIRED/.test(message)?400:500;
    console.error("supply-api",message);
    return reply({ok:false,error:message},status);
  }
});