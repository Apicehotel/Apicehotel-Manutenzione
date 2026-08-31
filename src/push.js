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

export function getPushSupportInfo() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { supported: false, platform: 'server', standalone: false, requiresHomeScreen: false }
  const ua = navigator.userAgent || ''
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true)
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return { supported, platform: ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop', standalone, requiresHomeScreen: ios && !standalone }
}

export function isPushSupported() {
  return getPushSupportInfo().supported
}

async function ensureRegistration() {
  if (!isPushSupported()) throw new Error('Le notifiche push non sono supportate su questo dispositivo/browser')
  let registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return registration
}

async function invokePushSubscribe(body) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('push-subscribe', { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  if (data?.enabled === false) throw new Error('Notifiche non attive sul server')
  return data || {}
}

export async function getPushSubscriptionState() {
  const info = getPushSupportInfo()
  if (!info.supported || info.requiresHomeScreen) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'not-subscribed'
  try {
    const registration = await ensureRegistration()
    const existing = await registration.pushManager.getSubscription()
    if (!existing) return 'not-subscribed'
    if (!supabase) return 'subscribed'
    const data = await invokePushSubscribe({ action: 'status', subscription: existing.toJSON() })
    return data.subscribed ? 'subscribed' : 'not-subscribed'
  } catch {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      return await registration?.pushManager.getSubscription() ? 'subscribed' : 'not-subscribed'
    } catch { return 'not-subscribed' }
  }
}

export async function subscribeToPush() {
  const info = getPushSupportInfo()
  if (!info.supported) throw new Error('Le notifiche push non sono supportate su questo dispositivo/browser')
  if (info.requiresHomeScreen) throw new Error('Su iPhone/iPad aggiungi prima RandApp alla schermata Home, poi aprila da lì per attivare le notifiche')
  if (!supabase) throw new Error('Supabase non configurato')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permesso notifiche non concesso')
  const registration = await ensureRegistration()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  await invokePushSubscribe({ subscription: subscription.toJSON() })
  return true
}

// Riallinea il dispositivo dell'utente con tutte le strutture per cui possiede
// una membership attiva. L'utente non deve riattivare le push cambiando hotel.
export async function repairPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  const registration = await ensureRegistration()
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return false
  await invokePushSubscribe({ subscription: subscription.toJSON() })
  return true
}

export async function unsubscribeFromPush() {
  if (!isPushSupported() || !supabase) return false
  const registration = await ensureRegistration()
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  await invokePushSubscribe({ action: 'unsubscribe', subscription: subscription.toJSON() })
  await subscription.unsubscribe()
  return true
}
