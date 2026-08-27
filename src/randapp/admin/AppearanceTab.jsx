import { Card, ThemeControl, UiSizeControl } from '../ui.jsx'

export default function AppearanceTab(){
  return <section data-testid="settings-appearance"><div className="rs-page-title"><div><h1>Aspetto</h1><p>Tema e dimensione interfaccia</p></div></div><Card className="rs-card--pad" style={{marginBottom:12}}><div className="rs-uisize-block"><strong>Tema</strong><ThemeControl/></div></Card><Card className="rs-card--pad"><div className="rs-uisize-block"><strong>Dimensione interfaccia</strong><UiSizeControl/></div></Card></section>
}
