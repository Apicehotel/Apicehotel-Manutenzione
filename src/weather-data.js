export const HOTEL_WEATHER = {
  hotelgio: { name: 'Hotel Giò', latitude: 43.112685, longitude: 12.37818 },
  chocohotel: { name: 'Chocohotel', latitude: 43.09932, longitude: 12.38469 },
  brigantino: { name: 'Hotel Il Brigantino', latitude: 43.46171, longitude: 13.62708 },
}

export const WEATHER_THRESHOLDS = {
  windWarning: 40,
  windDanger: 55,
  rainProbability: 60,
  rainAmount: 0.4,
}

const max = (values = []) => values.reduce((best, value) => Math.max(best, Number(value) || 0), 0)

export function evaluateOperationalWeather(payload) {
  const hourly = payload?.hourly || {}
  const now = Date.now()
  const indices = (hourly.time || [])
    .map((time, index) => ({ index, time: new Date(time).getTime() }))
    .filter((item) => item.time >= now - 30 * 60 * 1000 && item.time <= now + 2 * 60 * 60 * 1000)
    .map((item) => item.index)

  const pick = (key) => indices.map((index) => hourly[key]?.[index])
  const gust = max(pick('wind_gusts_10m'))
  const wind = max(pick('wind_speed_10m'))
  const rainProbability = max(pick('precipitation_probability'))
  const rainAmount = max(pick('precipitation'))

  let level = 'ok'
  const actions = []
  if (gust >= WEATHER_THRESHOLDS.windDanger) {
    level = 'danger'
    actions.push('Chiudere subito gli ombrelloni')
  } else if (gust >= WEATHER_THRESHOLDS.windWarning) {
    level = 'warning'
    actions.push('Controllare e chiudere gli ombrelloni')
  }
  if (rainProbability >= WEATHER_THRESHOLDS.rainProbability || rainAmount >= WEATHER_THRESHOLDS.rainAmount) {
    if (level === 'ok') level = 'warning'
    actions.push('Sospendere irrigazione')
  }

  return {
    level,
    gust: Math.round(gust),
    wind: Math.round(wind),
    rainProbability: Math.round(rainProbability),
    rainAmount: Math.round(rainAmount * 10) / 10,
    actions,
    message: actions.length ? actions.join(' · ') : 'Nessuna azione richiesta',
  }
}

export async function fetchOperationalWeather(hotelId, { signal } = {}) {
  const hotel = HOTEL_WEATHER[hotelId]
  if (!hotel) throw new Error('Posizione meteo non configurata')
  const params = new URLSearchParams({
    latitude: String(hotel.latitude),
    longitude: String(hotel.longitude),
    hourly: 'precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m',
    forecast_days: '2',
    timezone: 'Europe/Rome',
    wind_speed_unit: 'kmh',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Meteo non disponibile (${response.status})`)
  const payload = await response.json()
  return { hotel, ...evaluateOperationalWeather(payload), updatedAt: Date.now() }
}
