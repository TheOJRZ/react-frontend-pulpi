export type UserRole = 'Administrador' | 'Cajero'
export type TransactionType = 'income' | 'expense'
export type CashSessionStatus = 'ABIERTA' | 'CERRADA'

export interface User {
  id: string
  fullName: string
  username: string
  email: string
  role: UserRole
  createdAt: string
  active?: boolean
  /** JWT issued by the backend. Never persisted in any other field. */
  token?: string
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  description: string
  active: boolean
  createdAt: string
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt'>

export interface Transaction {
  id: string
  categoryId: string
  type: TransactionType
  description: string
  category: string
  amount: number
  date: string
  paymentMethod: string
  createdAt: string
  recordedBy?: string
  recordedByName?: string
  sessionId?: string
  state: 'REGISTRADA' | 'ANULADA'
}

export interface TransactionInput {
  type: TransactionType
  categoryId: string
  description: string
  amount: number
  date: string
  paymentMethod: string
}

export interface CashSession {
  id: string
  openerUserId: string
  openerName: string
  openedAt: string
  initialBalance: number
  closerUserId?: string
  closerName?: string
  closedAt?: string
  expectedBalance?: number
  declaredBalance?: number
  difference?: number
  status: CashSessionStatus
  observations?: string
}

export interface AuditAction {
  id: string
  entity: string
  recordId?: string
  action: string
  timestamp: string
  oldData?: string
  newData?: string
  reason?: string
  userName: string
  username: string
}

export interface BalanceSummary {
  totalIncome: number
  totalExpenses: number
  netBalance: number
  totalTransactions: number
}

export interface ReportSummary extends BalanceSummary {
  from: string
  to: string
  categories: Array<{ categoryId: string; name: string; type: TransactionType; total: number; count: number }>
}
