import { supabase } from './supabase.js'

// Chiave pubblica VAPID: per protocollo è pensata per essere distribuita al
// client (serve al browser per generare l'abbonamento push), a differenza
// della chiave privata che resta solo lato server (edge function send-push).
const VAPID_PUBLIC_KEY = 'BJXvALpVtVoEJ4Kuc0AydxwS27BiC43JrMNY0eycS3Ih-75GPbVUfL5B5hs7jCRlWDaAkidMOndZUiZ0Norjxlk'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushSubscriptionState() {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  return existing ? 'subscribed' : 'not-subscribed'
}

export async function subscribeToPush(hotelId) {
  if (!isPushSupported()) throw new Error('Le notifiche push non sono supportate su questo dispositivo/browser')
  if (!supabase) throw new Error('Supabase non configurato')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permesso notifiche non concesso')
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const { data, error } = await supabase.functions.invoke('push-subscribe', {
    body: { hotel_id: hotelId, subscription: subscription.toJSON() },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (data?.enabled === false) throw new Error('Notifiche non attive sul server')
  return true
}

export async function unsubscribeFromPush(hotelId) {
  if (!isPushSupported() || !supabase) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true
  await supabase.functions.invoke('push-subscribe', {
    body: { hotel_id: hotelId, action: 'unsubscribe', subscription: subscription.toJSON() },
  }).catch(() => {})
  await subscription.unsubscribe()
  return true
}
