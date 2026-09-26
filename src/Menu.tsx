import { useState } from 'react'
import App from './App'
import './index.css'

function Menu() {
  const [irALogin, setIrALogin] = useState(false)

  // Si se presiona "Salir", regresa al Login
  if (irALogin) {
    return <App />
  }

  return (
    <div className="homepage-wrapper">
      
      {/* ================= NAVBAR ================= */}
      <nav className="homepage-navbar">
        <div className="homepage-nav-content">
          <div className="homepage-brand">
            <span className="brand-logo-text">Pulpi</span>
            <span className="brand-tag">Finanzas</span>
          </div>

          <div className="homepage-nav-links">
            <a href="#transacciones" className="nav-link-item active">Inicio</a>
            <a href="#transacciones" className="nav-link-item">Transacciones</a>
            <a href="#balances" className="nav-link-item">Balances</a>
            <a href="#clientes" className="nav-link-item">Clientes</a>
            <a href="#reportes" className="nav-link-item">Reportes</a>
          </div>

          <div className="homepage-user-menu">
            <div className="user-info">
              <span className="user-name">admin_pulpi</span>
              <span className="user-role">Administrador</span>
            </div>
            <div className="user-avatar">A</div>
            <button 
              className="btn-logout" 
              title="Cerrar sesión"
              onClick={() => setIrALogin(true)}
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO / BANNER ================= */}
      <header className="homepage-hero">
        <div className="hero-container">
          <div>
            <h1 className="hero-title">Panel de Control General</h1>
            <p className="hero-subtitle">
              Bienvenido al sistema. Supervisa la salud financiera, administra clientes y audita movimientos.
            </p>
          </div>
          <div className="hero-quick-actions">
            <button className="btn-hero-primary">+ Registrar Transacción</button>
            <button className="btn-hero-secondary">Descargar Cierre</button>
          </div>
        </div>
      </header>

      {/* ================= RESUMEN FINANCIERO (KPIs) ================= */}
      {/* <section className="homepage-section">
        <div className="section-container">
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-title">Balance Neto</span>
              <div className="kpi-amount text-success-custom">C$ 145,280.50</div>
              <span className="kpi-subtext">Actualizado en tiempo real</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-title">Ingresos del Mes</span>
              <div className="kpi-amount text-primary-custom">C$ 58,400.00</div>
              <span className="kpi-subtext">38 registros completados</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-title">Gastos Operativos</span>
              <div className="kpi-amount text-danger-custom">C$ 18,120.00</div>
              <span className="kpi-subtext">31% del presupuesto asignado</span>
            </div>
          </div>
        </div>
      </section> */}

      {/* ================= MÓDULOS DEL SISTEMA ================= */}
      <main className="homepage-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-heading">Áreas de Trabajo</h2>
            <p className="section-subheading">Accede a las herramientas operativas de Pulpi</p>
          </div>

          <div className="modules-grid">
            
            {/* 1. Transacciones */}
            <div className="module-item">
              <div className="module-top">
                <span className="module-badge green-badge">Operaciones</span>
                <span className="module-icon">💳</span>
              </div>
              <h3 className="module-title">Transacciones</h3>
              <p className="module-description">
                Control de ingresos y desembolsos diarios. Categorización por conceptos y métodos de pago.
              </p>
              <div className="module-footer">
                <button className="btn-module-action">Ingresar al Módulo →</button>
              </div>
            </div>

            {/* 2. Balances */}
            <div className="module-item">
              <div className="module-top">
                <span className="module-badge teal-badge">Cuentas</span>
                <span className="module-icon">📊</span>
              </div>
              <h3 className="module-title">Balances</h3>
              <p className="module-description">
                Arqueos de caja, conciliaciones con cuentas bancarias activas y balance de pérdidas y ganancias.
              </p>
              <div className="module-footer">
                <button className="btn-module-action">Consultar Balances →</button>
              </div>
            </div>

            {/* 3. Clientes */}
            <div className="module-item">
              <div className="module-top">
                <span className="module-badge blue-badge">Comercial</span>
                <span className="module-icon">👥</span>
              </div>
              <h3 className="module-title">Clientes</h3>
              <p className="module-description">
                Cartera de clientes, estados de cuenta individuales y gestión de cobros pendientes.
              </p>
              <div className="module-footer">
                <button className="btn-module-action">Gestionar Cartera →</button>
              </div>
            </div>

            {/* 4. Reportes */}
            <div className="module-item">
              <div className="module-top">
                <span className="module-badge amber-badge">Auditoría</span>
                <span className="module-icon">📈</span>
              </div>
              <h3 className="module-title">Reportes</h3>
              <p className="module-description">
                Generación de balances en PDF y Excel para auditorías internas o cierres fiscales mensuales.
              </p>
              <div className="module-footer">
                <button className="btn-module-action">Crear Informe →</button>
              </div>
            </div>

            {/* 5. Gestión de Usuario */}
            <div className="module-item">
              <div className="module-top">
                <span className="module-badge purple-badge">Seguridad</span>
                <span className="module-icon">⚙️</span>
              </div>
              <h3 className="module-title">Usuario y Roles</h3>
              <p className="module-description">
                Ajustes de perfil, credenciales de acceso, permisos de cajeros y registro de auditoría.
              </p>
              <div className="module-footer">
                <button className="btn-module-action">Configuración →</button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="homepage-footer">
        <div className="section-container footer-content">
          <span>Pulpi • Control de Gastos e Ingresos</span>
          <span>Managua, Nicaragua © 2026</span>
        </div>
      </footer>

    </div>
  )
}

export default Menu