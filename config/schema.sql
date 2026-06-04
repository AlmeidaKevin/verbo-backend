-- ============================================================
-- ESQUEMA COMPLETO - ESCUELA DOMINICAL VERBO MAÑOSCA
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: usuarios (admins, docentes, ayudantes)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_completo TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  telefono TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'docente', 'ayudante')),
  foto_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reuniones (clases con horario)
-- ============================================================
CREATE TABLE IF NOT EXISTS reuniones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: grupos (dentro de una reunión)
-- ============================================================
CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  reunion_id UUID NOT NULL REFERENCES reuniones(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ayudante1_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ayudante2_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  edad_min INTEGER NOT NULL CHECK (edad_min >= 0),
  edad_max INTEGER NOT NULL CHECK (edad_max > 0),
  ayudantes_checklist BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (edad_max > edad_min)
);

-- ============================================================
-- TABLA: ninos
-- ============================================================
CREATE TABLE IF NOT EXISTS ninos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_completo TEXT NOT NULL,
  fecha_nacimiento DATE,
  edad INTEGER,
  grupo_id UUID REFERENCES grupos(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: registros_asistencia (sesión de checklist)
-- ============================================================
CREATE TABLE IF NOT EXISTS registros_asistencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reunion_id UUID NOT NULL REFERENCES reuniones(id),
  grupo_id UUID NOT NULL REFERENCES grupos(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  registrado_por UUID REFERENCES usuarios(id),
  hora_primer_visto TIMESTAMPTZ,
  hora_ultimo_visto TIMESTAMPTZ,
  guardado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: asistencias (detalle por niño)
-- ============================================================
CREATE TABLE IF NOT EXISTS asistencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registro_id UUID NOT NULL REFERENCES registros_asistencia(id) ON DELETE CASCADE,
  nino_id UUID NOT NULL REFERENCES ninos(id),
  hora_llegada TIMESTAMPTZ,
  llego_tarde BOOLEAN DEFAULT FALSE,
  comentario TEXT,
  orden_llegada INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: tareas (publicadas por docentes)
-- ============================================================
CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  reunion_id UUID REFERENCES reuniones(id),
  grupo_id UUID REFERENCES grupos(id),
  publicado_por UUID NOT NULL REFERENCES usuarios(id),
  generado_por_ia BOOLEAN DEFAULT FALSE,
  archivos JSONB DEFAULT '[]',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: publicaciones (admin para docentes/ayudantes)
-- ============================================================
CREATE TABLE IF NOT EXISTS publicaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  publicado_por UUID NOT NULL REFERENCES usuarios(id),
  tipo_destinatario TEXT NOT NULL CHECK (tipo_destinatario IN ('todos', 'solo_docentes', 'solo_ayudantes', 'por_grupo', 'individual')),
  destinatarios_ids UUID[] DEFAULT '{}',
  archivos JSONB DEFAULT '[]',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: notificaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT FALSE,
  tipo TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_grupos_reunion ON grupos(reunion_id);
CREATE INDEX IF NOT EXISTS idx_grupos_docente ON grupos(docente_id);
CREATE INDEX IF NOT EXISTS idx_ninos_grupo ON ninos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_registro ON asistencias(registro_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros_asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER trigger_usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_reuniones_updated BEFORE UPDATE ON reuniones FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_grupos_updated BEFORE UPDATE ON grupos FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_ninos_updated BEFORE UPDATE ON ninos FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_tareas_updated BEFORE UPDATE ON tareas FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trigger_publicaciones_updated BEFORE UPDATE ON publicaciones FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- ADMIN POR DEFECTO
-- Contraseña: Sagitario29$  (bcrypt hash)
-- ============================================================
INSERT INTO usuarios (nombre_completo, cedula, email, telefono, password_hash, rol)
VALUES (
  'Kevin Almeida',
  '0000000000',
  'almeidakevin783@gmail.com',
  '0999999999',
  '$2a$10$rQZ9QmJSKqEcGQI5fJkM5.8kU9LmZg7N3pX1vY2wA4dB6cE8hF0iK',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STORAGE BUCKET para archivos
-- Ejecutar también esto:
-- ============================================================
-- En el dashboard de Supabase > Storage, crear los buckets:
-- 1. "fotos-perfil"     (público)
-- 2. "archivos-tareas"  (privado)
-- 3. "archivos-publicaciones" (privado)
