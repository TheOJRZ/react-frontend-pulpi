import { useEffect, useState, type FormEvent } from 'react'
import Registro from './Registro'
import Menu from './Menu'
import { getCurrentUser, login, logout } from './api'
import { clearSession, loadSessionUser, saveSession } from './storage'
import type { User } from './types'
import './App.css'

type LoginField = 'username' | 'password'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<
    Record<LoginField, string>
  >({
    username: '',
    password: ''
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const invalidateSession = () => {
      clearSession()
      setCurrentUser(null)
      setCheckingSession(false)
    }

    window.addEventListener(
      'pulpi:unauthorized',
      invalidateSession
    )

    const cached = loadSessionUser()

    if (!cached?.token) {
      setCheckingSession(false)

      return () => {
        cancelled = true

        window.removeEventListener(
          'pulpi:unauthorized',
          invalidateSession
        )
      }
    }

    // La sesión se valida con el backend; no basta con localStorage.
    void getCurrentUser()
      .then((freshUser) => {
        if (cancelled) return

        const synchronizedUser = {
          ...freshUser,
          token: cached.token
        }

        saveSession(synchronizedUser)
        setCurrentUser(synchronizedUser)
      })
      .catch(() => {
        if (cancelled) return

        clearSession()
        setCurrentUser(null)
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingSession(false)
        }
      })

    return () => {
      cancelled = true

      window.removeEventListener(
        'pulpi:unauthorized',
        invalidateSession
      )
    }
  }, [])

  useEffect(() => {
    if (!currentUser?.token) return

    let cancelled = false

    const syncFromBackend = async () => {
      const stored = loadSessionUser()

      if (!stored?.token || cancelled) return

      try {
        const latestUser = await getCurrentUser()

        if (cancelled) return

        const nextUser = {
          ...latestUser,
          token: stored.token
        }

        saveSession(nextUser)
        setCurrentUser(nextUser)
      } catch {
        // Los errores 401 disparan pulpi:unauthorized.
        // Un error temporal de red no modifica la sesión local.
      }
    }

    const syncTimer = window.setInterval(
      () => {
        void syncFromBackend()
      },
      60_000
    )

    return () => {
      cancelled = true
      window.clearInterval(syncTimer)
    }
  }, [currentUser?.token])

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: ''
    }))

    setError('')
  }

  const enterApp = (user: User) => {
    saveSession(user)
    setCurrentUser(user)
    setError('')

    setFieldErrors({
      username: '',
      password: ''
    })
  }

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setError('')

    const normalizedUsername = username.trim().toLowerCase()

    const nextErrors: Record<LoginField, string> = {
      username: '',
      password: ''
    }

    if (!normalizedUsername) {
      nextErrors.username = 'Escribe tu nombre de usuario.'
    } else if (normalizedUsername.length < 3) {
      nextErrors.username =
        'El nombre de usuario debe tener al menos 3 caracteres.'
    }

    if (!password) {
      nextErrors.password = 'Escribe tu contraseña.'
    }

    setFieldErrors(nextErrors)

    if (Object.values(nextErrors).some(Boolean)) return

    setBusy(true)

    try {
      const user = await login(
        normalizedUsername,
        password
      )

      enterApp(user)
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No fue posible iniciar sesión.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-page">
        <section
          className="auth-card"
          role="status"
        >
          <div
            className="auth-brand-mark"
            aria-hidden="true"
          >
            P
          </div>

          <h1 className="auth-title">
            Verificando sesión
          </h1>

          <p className="auth-subtitle">
            Estamos validando tu acceso y sincronizando
            tus permisos con Pulpi.
          </p>
        </section>
      </main>
    )
  }

  if (currentUser) {
    return (
      <Menu
        user={currentUser}
        onLogout={() => {
          // Elimina la cookie HttpOnly y después la sesión local.
          void logout()
            .catch(() => undefined)
            .finally(() => {
              clearSession()
              setCurrentUser(null)
              setPassword('')
              setUsername('')
              setError('')

              setFieldErrors({
                username: '',
                password: ''
              })
            })
        }}
        onUserUpdate={(updatedUser) => {
          setCurrentUser(updatedUser)
          saveSession(updatedUser)
        }}
      />
    )
  }

  if (showRegister) {
    return (
      <Registro
        onBack={() => setShowRegister(false)}
        onRegistered={enterApp}
      />
    )
  }

  return (
    <main className="auth-page">
      <section
        className="auth-card"
        aria-labelledby="login-title"
      >
        <div
          className="auth-brand-mark"
          aria-hidden="true"
        >
          P
        </div>

        <p className="auth-eyebrow">
          TUS FINANZAS, EN ORDEN
        </p>

        <h1
          id="login-title"
          className="auth-title"
        >
          Bienvenido a Pulpi
        </h1>

        <p className="auth-subtitle">
          Inicia sesión para administrar tus ingresos y gastos.
        </p>

        <form
          className="auth-form"
          onSubmit={handleLogin}
          noValidate
        >
          <div className="field-group">
            <label htmlFor="username">
              Nombre de usuario
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                clearFieldError('username')
              }}
              placeholder="Ej. admin_pulpi"
              autoComplete="username"
              minLength={3}
              required
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={
                fieldErrors.username
                  ? 'username-error'
                  : undefined
              }
            />

            {fieldErrors.username && (
              <small
                id="username-error"
                className="field-error"
                role="alert"
              >
                {fieldErrors.username}
              </small>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="password">
              Contraseña
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearFieldError('password')
              }}
              placeholder="Escribe tu contraseña"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password
                  ? 'password-error'
                  : undefined
              }
            />

            {fieldErrors.password && (
              <small
                id="password-error"
                className="field-error"
                role="alert"
              >
                {fieldErrors.password}
              </small>
            )}
          </div>

          {error && (
            <p
              className="form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className="button button-primary button-full"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Verificando…'
              : 'Ingresar al sistema'}

            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="auth-divider">
          <span>o</span>
        </div>

        <p className="auth-register-prompt">
          ¿Todavía no tienes una cuenta?
        </p>

        <button
          className="button button-secondary button-full"
          type="button"
          onClick={() => setShowRegister(true)}
        >
          Crear una cuenta
        </button>

        <p className="auth-footer">
          Pulpi Finanzas · Managua, Nicaragua · 2026
        </p>
      </section>
    </main>
  )
}

export default App