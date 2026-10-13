import { useState, type FormEvent } from 'react'
import { register } from './api'
import type { User } from './types'

interface RegistroProps {
  onBack: () => void
  onRegistered: (user: User) => void
}

type RegisterField = 'fullName' | 'username' | 'email' | 'password' | 'confirmPassword'
type RegisterFieldErrors = Record<RegisterField, string>
const EMPTY_FIELD_ERRORS: RegisterFieldErrors = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function Registro({ onBack, onRegistered }: RegistroProps) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>(EMPTY_FIELD_ERRORS)
  const [busy, setBusy] = useState(false)

  const clearFieldError = (field: RegisterField) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: '',
      ...(field === 'password' ? { confirmPassword: '' } : {}),
    }))
    setError('')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const normalizedFullName = fullName.trim()
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedEmail = email.trim().toLowerCase()
    const nextErrors: RegisterFieldErrors = { ...EMPTY_FIELD_ERRORS }

    if (!normalizedFullName) nextErrors.fullName = 'Escribe tu nombre completo.'
    else if (normalizedFullName.length < 2 || normalizedFullName.length > 150 || !/^[\p{L}\p{M}]+(?:[ '\\-][\p{L}\p{M}]+)*$/u.test(normalizedFullName)) nextErrors.fullName = 'Usa un nombre de 2 a 150 caracteres, con letras, espacios, apóstrofes o guiones.'
    if (!normalizedUsername) nextErrors.username = 'Escribe un nombre de usuario.'
    else if (!/^[a-z0-9._]{3,24}$/.test(normalizedUsername)) {
      nextErrors.username = 'Usa entre 3 y 24 caracteres: letras, números, punto o guion bajo.'
    }
    if (!normalizedEmail) nextErrors.email = 'Escribe tu correo electrónico.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Escribe un correo electrónico válido, por ejemplo nombre@ejemplo.com.'
    }
    if (!password) nextErrors.password = 'Escribe una contraseña.'
    else if (password.length < 8 || password.length > 72) nextErrors.password = 'La contraseña debe tener entre 8 y 72 caracteres.'
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirma tu contraseña.'
    else if (password !== confirmPassword) nextErrors.confirmPassword = 'Las contraseñas no coinciden.'

    setFieldErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setBusy(true)
    try {
      const user = await register({
        fullName: normalizedFullName,
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        confirmPassword,
      })
      onRegistered(user)
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'No fue posible crear la cuenta. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page auth-page-register">
      <section className="auth-card auth-card-wide" aria-labelledby="register-title">
        <div className="auth-brand-mark" aria-hidden="true">P</div>
        <p className="auth-eyebrow">EMPIEZA A ORGANIZARTE</p>
        <h1 id="register-title" className="auth-title">Crea tu cuenta</h1>
        <p className="auth-subtitle">Regístrate para llevar un mejor control de tus finanzas.</p>

        <form className="auth-form" onSubmit={handleRegister} noValidate>
          <div className="field-group">
            <label htmlFor="fullName">Nombre completo</label>
            <input id="fullName" name="fullName" type="text" value={fullName} onChange={(event) => { setFullName(event.target.value); clearFieldError('fullName') }} placeholder="Ej. Carlos Mendoza" autoComplete="name" maxLength={150} required aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined} />
            {fieldErrors.fullName && <small id="fullName-error" className="field-error" role="alert">{fieldErrors.fullName}</small>}
          </div>
          <div className="field-group">
            <label htmlFor="newUsername">Nombre de usuario</label>
            <input id="newUsername" name="username" type="text" value={username} onChange={(event) => { setUsername(event.target.value); clearFieldError('username') }} placeholder="Ej. carlos_mendoza" autoComplete="username" minLength={3} maxLength={24} required aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? 'newUsername-error' : 'newUsername-hint'} />
            {fieldErrors.username
              ? <small id="newUsername-error" className="field-error" role="alert">{fieldErrors.username}</small>
              : <small id="newUsername-hint">De 3 a 24 caracteres: letras, números, punto o guion bajo.</small>}
          </div>
          <div className="field-group">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email') }} placeholder="carlos@ejemplo.com" autoComplete="email" maxLength={100} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />
            {fieldErrors.email && <small id="email-error" className="field-error" role="alert">{fieldErrors.email}</small>}
          </div>
          <div className="field-group">
            <label htmlFor="newPassword">Contraseña</label>
            <input id="newPassword" name="password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password') }} placeholder="Entre 8 y 72 caracteres" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'newPassword-error' : undefined} />
            {fieldErrors.password && <small id="newPassword-error" className="field-error" role="alert">{fieldErrors.password}</small>}
          </div>
          <div className="field-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearFieldError('confirmPassword') }} placeholder="Repite la contraseña" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined} />
            {fieldErrors.confirmPassword && <small id="confirmPassword-error" className="field-error" role="alert">{fieldErrors.confirmPassword}</small>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-full" type="submit" disabled={busy}>
            {busy ? 'Creando cuenta…' : 'Crear cuenta'} <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="auth-register-prompt register-bottom-prompt">¿Ya tienes una cuenta?</p>
        <button className="button button-secondary button-full" type="button" onClick={onBack}>Volver al inicio de sesión</button>
        <p className="auth-footer">Tu cuenta se registra de forma segura en el servidor de Pulpi.</p>
      </section>
    </main>
  )
}

export default Registro
