import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  changePassword as changePasswordApi,
  closeCashSession,
  createCategory,
  createTransaction,
  deactivateCategory,
  deleteTransaction,
  getAuditActions,
  getBalances,
  getCashSessions,
  getCategories,
  getCurrentCashSession,
  getReportSummary,
  getTransactions,
  getUsers,
  openCashSession,
  updateCategory,
  updateProfile as updateProfileApi,
  updateTransaction,
  updateUserRole as updateUserRoleApi,
  updateUserStatus,
} from './api'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  localDateString,
} from './storage'
import type { AuditAction, BalanceSummary, CashSession, Category, CategoryInput, ReportSummary, Transaction, TransactionInput, TransactionType, User, UserRole } from './types'

type Page = 'inicio' | 'transacciones' | 'caja' | 'balances' | 'categorias' | 'reportes' | 'auditoria' | 'configuracion'
type NoticeKind = 'success' | 'info' | 'warning' | 'error'

interface MenuProps { user: User; onLogout: () => void; onUserUpdate: (user: User) => void }
const PAGE_LABELS: Record<Page, string> = {
  inicio: 'Inicio', transacciones: 'Transacciones', caja: 'Sesiones de caja', balances: 'Balances',
  categorias: 'Categorías', reportes: 'Reportes', auditoria: 'Auditoría', configuracion: 'Usuario y roles',
}
const PAYMENT_METHODS = ['Efectivo', 'Transferencia bancaria', 'Tarjeta', 'Depósito', 'Otro']

function currentMonthRange() {
  const now = new Date()
  return { from: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDateString(now) }
}
function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function csvCell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
function exportTransactionsCsv(transactions: Transaction[], filename: string) {
  const rows = [
    ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Método de pago', 'Monto (C$)', 'Registrado por'],
    ...transactions.map((t) => [t.date, t.description, t.category, t.type === 'income' ? 'Ingreso' : 'Gasto', t.paymentMethod, t.amount.toFixed(2), t.recordedByName ?? '']),
  ]
  downloadFile(filename, '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8;')
}

function calculateExpectedCash(
  session: CashSession,
  transactions: Transaction[]
): number {
  const total = transactions.reduce((balance, transaction) => {
    if (
      transaction.sessionId !== session.id ||
      transaction.state !== 'REGISTRADA' ||
      transaction.paymentMethod.trim().toLowerCase() !== 'efectivo'
    ) {
      return balance
    }

    return balance + (
      transaction.type === 'income'
        ? transaction.amount
        : -transaction.amount
    )
  }, session.initialBalance)

  return Math.round((total + Number.EPSILON) * 100) / 100
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" type="button" aria-label="Cerrar ventana" onClick={onClose}>×</button></div>
      {children}
    </section>
  </div>
}
function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state-icon">▤</div><h3>{title}</h3><p>{detail}</p>{action}</div>
}

function TransactionModal({
  initial, categories, onClose, onSave,
}: { initial: Transaction | null; categories: Category[]; onClose: () => void; onSave: (input: TransactionInput) => Promise<boolean> }) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'income')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const date = initial?.date ?? localDateString()
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? PAYMENT_METHODS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const availableCategories = useMemo(() => categories.filter((item) => item.active && item.type === type), [categories, type])

  useEffect(() => {
    if (!availableCategories.some((item) => item.id === categoryId)) setCategoryId(availableCategories[0]?.id ?? '')
  }, [availableCategories, categoryId])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()

  const numericAmount = Number(amount)

  // Para una transacción nueva, siempre se utiliza la fecha
  // actual de Nicaragua. Al editar, se conserva la original.
  const movementDate = initial?.date ?? localDateString()

  if (description.trim().length < 2) {
    setError(
      `La descripción del ${type === 'income' ? 'ingreso' : 'egreso'} debe tener al menos 2 caracteres.`
    )
    return
  }

  if (
    !amount.trim() ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    setError('El monto debe ser un número mayor que cero.')
    return
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(movementDate) ||
    Number.isNaN(
      new Date(`${movementDate}T12:00:00Z`).getTime()
    )
  ) {
    setError('No se pudo determinar una fecha válida.')
    return
  }

  if (!availableCategories.some((item) => item.id === categoryId)) {
    setError(
      `Selecciona una categoría activa de tipo ${
        type === 'income' ? 'Ingreso' : 'Egreso'
      }.`
    )
    return
  }

  setError('')
  setSaving(true)

  try {
    const saved = await onSave({
      type,
      categoryId,
      description: description.trim(),
      amount: numericAmount,
      date: movementDate,
      paymentMethod,
    })

    if (!saved) {
      setError(
        'No se pudo guardar la transacción. Revisa el aviso e inténtalo nuevamente.'
      )
    }
  } finally {
    setSaving(false)
  }
}

  return <ModalShell title={initial ? 'Editar transacción' : 'Registrar transacción'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="segmented-types" aria-label="Tipo de movimiento">
        <button type="button" className={type === 'income' ? 'type-choice selected income-choice' : 'type-choice'} onClick={() => { setType('income'); setError('') }}>＋ Ingreso</button>
        <button type="button" className={type === 'expense' ? 'type-choice selected expense-choice' : 'type-choice'} onClick={() => { setType('expense'); setError('') }}>− Egreso</button>
      </div>
      <div className="field-group">
  <label htmlFor="transactionDescription">
    Descripción
  </label>

  <input
    id="transactionDescription"
    value={description}
    onChange={(event) => setDescription(event.target.value)}
    minLength={2}
    maxLength={150}
    required
    placeholder={
      type === 'income'
        ? 'Ej. Venta del mostrador'
        : 'Ej. Compra de mercadería o pago a proveedor'
    }
  />
</div>
      <div className="form-two-columns">
        <div className="field-group"><label htmlFor="transactionAmount">Monto (C$)</label><input id="transactionAmount" type="number" min="0.01" max="9999999999999999" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" /></div>
        <div className="field-group">
  <label htmlFor="transactionDate">
    {initial
      ? 'Fecha del movimiento'
      : 'Fecha de hoy (Nicaragua)'}
  </label>

  <input
    id="transactionDate"
    type="text"
    value={formatDate(date)}
    readOnly
    aria-readonly="true"
  />

</div>
      </div>
      <div className="form-two-columns">
        <div className="field-group"><label htmlFor="transactionCategory">Categoría</label><select id="transactionCategory" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Selecciona categoría</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{availableCategories.length === 0 && <small>No hay categorías activas de este tipo. Solicita al administrador que agregue una.</small>}</div>
        <div className="field-group"><label htmlFor="transactionPayment">Método de pago</label><select id="transactionPayment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || !availableCategories.length}>{saving ? 'Guardando…' : 'Guardar transacción'}</button></div>
    </form>
  </ModalShell>
}

function CategoryModal({ initial, onClose, onSave }: { initial: Category | null; onClose: () => void; onSave: (input: CategoryInput) => Promise<boolean> }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'income')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    setSaving(true); setError('')
    try { if (!(await onSave({ name: name.trim(), type, description: description.trim(), active }))) setError('No se pudo guardar la categoría.') }
    finally { setSaving(false) }
  }
  return <ModalShell title={initial ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="field-group"><label htmlFor="categoryName">Nombre</label><input id="categoryName" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} minLength={2} required placeholder="Ej. Servicios básicos" /></div>
      <div className="field-group"><label htmlFor="categoryType">Tipo de movimiento</label><select id="categoryType" value={type} onChange={(e) => setType(e.target.value as TransactionType)}><option value="income">Ingreso</option><option value="expense">Egreso</option></select>{initial && <small>Si ya tiene transacciones, el tipo no se puede cambiar.</small>}</div>
      <div className="field-group"><label htmlFor="categoryDescription">Descripción (opcional)</label><textarea id="categoryDescription" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={150} rows={3} /></div>
      {initial && <label className="inline-checkbox"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Categoría activa</label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar categoría'}</button></div>
    </form>
  </ModalShell>
}

function CloseSessionModal({
  session,
  transactions,
  onClose,
  onSave,
}: {
  session: CashSession
  transactions: Transaction[]
  onClose: () => void
  onSave: (
    session: CashSession,
    declaredBalance: number,
    observations: string
  ) => Promise<boolean>
}) {
  const expectedBalance = useMemo(
    () => calculateExpectedCash(session, transactions),
    [session, transactions]
  )

  const [observations, setObservations] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setBusy(true)
    setError('')

    try {
      const saved = await onSave(
        session,
        expectedBalance,
        observations.trim()
      )

      if (!saved) {
        setError('No se pudo cerrar la sesión de caja. Revisa el mensaje mostrado e inténtalo nuevamente.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Cerrar sesión de caja"
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={submit}
        noValidate
      >
        <p>
          Sesión abierta por{' '}
          <strong>{session.openerName}</strong>{' '}
          desde {formatDate(session.openedAt)}.
        </p>

        <div className="field-group">
          <label htmlFor="declaredBalance">
            Efectivo contado (C$)
          </label>

          <input
            id="declaredBalance"
            type="text"
            inputMode="decimal"
            value={expectedBalance.toFixed(2)}
            readOnly
            aria-readonly="true"
          />

          <small>
            Saldo inicial más ingresos en efectivo menos egresos
            en efectivo registrados en esta sesión.
          </small>
        </div>

        <div className="field-group">
          <label htmlFor="closingObservations">
            Observaciones (opcional)
          </label>

          <textarea
            id="closingObservations"
            rows={3}
            maxLength={250}
            value={observations}
            onChange={(event) =>
              setObservations(event.target.value)
            }
            placeholder="Anota cualquier incidencia"
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Cerrando…' : 'Confirmar cierre'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function Menu({ user, onLogout, onUserUpdate }: MenuProps) {
  const isAdmin = user.role === 'Administrador'
  const [page, setPage] = useState<Page>('inicio')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null)
  const [audits, setAudits] = useState<AuditAction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null)
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [transactionSearch, setTransactionSearch] = useState('')
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | TransactionType>('all')
  const [reportFrom, setReportFrom] = useState(() => currentMonthRange().from)
  const [reportTo, setReportTo] = useState(() => currentMonthRange().to)
  const [reportBusy, setReportBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState<NoticeKind>('success')
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [sessionOpenAmount, setSessionOpenAmount] = useState('')
  const [sessionOpenNotes, setSessionOpenNotes] = useState('')
  const [sessionOpenBusy, setSessionOpenBusy] = useState(false)
  const [sessionToClose, setSessionToClose] = useState<CashSession | null>(null)
  const [profileName, setProfileName] = useState(user.fullName)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileMessage, setProfileMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const showNotice = (message: string, kind: NoticeKind = 'success') => { setNoticeType(kind); setNotice(message) }

  const reloadCoreData = async () => {
    const [tx, cats, allSessions, current] = await Promise.all([getTransactions(), getCategories(), getCashSessions(), getCurrentCashSession()])
    setTransactions(tx); setCategories(cats); setSessions(allSessions); setCurrentSession(current)
    if (isAdmin) {
      const [balance, audit] = await Promise.all([getBalances(), getAuditActions()])
      setBalanceSummary(balance); setAudits(audit)
      try { setReportSummary(await getReportSummary(reportFrom, reportTo)) } catch { /* se puede consultar después desde Reportes */ }
    } else {
      setBalanceSummary(null); setReportSummary(null); setAudits([]); setUsers([])
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setInitialLoading(true)
      try {
        const [tx, cats, allSessions, current] = await Promise.all([getTransactions(), getCategories(), getCashSessions(), getCurrentCashSession()])
        if (cancelled) return
        setTransactions(tx); setCategories(cats); setSessions(allSessions); setCurrentSession(current)
        if (isAdmin) {
          const [balance, audit, directory, report] = await Promise.all([
            getBalances(), getAuditActions(), getUsers(), getReportSummary(reportFrom, reportTo),
          ])
          if (cancelled) return
          setBalanceSummary(balance); setAudits(audit); setUsers(directory); setReportSummary(report)
        }
      } catch (loadError) {
        if (!cancelled) showNotice(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos desde el servidor.', 'error')
      } finally { if (!cancelled) setInitialLoading(false) }
    }
    void load()
    return () => { cancelled = true }
    // reportFrom / reportTo are intentionally loaded on demand when the user presses Consultar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.role])

  const transactionsNewestFirst = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [transactions])
  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLocaleLowerCase()
    return transactionsNewestFirst.filter((item) => {
      const matchSearch = !query || [item.description, item.category, item.paymentMethod, item.recordedByName ?? ''].some((text) => text.toLocaleLowerCase().includes(query))
      return matchSearch && (transactionTypeFilter === 'all' || item.type === transactionTypeFilter)
    })
  }, [transactionsNewestFirst, transactionSearch, transactionTypeFilter])
  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])

  const navigate = (target: Page) => {
    if (!isAdmin && ['balances', 'categorias', 'reportes', 'auditoria'].includes(target)) {
      showNotice('Tu rol de cajero no tiene permisos para acceder a esa sección.', 'warning')
      setPage('inicio'); return
    }
    setPage(target); setNotice('')
  }

  const saveTransaction = async (input: TransactionInput): Promise<boolean> => {
    try {
      const editing = transactionToEdit
      const record = editing ? await updateTransaction(editing.id, input) : await createTransaction(input)
      setTransactions((current) => editing ? current.map((item) => item.id === editing.id ? record : item) : [record, ...current])
      setShowTransactionModal(false); setTransactionToEdit(null)
      showNotice(editing ? 'La transacción se actualizó correctamente.' : 'La transacción se registró correctamente.')
      void reloadCoreData().catch(() => {})
      return true
    } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo guardar la transacción.', 'error'); return false }
  }

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`¿Anular la transacción «${transaction.description}»? El registro se conservará en la auditoría.`)) return
    const reason = window.prompt('Motivo de la anulación (opcional):') ?? ''
    try {
      await deleteTransaction(transaction.id, reason.trim())
      setTransactions((current) => current.filter((item) => item.id !== transaction.id))
      showNotice('La transacción fue anulada y la acción quedó registrada en auditoría.')
      if (isAdmin) void getAuditActions().then(setAudits).catch(() => {})
    } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo anular la transacción.', 'error') }
  }

  const saveCategory = async (input: CategoryInput): Promise<boolean> => {
    try {
      const saved = categoryToEdit ? await updateCategory(categoryToEdit.id, input) : await createCategory(input)
      setCategories((current) => categoryToEdit ? current.map((item) => item.id === categoryToEdit.id ? saved : item) : [...current, saved])
      setShowCategoryModal(false); setCategoryToEdit(null)
      showNotice(categoryToEdit ? 'La categoría se actualizó correctamente.' : 'La categoría se creó correctamente.')
      if (isAdmin) void getAuditActions().then(setAudits).catch(() => {})
      return true
    } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo guardar la categoría.', 'error'); return false }
  }

  const toggleCategory = async (category: Category) => {
    if (category.active && !window.confirm(`¿Desactivar la categoría «${category.name}»? Se conservarán las transacciones históricas asociadas.`)) return
    try {
      if (category.active) await deactivateCategory(category.id)
      else await updateCategory(category.id, { name: category.name, type: category.type, description: category.description, active: true })
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, active: !category.active } : item))
      showNotice(category.active ? 'Categoría desactivada.' : 'Categoría reactivada.')
      if (isAdmin) void getAuditActions().then(setAudits).catch(() => {})
    } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo cambiar el estado de la categoría.', 'error') }
  }

  const openCloseSessionModal = async (
  session: CashSession
) => {
  try {
    const latestTransactions = await getTransactions()

    setTransactions(latestTransactions)
    setSessionToClose(session)
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : 'No se pudieron actualizar los movimientos de caja.',
      'error'
    )
  }
}


  const handleOpenSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(sessionOpenAmount)
    if (!sessionOpenAmount.trim() || !Number.isFinite(amount) || amount < 0) { showNotice('El saldo inicial debe ser un número igual o mayor que cero.', 'warning'); return }
    setSessionOpenBusy(true)
    try {
      await openCashSession({ initialBalance: amount, observations: sessionOpenNotes.trim() })
      setSessionOpenAmount(''); setSessionOpenNotes('')
      await reloadCoreData(); showNotice('La caja se abrió correctamente.')
    } catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo abrir la caja.', 'error') }
    finally { setSessionOpenBusy(false) }
  }

  const handleCloseSession = async (
  session: CashSession,
  declaredBalance: number,
  observations: string
): Promise<boolean> => {
  let closed: CashSession

  try {
    closed = await closeCashSession(session.id, {
      declaredBalance,
      observations
    })
  } catch (error) {
    showNotice(
      error instanceof Error
        ? error.message
        : 'No se pudo cerrar la caja.',
      'error'
    )

    return false
  }

  setSessionToClose(null)

  const finalBalance =
    closed.expectedBalance ?? declaredBalance

  try {
    await reloadCoreData()

    showNotice(
      `Caja cerrada correctamente. Saldo final: ${formatCurrency(finalBalance)}.`
    )
  } catch {
    showNotice(
      `La caja se cerró correctamente con un saldo de ${formatCurrency(finalBalance)}, pero no se pudo actualizar toda la pantalla. Recarga los datos.`,
      'warning'
    )
  }

  return true
}

  const consultReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (reportFrom > reportTo) { showNotice('La fecha inicial no puede ser posterior a la fecha final.', 'warning'); return }
    setReportBusy(true)
    try { setReportSummary(await getReportSummary(reportFrom, reportTo)); showNotice('Reporte actualizado con los datos del servidor.') }
    catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo consultar el reporte.', 'error') }
    finally { setReportBusy(false) }
  }

  const exportReport = () => {
    if (!isAdmin || !reportSummary) return
    if (reportFrom > reportTo) { showNotice('La fecha inicial no puede ser posterior a la fecha final.', 'warning'); return }
    const filtered = transactions.filter((item) => item.date >= reportFrom && item.date <= reportTo)
    if (!filtered.length) { showNotice('No hay transacciones en el periodo seleccionado.', 'warning'); return }
    try { exportTransactionsCsv(filtered, `pulpi-reporte-${reportFrom}-a-${reportTo}.csv`); showNotice('Reporte descargado en formato CSV.') }
    catch { showNotice('No se pudo descargar el reporte.', 'error') }
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setProfileMessage('')
    if (profileName.trim().length < 2) { setProfileMessage('El nombre debe tener al menos 2 caracteres.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) { setProfileMessage('Escribe un correo electrónico válido.'); return }
    setProfileBusy(true)
    try { const updated = await updateProfileApi({ fullName: profileName.trim(), email: profileEmail.trim() }); onUserUpdate(updated); setProfileName(updated.fullName); setProfileEmail(updated.email); setProfileMessage('Perfil actualizado correctamente.'); setUsers((old) => old.map((account) => account.id === updated.id ? updated : account)) }
    catch (error) { setProfileMessage(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.') }
    finally { setProfileBusy(false) }
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPasswordMessage('')
    if (newPassword.length < 8 || newPassword.length > 72) { setPasswordMessage('La nueva contraseña debe tener entre 8 y 72 caracteres.'); return }
    if (newPassword !== confirmNewPassword) { setPasswordMessage('La nueva contraseña y su confirmación no coinciden.'); return }
    setPasswordBusy(true)
    try { await changePasswordApi({ currentPassword, password: newPassword, confirmPassword: confirmNewPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage('Contraseña actualizada correctamente.') }
    catch (error) { setPasswordMessage(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.') }
    finally { setPasswordBusy(false) }
  }

  const changeUserRole = async (id: string, role: UserRole) => {
    if (!isAdmin || id === user.id) { showNotice('No puedes cambiar el rol de tu propia cuenta.', 'warning'); return }
    try { await updateUserRoleApi(id, role); setUsers((old) => old.map((account) => account.id === id ? { ...account, role } : account)); showNotice('Rol actualizado. Los permisos nuevos se aplican en las próximas solicitudes.'); void getAuditActions().then(setAudits).catch(() => {}) }
    catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo actualizar el rol.', 'error') }
  }
  const changeUserStatus = async (target: User) => {
    if (!isAdmin || target.id === user.id) return
    const nextActive = !(target.active ?? true)
    if (!window.confirm(`${nextActive ? '¿Activar' : '¿Desactivar'} la cuenta de ${target.username}?`)) return
    try { await updateUserStatus(target.id, nextActive); setUsers((old) => old.map((account) => account.id === target.id ? { ...account, active: nextActive } : account)); showNotice(nextActive ? 'Cuenta activada.' : 'Cuenta desactivada; sus próximos accesos serán rechazados.'); void getAuditActions().then(setAudits).catch(() => {}) }
    catch (error) { showNotice(error instanceof Error ? error.message : 'No se pudo actualizar el estado.', 'error') }
  }

  const exportBackup = () => {
    try {
      const backup = { application: 'Pulpi Finanzas', version: 2, exportedAt: new Date().toISOString(), user: { fullName: user.fullName, username: user.username, role: user.role }, transactions, categories: isAdmin ? categories : categories.filter((c) => c.active), sessions }
      downloadFile(`pulpi-respaldo-${localDateString()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;')
      showNotice('Respaldo descargado. Los datos originales permanecen en el servidor.')
    } catch { showNotice('No fue posible generar el respaldo.', 'error') }
  }

  const renderTransactionTable = (items: Transaction[], compact = false) => <div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Método de pago</th><th className="numeric-cell">Monto</th>{isAdmin && <th>Registrado por</th>}{!compact && <th>Acciones</th>}</tr></thead><tbody>
    {items.map((item) => <tr key={item.id}><td className="date-cell">{formatDate(item.date)}</td><td><div className="table-primary-text">{item.description}</div></td><td><span className="category-pill">{item.category}</span></td><td><span className={`status-pill ${item.type === 'income' ? 'status-income' : 'status-expense'}`}>{item.type === 'income' ? 'Ingreso' : 'Egreso'}</span></td><td>{item.paymentMethod}</td><td className={`numeric-cell amount-cell ${item.type === 'income' ? 'positive-amount' : 'negative-amount'}`}>{item.type === 'income' ? '+' : '−'}{formatCurrency(item.amount)}</td>{isAdmin && <td>{item.recordedByName || '—'}</td>}{!compact && <td><div className="row-actions"><button type="button" className="text-action" onClick={() => { setTransactionToEdit(item); setShowTransactionModal(true) }}>Editar</button><button type="button" className="text-action danger-action" onClick={() => void handleDeleteTransaction(item)}>Anular</button></div></td>}</tr>)}
  </tbody></table></div>

  const renderDashboard = () => <>
    <section className="welcome-panel"><div><p className="section-overline">{isAdmin ? 'PANEL ADMINISTRATIVO' : 'TURNO DE CAJA'}</p><h1>Hola, {user.fullName.split(' ')[0]} <span aria-hidden="true">👋</span></h1><p>{isAdmin ? 'Consulta la actividad financiera consolidada de todos los usuarios.' : 'Aquí puedes consultar tus movimientos y administrar tu sesión de caja.'}</p></div><button className="button button-primary" type="button" onClick={() => currentSession ? openTransactionModal() : navigate('caja')} disabled={initialLoading}>{currentSession ? '＋ Registrar transacción' : 'Abrir caja para iniciar'}</button></section>
    {isAdmin ? <>
      <section className="kpi-grid" aria-label="Resumen financiero"><article className="kpi-card"><div className="kpi-head"><span>Balance neto</span><span className="kpi-icon icon-green">↗</span></div><strong className={`kpi-value ${(balanceSummary?.netBalance ?? 0) < 0 ? 'negative-amount' : ''}`}>{formatCurrency(balanceSummary?.netBalance ?? 0)}</strong><span className="kpi-description">Ingresos menos egresos de todos los usuarios</span></article><article className="kpi-card"><div className="kpi-head"><span>Ingresos acumulados</span><span className="kpi-icon icon-blue">＋</span></div><strong className="kpi-value">{formatCurrency(balanceSummary?.totalIncome ?? 0)}</strong><span className="kpi-description">Movimientos registrados</span></article><article className="kpi-card"><div className="kpi-head"><span>Egresos acumulados</span><span className="kpi-icon icon-orange">−</span></div><strong className="kpi-value">{formatCurrency(balanceSummary?.totalExpenses ?? 0)}</strong><span className="kpi-description">Movimientos registrados</span></article><article className="kpi-card"><div className="kpi-head"><span>Transacciones activas</span><span className="kpi-icon icon-purple">↔</span></div><strong className="kpi-value">{balanceSummary?.totalTransactions ?? transactions.length}</strong><span className="kpi-description">De todas las cuentas</span></article></section>
    </> : <section className="panel-card"><div className="panel-heading"><div><h2>Mi sesión de caja</h2><p>Solo se muestra la información asociada a tu cuenta.</p></div><span className={`status-pill ${currentSession ? 'status-income' : 'status-expense'}`}>{currentSession ? 'ABIERTA' : 'SIN ABRIR'}</span></div>{currentSession ? <div className="session-summary-grid"><div><span>Saldo inicial</span><strong>{formatCurrency(currentSession.initialBalance)}</strong></div><div><span>Apertura</span><strong>{formatDateTime(currentSession.openedAt)}</strong></div><div><span>Movimientos de este turno</span><strong>{transactions.filter((t) => t.sessionId === currentSession.id).length}</strong></div></div> : <p className="muted-empty">Debes abrir tu caja antes de registrar nuevas transacciones.</p>}<button className="button button-secondary" type="button" onClick={() => navigate('caja')}>{currentSession ? 'Ver sesión de caja' : 'Abrir sesión de caja'}</button></section>}
    <section className="panel-card"><div className="panel-heading"><div><h2>Movimientos recientes</h2><p>{isAdmin ? 'Últimas transacciones del sistema' : 'Últimas transacciones registradas por ti'}</p></div><button className="link-button" type="button" onClick={() => navigate('transacciones')}>Ver todas →</button></div>{transactionsNewestFirst.length ? renderTransactionTable(transactionsNewestFirst.slice(0, 6), true) : <EmptyState title="Todavía no hay movimientos" detail={currentSession ? 'Registra tu primer ingreso o egreso.' : 'Abre una sesión de caja para comenzar.'} />}</section>
  </>

  const openTransactionModal = () => { setTransactionToEdit(null); setShowTransactionModal(true) }
  const renderTransactions = () => <>
    <section className="page-title-row"><div><p className="section-overline">REGISTRO FINANCIERO</p><h1>Transacciones</h1><p>Registra ingresos y egresos y consulta el historial permitido para tu rol.</p></div><button className="button button-primary" type="button" onClick={openTransactionModal} disabled={!currentSession}>＋ Nueva transacción</button></section>
    {!currentSession && <div className="notice-bar notice-warning"><span>!</span><p>Necesitas abrir una sesión de caja para registrar movimientos.</p><button className="button button-secondary button-small" type="button" onClick={() => navigate('caja')}>Abrir caja</button></div>}
    <section className="panel-card"><div className="filters-row"><div className="field-group search-field"><label htmlFor="transactionSearch">Buscar movimientos</label><input id="transactionSearch" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} placeholder="Descripción, categoría o método" /></div><div className="field-group"><label htmlFor="transactionFilter">Tipo</label><select id="transactionFilter" value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value as 'all' | TransactionType)}><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Egresos</option></select></div></div>{filteredTransactions.length ? renderTransactionTable(filteredTransactions) : <EmptyState title="No hay transacciones que coincidan" detail="Cambia los filtros o registra un nuevo movimiento." />}</section>
  </>

  const renderCashSessions = () => <>
  <section className="page-title-row">
    <div>
      <p className="section-overline">CONTROL DE EFECTIVO</p>
      <h1>Sesiones de caja</h1>
      <p>
        Consulta el saldo de la sesión y ciérrala cuando termines
        el turno.
      </p>
    </div>
  </section>

  {currentSession ? (
    <section className="panel-card">
      <div className="panel-heading">
        <div>
          <h2>Tu sesión actual</h2>
          <p>
            Abierta el{' '}
            {new Date(currentSession.openedAt).toLocaleString('es-NI')}
          </p>
        </div>

        <span className="status-pill status-income">
          ABIERTA
        </span>
      </div>

      <div className="session-summary-grid">
        <div>
          <span>Saldo inicial</span>
          <strong>
            {formatCurrency(currentSession.initialBalance)}
          </strong>
        </div>

        <div>
          <span>Movimientos del turno</span>
          <strong>
            {transactions.filter(
              (item) => item.sessionId === currentSession.id
            ).length}
          </strong>
        </div>

        <div>
          <span>Responsable</span>
          <strong>
            {currentSession.openerName || user.fullName}
          </strong>
        </div>
      </div>

      <button
        className="button button-primary"
        type="button"
        onClick={() => void openCloseSessionModal(currentSession)}
      >
        Revisar saldo y cerrar caja
      </button>
    </section>
  ) : (
    <section className="panel-card">
      <div className="panel-heading">
        <div>
          <h2>Apertura de caja</h2>
          <p>Registra el efectivo con el que inicia el turno.</p>
        </div>
      </div>

      <form
        className="modal-form inline-session-form"
        onSubmit={handleOpenSession}
        noValidate
      >
        <div className="field-group">
          <label htmlFor="openingBalance">
            Saldo inicial (C$)
          </label>

          <input
            id="openingBalance"
            type="number"
            min="0"
            step="0.01"
            value={sessionOpenAmount}
            onChange={(event) =>
              setSessionOpenAmount(event.target.value)
            }
            required
            placeholder="0.00"
          />
        </div>

        <div className="field-group">
          <label htmlFor="openingNotes">
            Observaciones (opcional)
          </label>

          <input
            id="openingNotes"
            value={sessionOpenNotes}
            onChange={(event) =>
              setSessionOpenNotes(event.target.value)
            }
            maxLength={250}
            placeholder="Efectivo con el que inicia el turno"
          />
        </div>

        <button
          className="button button-primary"
          type="submit"
          disabled={sessionOpenBusy}
        >
          {sessionOpenBusy ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </form>
    </section>
  )}

  <section className="panel-card">
    <div className="panel-heading">
      <div>
        <h2>
          {isAdmin
            ? 'Historial de todas las cajas'
            : 'Mi historial de caja'}
        </h2>

        <p>
          {isAdmin
            ? 'Sesiones abiertas y cerradas de todos los usuarios.'
            : 'Solo tus sesiones de caja.'}
        </p>
      </div>
    </div>

    {sessions.length ? (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Apertura</th>
              {isAdmin && <th>Usuario</th>}
              <th>Saldo inicial</th>
              <th>Estado</th>
              <th>Saldo esperado</th>
              <th>Saldo al cierre</th>
            </tr>
          </thead>

          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {formatDateTime(session.openedAt)}
                </td>

                {isAdmin && (
                  <td>{session.openerName}</td>
                )}

                <td className="numeric-cell">
                  {formatCurrency(session.initialBalance)}
                </td>

                <td>
                  <span
                    className={`status-pill ${
                      session.status === 'ABIERTA'
                        ? 'status-income'
                        : 'status-expense'
                    }`}
                  >
                    {session.status}
                  </span>
                </td>

                <td className="numeric-cell">
                  {session.expectedBalance == null
                    ? '—'
                    : formatCurrency(session.expectedBalance)}
                </td>

                <td className="numeric-cell">
                  {session.declaredBalance == null
                    ? '—'
                    : formatCurrency(session.declaredBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState
        title="Todavía no hay sesiones"
        detail="Abre tu primera sesión de caja para comenzar."
      />
    )}
  </section>
</>

  const renderBalances = () => <>
    <section className="page-title-row"><div><p className="section-overline">VISTA CONSOLIDADA</p><h1>Balances</h1><p>Totales acumulados de movimientos registrados de todas las cuentas.</p></div><button className="button button-secondary" type="button" onClick={() => void getBalances().then(setBalanceSummary).catch((e) => showNotice(e instanceof Error ? e.message : 'No se pudo actualizar el balance.', 'error'))}>Actualizar</button></section>
    <section className="kpi-grid"><article className="kpi-card"><div className="kpi-head"><span>Total ingresos</span><span className="kpi-icon icon-blue">＋</span></div><strong className="kpi-value">{formatCurrency(balanceSummary?.totalIncome ?? 0)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Total egresos</span><span className="kpi-icon icon-orange">−</span></div><strong className="kpi-value">{formatCurrency(balanceSummary?.totalExpenses ?? 0)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Flujo neto</span><span className="kpi-icon icon-green">↗</span></div><strong className="kpi-value">{formatCurrency(balanceSummary?.netBalance ?? 0)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Movimientos</span><span className="kpi-icon icon-purple">↔</span></div><strong className="kpi-value">{balanceSummary?.totalTransactions ?? 0}</strong></article></section>
    <section className="panel-card"><h2>Interpretación</h2><p>El flujo neto se calcula restando los egresos registrados a los ingresos registrados. No representa necesariamente utilidad contable ni efectivo físico disponible; Pulpi no registra inventario ni calcula el costo de la mercancía vendida.</p></section>
  </>

  const renderCategories = () => <>
    <section className="page-title-row"><div><p className="section-overline">CATÁLOGO DEL SISTEMA</p><h1>Categorías</h1><p>Administra el catálogo que se utiliza al registrar transacciones.</p></div><button className="button button-primary" type="button" onClick={() => { setCategoryToEdit(null); setShowCategoryModal(true) }}>＋ Nueva categoría</button></section>
    <section className="panel-card">{categories.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><span className="table-primary-text">{category.name}</span></td><td><span className={`status-pill ${category.type === 'income' ? 'status-income' : 'status-expense'}`}>{category.type === 'income' ? 'Ingreso' : 'Egreso'}</span></td><td>{category.description || '—'}</td><td>{category.active ? 'Activa' : 'Inactiva'}</td><td><div className="row-actions"><button className="text-action" type="button" onClick={() => { setCategoryToEdit(category); setShowCategoryModal(true) }}>Editar</button><button className="text-action" type="button" onClick={() => void toggleCategory(category)}>{category.active ? 'Desactivar' : 'Reactivar'}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No hay categorías" detail="Crea categorías de ingresos y egresos para habilitar el registro financiero." />}</section>
  </>

  const renderReports = () => <>
    <section className="page-title-row"><div><p className="section-overline">ANÁLISIS POR PERIODO</p><h1>Reportes</h1><p>Consulta los movimientos agregados y el desglose por categoría en el periodo elegido.</p></div></section>
    <section className="panel-card"><form className="filters-row" onSubmit={consultReport} noValidate><div className="field-group"><label htmlFor="reportFrom">Desde</label><input id="reportFrom" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} required /></div><div className="field-group"><label htmlFor="reportTo">Hasta</label><input id="reportTo" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} required /></div><button className="button button-primary" type="submit" disabled={reportBusy}>{reportBusy ? 'Consultando…' : 'Consultar'}</button><button className="button button-secondary" type="button" onClick={exportReport} disabled={!reportSummary}>Exportar CSV</button></form></section>
    {reportSummary && <><section className="kpi-grid"><article className="kpi-card"><div className="kpi-head"><span>Ingresos del periodo</span><span className="kpi-icon icon-blue">＋</span></div><strong className="kpi-value">{formatCurrency(reportSummary.totalIncome)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Egresos del periodo</span><span className="kpi-icon icon-orange">−</span></div><strong className="kpi-value">{formatCurrency(reportSummary.totalExpenses)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Flujo neto del periodo</span><span className="kpi-icon icon-green">↗</span></div><strong className="kpi-value">{formatCurrency(reportSummary.netBalance)}</strong></article><article className="kpi-card"><div className="kpi-head"><span>Transacciones</span><span className="kpi-icon icon-purple">↔</span></div><strong className="kpi-value">{reportSummary.totalTransactions}</strong></article></section><section className="panel-card"><div className="panel-heading"><div><h2>Totales por categoría</h2><p>Importes agrupados desde la base de datos.</p></div></div>{reportSummary.categories.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Categoría</th><th>Tipo</th><th>Movimientos</th><th className="numeric-cell">Total</th></tr></thead><tbody>{reportSummary.categories.map((row) => <tr key={`${row.categoryId}-${row.type}`}><td>{row.name}</td><td>{row.type === 'income' ? 'Ingreso' : 'Egreso'}</td><td>{row.count}</td><td className="numeric-cell">{formatCurrency(row.total)}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin movimientos en este periodo" detail="Prueba con otro rango de fechas." />}</section></>}
  </>

  const renderAudit = () => <>
    <section className="page-title-row"><div><p className="section-overline">TRAZABILIDAD</p><h1>Auditoría de acciones</h1><p>Registro de cambios y operaciones sensibles realizados en Pulpi.</p></div><button className="button button-secondary" type="button" onClick={() => void getAuditActions().then(setAudits).catch((e) => showNotice(e instanceof Error ? e.message : 'No se pudo actualizar la auditoría.', 'error'))}>Actualizar</button></section>
    <section className="panel-card">{audits.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Entidad</th><th>Acción</th><th>Detalles</th></tr></thead><tbody>{audits.map((item) => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString('es-NI')}</td><td><div className="table-primary-text">{item.userName}</div><div className="table-secondary-text">@{item.username}</div></td><td>{item.entity}</td><td><span className="category-pill">{item.action}</span></td><td><details><summary>Ver detalle</summary><div className="audit-details"><strong>Motivo:</strong> {item.reason || '—'}<pre>{item.newData || item.oldData || 'Sin datos adicionales.'}</pre></div></details></td></tr>)}</tbody></table></div> : <EmptyState title="No hay acciones registradas" detail="Las acciones importantes aparecerán aquí a medida que se use el sistema." />}</section>
  </>

  const renderSettings = () => <>
    <section className="page-title-row"><div><p className="section-overline">PREFERENCIAS Y SEGURIDAD</p><h1>Usuario y roles</h1><p>Actualiza tu perfil y administra la seguridad de la cuenta.</p></div></section>
    <section className="settings-grid">
      <article className="panel-card settings-card"><div className="panel-heading"><div><h2>Perfil de usuario</h2><p>Información vinculada a tu cuenta</p></div></div><div className="profile-identity"><span className="profile-avatar">{user.fullName.trim().charAt(0).toLocaleUpperCase()}</span><div><strong>{user.fullName}</strong><span>@{user.username} · {user.role}</span></div></div><form className="settings-form" onSubmit={saveProfile}><div className="field-group"><label htmlFor="profileName">Nombre completo</label><input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={150} minLength={2} required /></div><div className="field-group"><label htmlFor="profileEmail">Correo electrónico</label><input id="profileEmail" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} maxLength={100} required /></div>{profileMessage && <p className={profileMessage.includes('correctamente') ? 'form-success' : 'form-error'} role="status">{profileMessage}</p>}<button className="button button-primary" type="submit" disabled={profileBusy}>{profileBusy ? 'Guardando…' : 'Guardar perfil'}</button></form></article>
      <article className="panel-card settings-card"><div className="panel-heading"><div><h2>Cambiar contraseña</h2><p>Usa entre 8 y 72 caracteres</p></div></div><form className="settings-form" onSubmit={changePassword}><div className="field-group"><label htmlFor="currentPassword">Contraseña actual</label><input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required /></div><div className="field-group"><label htmlFor="newPassword">Nueva contraseña</label><input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required /></div><div className="field-group"><label htmlFor="confirmNewPassword">Confirmar nueva contraseña</label><input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required /></div>{passwordMessage && <p className={passwordMessage.includes('correctamente') ? 'form-success' : 'form-error'} role="status">{passwordMessage}</p>}<button className="button button-primary" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Actualizando…' : 'Actualizar contraseña'}</button></form></article>
      <article className="panel-card settings-card backup-card"><div className="backup-icon">⇩</div><div><h2>Respaldo</h2><p>Descarga una copia JSON de las transacciones, categorías permitidas y sesiones disponibles para tu rol.</p><button type="button" className="button button-secondary" onClick={exportBackup}>Descargar respaldo</button></div></article>
      {isAdmin && <article className="panel-card settings-card user-management-card"><div className="panel-heading"><div><h2>Usuarios y roles</h2><p>Los nuevos registros se crean con rol Cajero.</p></div><span className="status-pill status-income">{users.length} cuentas</span></div>{users.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><div className="table-primary-text">{account.fullName}</div><div className="table-secondary-text">@{account.username}{account.id === user.id ? ' · Tu cuenta' : ''}</div></td><td>{account.email}</td><td>{account.id === user.id ? <span className="category-pill">{account.role}</span> : <select className="role-select" aria-label={`Rol de ${account.username}`} value={account.role} onChange={(e) => void changeUserRole(account.id, e.target.value as UserRole)}><option value="Cajero">Cajero</option><option value="Administrador">Administrador</option></select>}</td><td>{account.id === user.id ? 'Activa' : <button className="text-action" type="button" onClick={() => void changeUserStatus(account)}>{account.active === false ? 'Activar' : 'Desactivar'}</button>}</td></tr>)}</tbody></table></div> : <p className="muted-empty">No hay cuentas registradas.</p>}</article>}
      <article className="panel-card settings-card security-note"><h2>Permisos de tu cuenta</h2><p>{isAdmin ? 'Como administrador puedes consultar los datos de todas las cuentas, gestionar categorías, consultar balances y reportes, y revisar la auditoría.' : 'Como cajero puedes registrar movimientos y gestionar tus sesiones de caja. No puedes consultar balances, reportes, auditoría ni información de otros usuarios.'}</p></article>
    </section>
  </>

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="sidebar-brand" type="button" onClick={() => navigate('inicio')} aria-label="Pulpi, ir al inicio"><span className="sidebar-logo">P</span><span><strong>Pulpi</strong><small>FINANZAS</small></span></button>
      <p className="sidebar-section-label">MENÚ PRINCIPAL</p>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {([['inicio', '⌂', 'Inicio'], ['transacciones', '↔', 'Transacciones'], ['caja', '▣', 'Sesiones de caja'], ...(isAdmin ? [['balances', '▥', 'Balances'], ['categorias', '◇', 'Categorías'], ['reportes', '▤', 'Reportes'], ['auditoria', '◷', 'Auditoría']] : [])] as [Page, string, string][]).map(([target, icon, label]) => <button key={target} type="button" className={page === target ? 'sidebar-link active' : 'sidebar-link'} onClick={() => navigate(target)}><span className="sidebar-link-icon" aria-hidden="true">{icon}</span><span>{label}</span>{target === 'transacciones' && <span className="nav-count">{transactions.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><p className="sidebar-section-label">CUENTA</p><button type="button" className={page === 'configuracion' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => navigate('configuracion')}><span className="sidebar-link-icon" aria-hidden="true">⚙</span><span>Usuario y roles</span></button><div className="sidebar-help"><span className="help-mark">?</span><div><strong>¿Necesitas ayuda?</strong><p>Organiza tus finanzas con Pulpi.</p></div></div><div className="sidebar-user"><span className="user-avatar-large">{user.fullName.trim().charAt(0).toLocaleUpperCase()}</span><div className="sidebar-user-text"><strong>{user.fullName}</strong><small>{user.role}</small></div><button type="button" className="logout-icon" onClick={() => setShowLogoutConfirmation(true)} title="Cerrar sesión" aria-label="Cerrar sesión">↪</button></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="breadcrumb"><span>Pulpi</span><span className="breadcrumb-divider">/</span><strong>{PAGE_LABELS[page]}</strong></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat('es-NI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span><span className="topbar-avatar">{user.fullName.trim().charAt(0).toLocaleUpperCase()}</span></div></header>
      <main className="main-content">
        {initialLoading && <div className="notice-bar notice-info" role="status"><span>i</span><p>Sincronizando datos con el servidor…</p></div>}
        {notice && <div className={`notice-bar notice-${noticeType}`} role={noticeType === 'error' || noticeType === 'warning' ? 'alert' : 'status'}><span aria-hidden="true">{noticeType === 'success' ? '✓' : noticeType === 'info' ? 'i' : noticeType === 'warning' ? '!' : '×'}</span><p>{notice}</p><button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice('')}>×</button></div>}
        {page === 'inicio' && renderDashboard()}
        {page === 'transacciones' && renderTransactions()}
        {page === 'caja' && renderCashSessions()}
        {page === 'balances' && isAdmin && renderBalances()}
        {page === 'categorias' && isAdmin && renderCategories()}
        {page === 'reportes' && isAdmin && renderReports()}
        {page === 'auditoria' && isAdmin && renderAudit()}
        {page === 'configuracion' && renderSettings()}
        <footer className="main-footer"><span>Pulpi Finanzas</span><span>Control de ingresos y egresos · Nicaragua</span></footer>
      </main>
    </div>
    {showTransactionModal && <TransactionModal key={transactionToEdit?.id ?? 'new-transaction'} initial={transactionToEdit} categories={activeCategories} onClose={() => { setShowTransactionModal(false); setTransactionToEdit(null) }} onSave={saveTransaction} />}
    {showCategoryModal && isAdmin && <CategoryModal key={categoryToEdit?.id ?? 'new-category'} initial={categoryToEdit} onClose={() => { setShowCategoryModal(false); setCategoryToEdit(null) }} onSave={saveCategory} />}
    {sessionToClose && (
  <CloseSessionModal
    session={sessionToClose}
    transactions={transactions}
    onClose={() => setSessionToClose(null)}
    onSave={handleCloseSession}
  />
)}
    {showLogoutConfirmation && <ModalShell title="Cerrar sesión" onClose={() => setShowLogoutConfirmation(false)}><div className="logout-confirmation"><div className="logout-confirmation-icon" aria-hidden="true">↪</div><h3>¿Deseas cerrar tu sesión?</h3><p>Saldrás de Pulpi. Tus datos permanecerán guardados en el servidor.</p><div className="modal-actions logout-confirmation-actions"><button className="button button-secondary" type="button" onClick={() => setShowLogoutConfirmation(false)}>Seguir en Pulpi</button><button className="button button-primary logout-confirm-button" type="button" onClick={onLogout}>Cerrar sesión</button></div></div></ModalShell>}
  </div>
}

export default Menu
