import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

const hotelSwitcher = `function HotelSwitcher({ user, currentHotel, onSelect, onCancel }) {\n  const allowedHotels = HOTELS.filter((hotel) => !Array.isArray(user.hotels) || user.hotels.includes(hotel.id))\n  const switchLogo = (hotelId) => hotelId === 'hotelgio' ? '/logos/randapp-hotelgio.webp' : hotelId === 'chocohotel' ? '/logos/randapp-chocohotel.webp' : '/logos/randapp-brigantino.webp'\n  return <div className="page login-page"><button className="back-link" onClick={onCancel}>‹ Torna a {currentHotel?.name || 'struttura'}</button><main className="login-panel"><h1>Cambia struttura</h1><p>Scegli una delle strutture abilitate per {user.name}. Non serve reinserire il PIN.</p><div style={{display:'grid',gap:10,marginTop:16}}>{allowedHotels.map((hotel)=><button type="button" className="secondary" key={hotel.id} disabled={hotel.id===currentHotel?.id} onClick={()=>onSelect(hotel)} style={{display:'flex',alignItems:'center',gap:14,justifyContent:'flex-start',padding:14,textAlign:'left'}}><img src={switchLogo(hotel.id)} alt={\`Logo \${hotel.name}\`} width="82" height="82" style={{width:82,height:82,objectFit:'contain',borderRadius:18,flex:'0 0 auto'}}/><span><strong style={{display:'block'}}>{hotel.name}</strong><small>{hotel.id===currentHotel?.id?'Struttura attuale':'Tocca per aprire'}</small></span></button>)}</div></main></div>\n}\n\n`

const appMarker = 'export default function App() {'
if (!source.includes(appMarker)) throw new Error('App marker non trovato')
if (source.includes('function HotelSwitcher(')) {
  source = source.replace(/function HotelSwitcher\([\s\S]*?(?=export default function App\(\) \{)/u, hotelSwitcher)
} else {
  source = source.replace(appMarker, hotelSwitcher + appMarker)
}

const stateOld = "  const [sessionChecked, setSessionChecked] = useState(false)\n  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === loadSession()?.hotelId) || null)"
const stateNew = "  const [sessionChecked, setSessionChecked] = useState(false)\n  const [switchingHotel, setSwitchingHotel] = useState(false)\n  const [selectedHotel, setSelectedHotel] = useState(() => HOTELS.find((hotel) => hotel.id === loadSession()?.hotelId) || null)"
if (!source.includes(stateOld) && !source.includes('const [switchingHotel, setSwitchingHotel]')) throw new Error('Blocco stato sessione non trovato')
source = source.replace(stateOld, stateNew)

const funcsOld = "  const logout = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }\n  const changeHotel = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }\n  const backFromLogin = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setUsers([]) }"
const funcsNew = `  const logout = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setSwitchingHotel(false); setUsers([]) }\n  const changeHotel = () => { setSwitchingHotel(true) }\n  const switchHotel = async (nextHotel) => {\n    if (!session || !user || !nextHotel) return\n    if (Array.isArray(user.hotels) && !user.hotels.includes(nextHotel.id)) return\n    if (nextHotel.id === session.hotelId) { setSwitchingHotel(false); return }\n    setUsersLoading(true)\n    try {\n      const { users: rows } = await fetchDirectory(nextHotel.id)\n      const currentUser = user\n      setUsers([currentUser, ...rows.filter((item) => item.id !== currentUser.id && item.auth_user_id !== session.userId)])\n      const next = { ...session, hotelId: nextHotel.id }\n      saveSession(next)\n      setSelectedHotel(nextHotel)\n      setSession(next)\n      setSwitchingHotel(false)\n    } finally { setUsersLoading(false) }\n  }\n  const backFromLogin = async () => { await signOutSupabase(); clearSession(); setSession(null); setSelectedHotel(null); setSwitchingHotel(false); setUsers([]) }`
if (!source.includes(funcsOld) && !source.includes('const switchHotel = async')) throw new Error('Blocco logout/changeHotel non trovato')
source = source.replace(funcsOld, funcsNew)

const renderOld = "  if (!sessionChecked) return <div className=\"page login-page\"><main className=\"login-panel\"><p>Verifica sessione…</p></main></div>\n  if (session && hotel && user && (!Array.isArray(user.hotels) || user.hotels.includes(hotel.id))) return <Operations hotel={hotel} user={user} users={users} onLogout={logout} onChangeHotel={changeHotel} onSavePin={updateCurrentUserPin} onSaveProfile={updateCurrentUserProfile} onTogglePresence={updateCurrentUserPresence} uiSize={uiSize} onUiSizeChange={setUiSize} />"
const renderNew = "  if (!sessionChecked) return <div className=\"page login-page\"><main className=\"login-panel\"><p>Verifica sessione…</p></main></div>\n  if (switchingHotel && session && hotel && user) return <HotelSwitcher user={user} currentHotel={hotel} onSelect={switchHotel} onCancel={() => setSwitchingHotel(false)} />\n  if (session && hotel && user && (!Array.isArray(user.hotels) || user.hotels.includes(hotel.id))) return <Operations hotel={hotel} user={user} users={users} onLogout={logout} onChangeHotel={changeHotel} onSavePin={updateCurrentUserPin} onSaveProfile={updateCurrentUserProfile} onTogglePresence={updateCurrentUserPresence} uiSize={uiSize} onUiSizeChange={setUiSize} />"
if (!source.includes(renderOld) && !source.includes('<HotelSwitcher user={user}')) throw new Error('Blocco render sessione non trovato')
source = source.replace(renderOld, renderNew)

fs.writeFileSync(path, source)
console.log('Hotel switch patch applicata a src/App.jsx')
