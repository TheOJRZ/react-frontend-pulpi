# Pulpi Finanzas — React + TypeScript

Frontend de Pulpi conectado a la API REST ASP.NET Core y SQL Server.

## Requisitos

- Node.js 20 o posterior.
- API Pulpi en ejecución (por defecto `http://localhost:5266`).

## Configuración local

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Abre `http://localhost:5173`. Si la API usa otra dirección, cambia `VITE_API_URL` en `.env` y reinicia Vite. La variable debe apuntar al prefijo `/api`, por ejemplo `VITE_API_URL=http://localhost:5266/api`.

## Compilar y revisar

```powershell
npm run build
npm run lint
```

## Inicio de sesión y permisos

Al recargar la página, el frontend valida el JWT mediante `GET /api/auth/me` y actualiza el rol y el perfil con los datos actuales del backend. Si el token ha expirado, la cuenta fue desactivada o la API responde `401`, se limpia la sesión local y se muestra el inicio de sesión. Durante una sesión activa, el perfil se vuelve a sincronizar periódicamente; los permisos definitivos siempre los impone el backend.

- **Administrador**: acceso a transacciones globales, sesiones de caja, categorías, balances, reportes, auditoría y usuarios/roles.
- **Cajero**: acceso a sus transacciones y sesiones de caja; no se muestran balances, reportes, auditoría ni administración de usuarios/categorías.

Las categorías se cargan desde la API, no desde un arreglo estático del frontend. Los IDs son generados por la base de datos; no se solicitan ni se editan al crear registros.

## Primer administrador

El registro público asigna siempre el rol Cajero. Para inicializar un administrador, siga el procedimiento `scripts/asignar-administrador-inicial.sql` de la carpeta del backend y vuelva a iniciar sesión después de ejecutar el script.
