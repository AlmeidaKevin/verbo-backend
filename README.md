# Sistema Escuela Dominical — Iglesia Cristiana Verbo Mañosca

Guía de instalación, configuración y despliegue del sistema completo (backend y frontend).

## 📺 Manual de usuario

- **YouTube:** https://youtu.be/STA7XPuSRTE
- **Google Drive** (mismo video): https://drive.google.com/file/d/1YNoMLMT_BxqqWNlygKyz-fJWt71Al-Fm/view?usp=drive_link

---

## Estructura de repositorios

- `verbo-backend/` — Node.js + Express + Supabase
- `verbo-frontend/` — React + Tailwind CSS

---

## Paso 1 — Configurar Supabase

1. Crear un proyecto nuevo en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar y ejecutar el contenido de `verbo-backend/config/schema.sql`.
3. En **Storage**, crear los siguientes buckets:

   | Bucket | Visibilidad | Contenido |
   |---|---|---|
   | `fotos-perfil` | Público | Fotos de perfil de usuario |
   | `archivos-publicaciones` | Privado | Archivos adjuntos a publicaciones |
   | `archivos-tareas` | Privado | Archivos adjuntos a tareas |
   | `archivos-chat` | Privado | Archivos enviados en la mensajería interna |

4. Copiar desde **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon public key` → `SUPABASE_ANON_KEY`

---

## Paso 2 — Backend

```bash
cd verbo-backend
npm install

cp .env.example .env
# Editar .env con los valores reales
```

### Variables de entorno del backend

```env
PORT=5000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=tu_clave_secreta
JWT_EXPIRES_IN=7d
SENDGRID_API_KEY=SG.xxxxxxxx
EMAIL_FROM="Escuela Dominical <notificaciones@tudominio.com>"
FRONTEND_URL=https://tu-frontend.onrender.com
```

### Configurar SendGrid (envío de correos)

Render bloquea las conexiones SMTP salientes, por lo que el envío de correos (verificación de cuenta y recuperación de contraseña) se realiza mediante la API HTTP de SendGrid en lugar de SMTP tradicional.

1. Crear una cuenta en [sendgrid.com](https://sendgrid.com).
2. Verificar un remitente único (*Single Sender Verification*) con el correo que aparecerá como emisor.
3. Ir a **Settings → API Keys** y crear una clave con permisos de *Mail Send*.
4. Copiarla como `SENDGRID_API_KEY` en el `.env`.

```bash
npm run dev   # Ejecuta el servidor en modo desarrollo
```

---

## Paso 3 — Frontend

```bash
cd verbo-frontend
npm install

cp .env.example .env
# Editar .env con los valores reales
```

### Variables de entorno del frontend

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

```bash
npm start       # Desarrollo en http://localhost:3000
npm run build    # Build para producción
```

---

## Paso 4 — Desplegar el backend en Render

1. Subir `verbo-backend` a un repositorio de GitHub.
2. En [render.com](https://render.com) → **New → Web Service** → importar el repositorio.
3. Agregar todas las variables de entorno del `.env`.
4. Comando de inicio: `node server.js`.
5. Render asigna una URL propia (ej. `https://verbo-backend.onrender.com`); Render la redespliega automáticamente en cada commit sobre la rama principal.

---

## Paso 5 — Desplegar el frontend en Render

1. Subir `verbo-frontend` a un repositorio de GitHub (puede ser el mismo u otro, según tu preferencia).
2. En Render → **New → Static Site** (o **Web Service**, según cómo lo sirvas) → importar el repositorio.
3. Agregar las variables `REACT_APP_*` en **Environment**.
4. Configurar una regla de reescritura (*rewrite rule*) que redirija todas las rutas a `index.html`, para que la navegación de React Router funcione correctamente al acceder directamente mediante una URL.

### Actualizar las URLs cruzadas

Una vez desplegados ambos servicios, actualiza en cada uno la URL real del otro:

```env
# En el backend
FRONTEND_URL=https://verbo-frontend.onrender.com

# En el frontend
REACT_APP_API_URL=https://verbo-backend.onrender.com/api
```

---

## Credenciales del administrador por defecto

```
Email:     almeidakevin783@gmail.com
Password:  Sagitario29$
```

> ⚠️ **Cambiar la contraseña inmediatamente** después del primer inicio de sesión. Se recomienda además no incluir credenciales reales en un README que vaya a un repositorio público; considera mover este bloque a un documento privado o a un gestor de secretos antes de publicar el repositorio.

---

## Roles del sistema

| Rol | Acceso |
|---|---|
| **Administrador** | Usuarios, reuniones, grupos, checklist, publicaciones, reportes. El **super administrador** además puede modificar el estado de otros administradores (el suyo propio permanece siempre activo). |
| **Docente / Líder** | Sus grupos, checklist, tareas, publicaciones, mensajería. |
| **Ayudante** | Checklist (si el docente lo habilita para su grupo), avisos, mensajería. |
| **Público (niños)** | Página `/`, sin inicio de sesión — contenido semanal de reuniones y grupos. |

---

## Librerías instaladas

### Backend

| Paquete | Uso |
|---|---|
| `@supabase/supabase-js` | Base de datos, autenticación y storage |
| `express` | Framework HTTP |
| `bcryptjs` | Cifrado de contraseñas |
| `jsonwebtoken` | Autenticación mediante JWT |
| `express-validator` | Validación de campos |
| `@sendgrid/mail` | Envío de correos mediante API HTTP |
| `node-cron` | Tareas programadas |
| `multer` | Subida de archivos |
| `pdfkit` | Exportación de reportes en PDF |
| `exceljs` | Exportación de reportes en Excel |
| `cors` | Habilitar peticiones desde el frontend |
| `morgan` | Registro (logging) de solicitudes |
| `dotenv` | Variables de entorno |

### Frontend

| Paquete | Uso |
|---|---|
| `react` + `react-dom` | Interfaz de usuario |
| `react-router-dom` | Navegación de la aplicación de una sola página (SPA) |
| `react-hook-form` | Formularios y validación |
| `axios` | Peticiones HTTP al backend |
| `@supabase/supabase-js` | Suscripción a eventos en tiempo real (Realtime) |
| `react-hot-toast` | Notificaciones en la interfaz |
| `react-icons` | Iconografía (set Feather/`fi`) |
| `tailwindcss` | Estilos utilitarios |
| `date-fns` | Formato de fechas |
