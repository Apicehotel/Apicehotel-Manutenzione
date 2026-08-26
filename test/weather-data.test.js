import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateOperationalWeather, HOTEL_WEATHER } from '../src/weather-data.js'

const base = (gusts, rainProb = [0, 0, 0], rain = [0, 0, 0]) => {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const times = [0, 1, 2].map((hours) => new Date(now.getTime() + hours * 3600000).toISOString().slice(0, 16))
  return { hourly: { time: times, wind_gusts_10m: gusts, wind_speed_10m: gusts.map((v) => Math.max(0, v - 10)), precipitation_probability: rainProb, precipitation: rain } }
}

test('configura tutte le strutture meteo', () => {
  assert.deepEqual(Object.keys(HOTEL_WEATHER).sort(), ['brigantino', 'chocohotel', 'hotelgio'])
})

test('raffiche forti generano allarme ombrelloni', () => {
  const result = evaluateOperationalWeather(base([20, 58, 30]))
  assert.equal(result.level, 'danger')
  assert.match(result.message, /Chiudere subito gli ombrelloni/)
})

test('pioggia prevista sospende irrigazione', () => {
  const result = evaluateOperationalWeather(base([10, 12, 15], [10, 70, 20], [0, 0.2, 0]))
  assert.equal(result.level, 'warning')
  assert.match(result.message, /Sospendere irrigazione/)
})

test('condizioni normali non richiedono azioni', () => {
  const result = evaluateOperationalWeather(base([10, 15, 18], [10, 20, 30], [0, 0, 0]))
  assert.equal(result.level, 'ok')
  assert.equal(result.message, 'Nessuna azione richiesta')
})
