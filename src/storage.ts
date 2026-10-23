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

const NICARAGUA_TIME_ZONE = 'America/Managua'

export function localDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NICARAGUA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
}

export function formatDate(date: string): string {
  if (!date) return '—'

  const dateOnly = date.slice(0, 10)
  const parsed = new Date(`${dateOnly}T12:00:00Z`)

  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat('es-NI', {
    timeZone: NICARAGUA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

export function formatDateTime(value: string): string {
  if (!value) return '—'

  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const normalizedValue = hasTimeZone ? value : `${value}Z`
  const parsed = new Date(normalizedValue)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('es-NI', {
    timeZone: NICARAGUA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parsed)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}


