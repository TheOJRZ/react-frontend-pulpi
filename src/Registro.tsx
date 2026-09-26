import { useState } from 'react'
import App from './App'
import Menu from './menu'
import './App.css'

function Registro() {
  const [irALogin, setIrALogin] = useState(false)
  const [irAMenu, setIrAMenu] = useState(false)

  // Si se presiona el enlace, muestra el formulario de Login
  if (irALogin) {
    return <App />
  }

  // Si se presiona "Crear Cuenta", redirige al Menu
  if (irAMenu) {
    return <Menu />
  }

  return (
    // Se usa 'min-vh-100' y 'py-4' en lugar de 'vh-100' para que en pantallas pequeñas
    // el formulario no se corte al tener más campos.
    <div className="container d-flex justify-content-center align-items-center min-vh-100 bg-light py-4">
      <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: '460px', borderRadius: '1rem' }}>
        <div className="card-body p-4 p-md-5">
          
          {/* Encabezado */}
          <div className="text-center mb-4">
            <h2 className="fw-bold text-success mb-1">Registro Pulpi</h2>
            <p className="text-muted small">Crea tu cuenta para gestionar tus finanzas</p>
          </div>

          <form>
            {/* 1. Nombre Completo */}
            <div className="mb-3">
              <label htmlFor="fullName" className="form-label fw-semibold text-secondary">
                Nombre Completo
              </label>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                id="fullName" 
                placeholder="Ej. Carlos Mendoza" 
                autoComplete="name"
              />
            </div>

            {/* 2. Nombre de Usuario */}
            <div className="mb-3">
              <label htmlFor="username" className="form-label fw-semibold text-secondary">
                Nombre de Usuario
              </label>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                id="username" 
                placeholder="Ej. carlos_mendoza" 
                autoComplete="username"
              />
            </div>

            {/* 3. Correo Electrónico */}
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-semibold text-secondary">
                Correo Electrónico
              </label>
              <input 
                type="email" 
                className="form-control form-control-lg" 
                id="email" 
                placeholder="carlos@ejemplo.com" 
                autoComplete="email"
              />
            </div>

            {/* 4. Contraseña */}
            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold text-secondary">
                Contraseña
              </label>
              <input 
                type="password" 
                className="form-control form-control-lg" 
                id="password" 
                placeholder="••••••••" 
                autoComplete="new-password"
              />
            </div>

            {/* 5. Confirmar Contraseña */}
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="form-label fw-semibold text-secondary">
                Confirmar Contraseña
              </label>
              <input 
                type="password" 
                className="form-control form-control-lg" 
                id="confirmPassword" 
                placeholder="••••••••" 
                autoComplete="new-password"
              />
            </div>

            {/* Botón de Registro */}
            <button 
              type="button" 
              className="btn btn-success w-100 btn-lg mb-3 fw-bold shadow-sm"
              onClick={() => setIrAMenu(true)}
            >
              Crear Cuenta
            </button>

            {/* Enlace para volver al Login */}
            <div className="text-center mt-2">
              <span className="text-muted small">¿Ya tienes una cuenta? </span>
              <a 
                href="#login" 
                className="text-success fw-semibold small text-decoration-none"
                onClick={(e) => {
                  e.preventDefault()
                  setIrALogin(true)
                }}
              >
                Inicia Sesión
              </a>
            </div>
          </form>

          {/* Pie de página */}
          <div className="text-center mt-4">
            <small className="text-muted">Managua, Nicaragua © 2026</small>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Registro