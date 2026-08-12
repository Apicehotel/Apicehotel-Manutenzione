import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const hotels = [
  { id: 'hotelgio', name: 'HotelGio' },
  { id: 'chocohotel', name: 'ChocoHotel' },
  { id: 'brigantino', name: 'Hotel Il Brigantino' },
]

function App() {
  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">APICEHOTEL</p>
        <h1>Manutenzione</h1>
        <p className="subtitle">Piattaforma multi-hotel per segnalazioni, interventi e tecnici.</p>
      </section>

      <section className="grid">
        {hotels.map((hotel) => (
          <button className="hotel-card" key={hotel.id}>
            <span className="hotel-icon">🏨</span>
            <span>
              <strong>{hotel.name}</strong>
              <small>Apri struttura</small>
            </span>
          </button>
        ))}
      </section>

      <footer>Nuova piattaforma · dati separati per struttura</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
