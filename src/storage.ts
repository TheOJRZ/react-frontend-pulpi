import type { User } from './types'

const SESSION_KEY = 'pulpi:v2:session'
const LEGACY_SESSION_KEY = 'pulpi:v1:session'

/** Solo conserva los metadatos de sesión y el JWT; los datos financieros viven en la API. */
export function saveSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  localStorage.removeItem(LEGACY_SESSION_KEY)
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_SESSION_KEY)
}

export function loadSessionUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      // La sesión de la versión anterior era solo un nombre de usuario y no contiene un JWT.
      localStorage.removeItem(LEGACY_SESSION_KEY)
      return null
    }
    const user = JSON.parse(raw) as User
    if (!user || typeof user.id !== 'string' || typeof user.username !== 'string' || !user.token) return null
    return user
  } catch {
    clearSession()
    return null
  }
}

export function getAuthToken(): string | null {
  return loadSessionUser()?.token ?? null
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string): string {
  if (!date) return '—'
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}
