import { supabase } from '../../supabase.js'

const PASSWORD_RE=/^[A-Za-z0-9]{6,12}$/
const USERNAME_RE=/^[A-Za-z0-9._-]{3,32}$/

async function invoke(body){
  if(!supabase) throw new Error('Supabase non configurato')
  const {data,error}=await supabase.functions.invoke('randai-auth',{body})
  if(error) throw error
  if(data?.error) throw new Error(data.error)
  return data
}

export function isValidRandAIPassword(value){return PASSWORD_RE.test(String(value||''))}
export function isValidRandAIUsername(value){return USERNAME_RE.test(String(value||''))}

export async function loginRandAI(username,password){
  if(!isValidRandAIUsername(username)||!isValidRandAIPassword(password)) throw new Error('Credenziali non valide')
  const data=await invoke({action:'login',username:String(username).trim(),password:String(password)})
  const session=data?.session
  if(!session?.access_token||!session?.refresh_token) throw new Error('Sessione RandAI non disponibile')
  const {error}=await supabase.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})
  if(error) throw error
  return data.user
}

export async function listRandAIUsers(){const data=await invoke({action:'list_users'});return data?.users||[]}
export async function createRandAIUser({name,username,password,hotels}){return invoke({action:'create_user',name,username,password,hotels})}
export async function changeRandAIPassword(password){if(!isValidRandAIPassword(password))throw new Error('La password deve essere alfanumerica e lunga da 6 a 12 caratteri');return invoke({action:'change_password',password})}
export async function signOutRandAI(){if(supabase)await supabase.auth.signOut()}
