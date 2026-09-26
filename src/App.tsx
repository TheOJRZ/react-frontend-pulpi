import { useState } from 'react'
import Registro from './Registro'
import Menu from './menu'
import './App.css'

function App() {
  const [irARegistro, setIrARegistro] = useState(false)
  const [irAMenu, setIrAMenu] = useState(false)

  // Si se presiona el enlace, muestra el formulario de Registro
  if (irARegistro) {
    return <Registro />
  }

  // Si se presiona "Crear Cuenta", redirige al Menu
  if (irAMenu) {
    return <Menu />
  }

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: '400px', borderRadius: '1rem' }}>
        <div className="card-body p-5">
          
          <div className="text-center mb-4">
            <h2 className="fw-bold text-success mb-1">Pulpi</h2>
            <p className="text-muted small">Control de Gastos e Ingresos</p>
          </div>

          <form>
            <div className="mb-3">
              {/* Cambiado de "Correo Electrónico" a "Nombre de Usuario" */}
              <label htmlFor="username" className="form-label fw-semibold text-secondary">
                Nombre de Usuario
              </label>
              {/* Tipo cambiado a "text" y placeholder actualizado */}
              <input 
                type="text" 
                className="form-control form-control-lg" 
                id="username" 
                placeholder="Ej. admin_pulpi" 
                autoComplete="username"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label fw-semibold text-secondary">
                Contraseña
              </label>
              <input 
                type="password" 
                className="form-control form-control-lg" 
                id="password" 
                placeholder="••••••••" 
                autoComplete="current-password"
              />
            </div>

            <button 
              type="button" 
              className="btn btn-success w-100 btn-lg mb-3 fw-bold shadow-sm"
              onClick={() => setIrAMenu(true)}
            >
              Ingresar al Sistema
            </button>

            {/* Enlace con etiqueta <a> para ir a Registro */}
            <div className="text-center mt-2">
              <span className="text-muted small">¿No tienes cuenta? </span>
              <a 
                href="#registro" 
                className="text-success fw-semibold small text-decoration-none"
                onClick={(e) => {
                  e.preventDefault()
                  setIrARegistro(true)
                }}
              >
                Regístrate aquí
              </a>
            </div>
          </form>

          <div className="text-center mt-4">
            <small className="text-muted">Managua, Nicaragua © 2026</small>
          </div>

        </div>
      </div>
    </div>
  )
}

export default App