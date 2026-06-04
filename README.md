# 📖 Sistema Escuela Dominical - Verbo Mañosca

## Estructura de repositorios
- `verbo-backend/` → Node.js + Express + Supabase
- `verbo-frontend/` → React + Tailwind CSS

---

## 🗄️ PASO 1 — Configurar Supabase

1. Ir a https://supabase.com y crear un proyecto nuevo.
2. En **SQL Editor**, pegar y ejecutar todo el contenido de `verbo-backend/config/schema.sql`.
3. En **Storage**, crear tres buckets:
   - `fotos-perfil` → marcar como **Public**
   - `archivos-tareas` → marcar como **Private**
   - `archivos-publicaciones` → marcar como **Private**
4. Copiar desde **Settings > API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon public key` → `SUPABASE_ANON_KEY`

---

## ⚙️ PASO 2 — Backend (VS Code)

```bash
cd verbo-backend
npm install

# Copiar y editar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# Ejecutar en desarrollo
npm run dev
```

### Variables .env del backend:
```
PORT=5000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=tu_clave_super_secreta_aqui
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx   ← App Password de Gmail
EMAIL_FROM="Escuela Dominical <tu@gmail.com>"
FRONTEND_URL=https://tu-app.vercel.app
HUGGINGFACE_API_KEY=hf_xxxxxxxx
```

### Configurar Gmail App Password:
1. Ir a https://myaccount.google.com/security
2. Activar verificación en 2 pasos
3. Ir a "Contraseñas de aplicación"
4. Generar una nueva → copiar los 16 caracteres

---

## 🤖 PASO 3 — HuggingFace (IA para tareas)

1. Crear cuenta en https://huggingface.co
2. Ir a https://huggingface.co/settings/tokens
3. Crear un **token de acceso** de tipo "read"
4. Copiarlo como `HUGGINGFACE_API_KEY` en tu `.env`
5. El modelo usado es `mistralai/Mistral-7B-Instruct-v0.3` (gratuito, sin límite de velocidad estricto)

---

## 💻 PASO 4 — Frontend (VS Code)

```bash
cd verbo-frontend
npm install

cp .env.example .env
# Editar .env
```

### Variables .env del frontend:
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

```bash
npm start   # desarrollo en http://localhost:3000
npm run build  # build para producción
```

---

## 🚀 PASO 5 — Desplegar en Vercel (Frontend)

1. Subir `verbo-frontend` a un repositorio GitHub **separado**
2. Ir a https://vercel.com → "Add New Project" → importar el repo
3. En **Environment Variables**, agregar las 3 variables REACT_APP_*
4. Deploy automático

### Actualizar backend con la URL de Vercel:
```
FRONTEND_URL=https://tu-app-nombre.vercel.app
```

---

## 🚀 PASO 6 — Desplegar Backend (Railway / Render)

### En Railway:
1. Subir `verbo-backend` a otro repositorio GitHub
2. https://railway.app → "New Project" → "Deploy from GitHub"
3. Agregar todas las variables de entorno del `.env`
4. El start command es: `node server.js`

### Actualizar frontend:
```
REACT_APP_API_URL=https://tu-backend.railway.app/api
```

---

## 👤 Credenciales del admin por defecto

```
Email:    almeidakevin783@gmail.com
Password: Sagitario29$
```
> ⚠️ Cambiar la contraseña inmediatamente después del primer login.

---

## 📱 Roles del sistema

| Rol | Acceso |
|-----|--------|
| **Admin** | Todo: usuarios, reuniones, grupos, checklist, publicaciones, reportes |
| **Docente/Líder** | Sus grupos, checklist, tareas, ver publicaciones |
| **Ayudante** | Checklist (si tiene permiso del docente/admin), ver perfil |
| **Público (niños)** | Página `/` sin login — contenido semanal |

---

## 📦 Librerías instaladas

### Backend:
| Paquete | Uso |
|---------|-----|
| `@supabase/supabase-js` | Base de datos y storage |
| `express` | Framework HTTP |
| `bcryptjs` | Encriptar contraseñas |
| `jsonwebtoken` | Autenticación JWT |
| `express-validator` | Validación de campos |
| `nodemailer` | Envío de emails |
| `node-cron` | Recordatorios automáticos (sábados 8am) |
| `multer` | Subida de archivos |
| `xlsx` | Exportar Excel |
| `cors` | Permitir peticiones del frontend |
| `morgan` | Logger de requests |
| `dotenv` | Variables de entorno |

### Frontend:
| Paquete | Uso |
|---------|-----|
| `react` + `react-dom` | UI |
| `react-router-dom` | Navegación SPA |
| `react-hook-form` | Formularios con validación |
| `axios` | Peticiones HTTP |
| `react-hot-toast` | Notificaciones UI |
| `react-icons` | Iconos (FI set) |
| `tailwindcss` | Estilos utilitarios |
| `xlsx` | Exportar Excel en cliente |
| `date-fns` | Formato de fechas |
