import { getAuthToken } from './storage'

import type {
  AuditAction,
  BalanceSummary,
  CashSession,
  Category,
  CategoryInput,
  ReportSummary,
  Transaction,
  TransactionInput,
  User,
  UserRole
} from './types'

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:5266/api'
).replace(/\/$/, '')

type JsonRecord = Record<string, unknown>

interface AuthResponse {
  id: number
  token: string
  username: string
  email: string
  nombreCompleto: string
  rol: string
  fechaRegistro: string
}

function asRecord(value: unknown): JsonRecord {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value as JsonRecord
      : {}
}

function asString(
  value: unknown,
  fallback = ''
): string {
  return typeof value === 'string'
    ? value
    : value == null
      ? fallback
      : String(value)
}

function asNumber(
  value: unknown,
  fallback = 0
): number {
  const result = Number(value)

  return Number.isFinite(result)
    ? result
    : fallback
}

function asBoolean(
  value: unknown,
  fallback = false
): boolean {
  return typeof value === 'boolean'
    ? value
    : fallback
}

function mapType(
  value: unknown
): 'income' | 'expense' {
  const normalized = asString(value).toLowerCase()

  return normalized === 'ingreso' ||
    normalized === 'income'
      ? 'income'
      : 'expense'
}

function mapUser(
  value: unknown,
  token?: string
): User {
  const dto = asRecord(value)

  const rawRole = asString(
    dto.rol ?? dto.role ?? dto.nombreRol,
    'Cajero'
  )

  return {
    id: asString(dto.id),
    username: asString(dto.username),
    email: asString(dto.email),

    fullName: asString(
      dto.nombreCompleto ?? dto.fullName
    ),

    role: rawRole === 'Administrador'
      ? 'Administrador'
      : 'Cajero',

    createdAt: asString(
      dto.fechaRegistro ?? dto.createdAt,
      new Date().toISOString()
    ),

    active: asBoolean(
      dto.activo ?? dto.active,
      true
    ),

    ...(token ? { token } : {})
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        headers,

        // Permite recibir y enviar la cookie de autenticación.
        credentials: 'include'
      }
    )
  } catch {
    throw new Error(
      `No se pudo conectar con la API (${API_BASE_URL}). ` +
      'Comprueba que el backend esté ejecutándose y que VITE_API_URL sea correcta.'
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType =
    response.headers.get('content-type') || ''

  const body: unknown = contentType.includes('json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const payload = asRecord(body)
    const errors = asRecord(payload.errors)

    const validationMessages = Object
      .values(errors)
      .flatMap((entry) =>
        Array.isArray(entry)
          ? entry.map(String)
          : [String(entry)]
      )
      .filter(Boolean)

    const message =
      asString(payload.message || payload.detail) ||
      validationMessages.join(' ') ||
      asString(payload.title) ||
      (typeof body === 'string' ? body : '')

    if (response.status === 401 && token) {
      window.dispatchEvent(
        new Event('pulpi:unauthorized')
      )

      throw new Error(
        'Tu sesión ya no es válida. Inicia sesión nuevamente.'
      )
    }

    if (response.status === 403) {
      throw new Error(
        message ||
        'Tu rol no tiene permisos para realizar esta acción.'
      )
    }

    if (response.status === 401) {
      throw new Error(
        message || 'Usuario o contraseña incorrectos.'
      )
    }

    throw new Error(
      message ||
      `La API respondió con el estado HTTP ${response.status}.`
    )
  }

  return body as T
}

function mapCategory(value: unknown): Category {
  const dto = asRecord(value)

  return {
    id: asString(dto.idCategoria ?? dto.id),

    name: asString(
      dto.nombre ?? dto.name
    ),

    type: mapType(
      dto.tipo ?? dto.type
    ),

    description: asString(
      dto.descripcion ?? dto.description
    ),

    active: asBoolean(
      dto.activa ?? dto.active,
      true
    ),

    createdAt: asString(
      dto.fechaCreacion ?? dto.createdAt,
      new Date().toISOString()
    )
  }
}

function mapTransaction(
  value: unknown
): Transaction {
  const dto = asRecord(value)

  const rawDate = asString(
    dto.fechaMovimiento ??
    dto.fecha ??
    dto.date,
    new Date().toISOString()
  )

  return {
    id: asString(
      dto.idTransaccion ?? dto.id
    ),

    categoryId: asString(
      dto.categoriaId ?? dto.idCategoria
    ),

    type: mapType(
      dto.tipo ?? dto.type
    ),

    description: asString(
      dto.concepto ?? dto.description
    ),

    category: asString(
      dto.categoria ??
      dto.nombreCategoria ??
      dto.category,
      'General'
    ),

    amount: asNumber(
      dto.monto ?? dto.amount
    ),

    date: rawDate.slice(0, 10),

    paymentMethod: asString(
      dto.metodoPago ?? dto.paymentMethod,
      'Efectivo'
    ),

    createdAt: asString(
      dto.fechaRegistro ?? dto.createdAt,
      rawDate
    ),

    recordedBy: dto.idUsuarioRegistro == null
      ? undefined
      : asString(dto.idUsuarioRegistro),

    recordedByName: asString(
      dto.nombreUsuario ?? dto.recordedByName
    ),

    sessionId: dto.idSesionCaja == null
      ? undefined
      : asString(dto.idSesionCaja),

    state: asString(
      dto.estado,
      'REGISTRADA'
    ) === 'ANULADA'
      ? 'ANULADA'
      : 'REGISTRADA'
  }
}

function mapSession(value: unknown): CashSession {
  const dto = asRecord(value)

  return {
    id: asString(
      dto.idSesionCaja ?? dto.id
    ),

    openerUserId: asString(
      dto.idUsuarioApertura ?? dto.openerUserId
    ),

    openerName: asString(
      dto.usuarioApertura ?? dto.openerName
    ),

    openedAt: asString(
      dto.fechaHoraApertura ?? dto.openedAt
    ),

    initialBalance: asNumber(
      dto.saldoInicial ?? dto.initialBalance
    ),

    currentBalance: dto.saldoActual == null
      ? undefined
      : asNumber(dto.saldoActual),

    closerUserId: dto.idUsuarioCierre == null
      ? undefined
      : asString(dto.idUsuarioCierre),

    closerName: asString(
      dto.usuarioCierre ?? dto.closerName
    ),

    closedAt: dto.fechaHoraCierre == null
      ? undefined
      : asString(dto.fechaHoraCierre),

    expectedBalance: dto.saldoEsperado == null
      ? undefined
      : asNumber(dto.saldoEsperado),

    declaredBalance: dto.saldoDeclarado == null
      ? undefined
      : asNumber(dto.saldoDeclarado),

    status: asString(
      dto.estado,
      'ABIERTA'
    ) === 'CERRADA'
      ? 'CERRADA'
      : 'ABIERTA',

    observations: asString(
      dto.observaciones
    )
  }
}

function mapAudit(value: unknown): AuditAction {
  const dto = asRecord(value)

  return {
    id: asString(
      dto.idAuditoria ?? dto.id
    ),

    entity: asString(dto.entidad),

    recordId: dto.idRegistro == null
      ? undefined
      : asString(dto.idRegistro),

    action: asString(dto.accion),
    timestamp: asString(dto.fechaHora),
    oldData: asString(dto.datosAnteriores),
    newData: asString(dto.datosNuevos),
    reason: asString(dto.motivo),
    userName: asString(dto.nombreUsuario),
    username: asString(dto.username)
  }
}

function mapBalance(
  value: unknown
): BalanceSummary {
  const dto = asRecord(value)

  return {
    totalIncome: asNumber(dto.totalIngresos),
    totalExpenses: asNumber(dto.totalGastos),
    netBalance: asNumber(dto.balanceNeto),
    totalTransactions: asNumber(dto.totalTransacciones)
  }
}

export async function login(
  username: string,
  password: string
): Promise<User> {
  const response = await request<AuthResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password
      })
    }
  )

  return mapUser(response, response.token)
}

export async function logout(): Promise<void> {
  await request<void>(
    '/auth/logout',
    {
      method: 'POST'
    }
  )
}

export async function register(input: {
  fullName: string
  username: string
  email: string
  password: string
  confirmPassword: string
}): Promise<User> {
  const response = await request<AuthResponse>(
    '/auth/registro',
    {
      method: 'POST',
      body: JSON.stringify({
        nombreCompleto: input.fullName.trim(),
        username: input.username.trim().toLowerCase(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        confirmarPassword: input.confirmPassword
      })
    }
  )

  return mapUser(response, response.token)
}

/** Valida el JWT y carga el rol actual desde la base de datos. */
export async function getCurrentUser(): Promise<User> {
  const token = getAuthToken()

  if (!token) {
    throw new Error('No existe una sesión guardada.')
  }

  return mapUser(
    await request('/auth/me'),
    token
  )
}

export async function getTransactions(): Promise<Transaction[]> {
  return (
    await request<unknown[]>('/transacciones')
  ).map(mapTransaction)
}

export async function getCategories(): Promise<Category[]> {
  return (
    await request<unknown[]>('/categorias')
  ).map(mapCategory)
}

export async function createCategory(
  input: CategoryInput
): Promise<Category> {
  return mapCategory(
    await request('/categorias', {
      method: 'POST',
      body: JSON.stringify({
        nombre: input.name.trim(),
        tipo: input.type === 'income'
          ? 'Ingreso'
          : 'Gasto',
        descripcion: input.description.trim(),
        activa: input.active
      })
    })
  )
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<Category> {
  return mapCategory(
    await request(
      `/categorias/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          nombre: input.name.trim(),
          tipo: input.type === 'income'
            ? 'Ingreso'
            : 'Gasto',
          descripcion: input.description.trim(),
          activa: input.active
        })
      }
    )
  )
}

export async function deactivateCategory(
  id: string
): Promise<void> {
  await request<void>(
    `/categorias/${encodeURIComponent(id)}`,
    {
      method: 'DELETE'
    }
  )
}

function transactionPayload(
  input: TransactionInput
): JsonRecord {
  return {
    concepto: input.description.trim(),
    monto: input.amount,
    categoriaId: Number(input.categoryId),
    metodoPago: input.paymentMethod,
    fechaMovimiento: `${input.date}T12:00:00`
  }
}

export async function createTransaction(
  input: TransactionInput
): Promise<Transaction> {
  return mapTransaction(
    await request(
      '/transacciones',
      {
        method: 'POST',
        body: JSON.stringify(transactionPayload(input))
      }
    )
  )
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<Transaction> {
  return mapTransaction(
    await request(
      `/transacciones/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(transactionPayload(input))
      }
    )
  )
}

export async function deleteTransaction(
  id: string,
  reason?: string
): Promise<void> {
  const query = reason
    ? `?motivo=${encodeURIComponent(reason)}`
    : ''

  await request<void>(
    `/transacciones/${encodeURIComponent(id)}${query}`,
    {
      method: 'DELETE'
    }
  )
}

export async function getCashSessions(): Promise<CashSession[]> {
  return (
    await request<unknown[]>('/sesionescaja')
  ).map(mapSession)
}

export async function getCurrentCashSession(): Promise<CashSession | null> {
  const response = await request<unknown | null>(
    '/sesionescaja/actual'
  )

  return response == null
    ? null
    : mapSession(response)
}

export async function openCashSession(input: {
  initialBalance: number
  observations: string
}): Promise<CashSession> {
  return mapSession(
    await request(
      '/sesionescaja/abrir',
      {
        method: 'POST',
        body: JSON.stringify({
          saldoInicial: input.initialBalance,
          observaciones: input.observations
        })
      }
    )
  )
}

export async function closeCashSession(
  id: string,
  input: {
    declaredBalance: number
    observations: string
  }
): Promise<CashSession> {
  if (
    !id.trim() ||
    !Number.isFinite(input.declaredBalance) ||
    input.declaredBalance < 0
  ) {
    throw new Error('Los datos de cierre de caja no son válidos.')
  }

  return mapSession(
    await request(
      `/sesionescaja/${encodeURIComponent(id)}/cerrar`,
      {
        method: 'POST',
        body: JSON.stringify({
          saldoDeclarado: input.declaredBalance,
          observaciones: input.observations.trim()
        })
      }
    )
  )
}

export async function getBalances(): Promise<BalanceSummary> {
  return mapBalance(
    await request('/balances/resumen')
  )
}

export async function getReportSummary(
  from: string,
  to: string
): Promise<ReportSummary> {
  const dto = asRecord(
    await request(
      `/reportes/resumen?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}`
    )
  )

  const categories = Array.isArray(dto.categorias)
    ? dto.categorias.map((raw) => {
        const row = asRecord(raw)

        return {
          categoryId: asString(row.idCategoria),
          name: asString(row.nombre),
          type: mapType(row.tipo),
          total: asNumber(row.total),
          count: asNumber(row.cantidad)
        }
      })
    : []

  return {
    from: asString(dto.desde, from).slice(0, 10),
    to: asString(dto.hasta, to).slice(0, 10),
    totalIncome: asNumber(dto.totalIngresos),
    totalExpenses: asNumber(dto.totalEgresos),
    netBalance: asNumber(dto.flujoNeto),
    totalTransactions: asNumber(dto.cantidadMovimientos),
    categories
  }
}

export async function getAuditActions(): Promise<AuditAction[]> {
  return (
    await request<unknown[]>('/auditoria?limite=250')
  ).map(mapAudit)
}

export async function updateProfile(input: {
  fullName: string
  email: string
}): Promise<User> {
  const response = await request<AuthResponse>(
    '/auth/profile',
    {
      method: 'PUT',
      body: JSON.stringify({
        nombreCompleto: input.fullName.trim(),
        email: input.email.trim().toLowerCase()
      })
    }
  )

  return mapUser(response, response.token)
}

export async function changePassword(input: {
  currentPassword: string
  password: string
  confirmPassword: string
}): Promise<void> {
  await request<void>(
    '/auth/password',
    {
      method: 'PUT',
      body: JSON.stringify({
        passwordActual: input.currentPassword,
        password: input.password,
        confirmarPassword: input.confirmPassword
      })
    }
  )
}

export async function getUsers(): Promise<User[]> {
  return (
    await request<unknown[]>('/auth/usuarios')
  ).map((item) => mapUser(item))
}

export async function updateUserRole(
  id: string,
  role: UserRole
): Promise<void> {
  await request<void>(
    `/auth/usuarios/${encodeURIComponent(id)}/rol`,
    {
      method: 'PUT',
      body: JSON.stringify({
        rol: role
      })
    }
  )
}

export async function updateUserStatus(
  id: string,
  active: boolean
): Promise<void> {
  await request<void>(
    `/auth/usuarios/${encodeURIComponent(id)}/estado`,
    {
      method: 'PUT',
      body: JSON.stringify({
        activo: active
      })
    }
  )
}