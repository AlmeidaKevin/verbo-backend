const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');
const { enviarEmail } = require('../services/emailService');

const SUPER_ADMIN_EMAIL = 'almeidakevin783@gmail.com';

// GET /api/usuarios
const listarUsuarios = async (req, res) => {
  try {
    const { rol } = req.query;
    let query = supabase
      .from('usuarios')
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, estado, email_verificado, created_at')
      .order('nombre_completo');

    if (rol) query = query.eq('rol', rol);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, usuarios: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al listar usuarios', error: err.message });
  }
};

// GET /api/usuarios/:id
const obtenerUsuario = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, estado, email_verificado, created_at')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, usuario: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/usuarios/:id (solo admin)
const actualizarUsuario = async (req, res) => {
  try {
    const { nombre_completo, cedula, email, telefono, rol, activo, estado } = req.body;

    const { data: target } = await supabase
      .from('usuarios')
      .select('rol, email, email_verificado')
      .eq('id', req.params.id)
      .single();

    const esSuperAdmin       = req.usuario?.email === SUPER_ADMIN_EMAIL;
    const esUnoMismo         = String(req.usuario?.id) === String(req.params.id);
    const targetEsSuperAdmin = target?.email === SUPER_ADMIN_EMAIL;

    if (target?.rol === 'admin') {
      const intentaCambiarEstado = estado !== undefined || activo !== undefined;

      if (targetEsSuperAdmin && esUnoMismo) {
        if (intentaCambiarEstado) {
          return res.status(403).json({ success: false, message: 'El super administrador siempre permanece activo' });
        }
      } else if (!esSuperAdmin && !esUnoMismo) {
        return res.status(403).json({ success: false, message: 'No se puede modificar el estado de otro administrador' });
      }
    }

    const updates = {};
    if (nombre_completo) updates.nombre_completo = nombre_completo.trim();
    if (cedula) updates.cedula = cedula.trim();
    if (telefono) updates.telefono = telefono.trim();
    if (rol) updates.rol = rol;

    // Manejo de estado
    if (estado) {
      updates.estado = estado;
      if (estado === 'desactivada') updates.activo = false;
      else updates.activo = true;
    } else if (activo !== undefined) {
      updates.activo = activo;
      updates.estado = activo ? 'activada' : 'desactivada';
    }

    // Cambio de email: requiere nueva verificación
    const emailNuevo = email ? email.toLowerCase().trim() : null;
    const cambioEmail = emailNuevo && emailNuevo !== target?.email;
    let verification_token = null;

    if (cambioEmail) {
      verification_token = crypto.randomBytes(32).toString('hex');
      updates.email = emailNuevo;
      updates.estado = 'pendiente';
      updates.email_verificado = false;
      updates.verification_token = verification_token;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, estado, email_verificado')
      .single();

    if (error) throw error;

    if (cambioEmail) {
      const verificarUrl = `${process.env.FRONTEND_URL}/verificar-cuenta/${verification_token}`;
      try {
        await enviarEmail({
          to: data.email,
          subject: 'Verifica tu nuevo correo - Escuela Dominical Verbo Mañosca',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:12px">
              <div style="background:#1F4E5F;padding:24px;border-radius:10px 10px 0 0;text-align:center">
                <h2 style="color:#ffffff;margin:0">Escuela Dominical</h2>
                <p style="color:#9EC5D0;margin:8px 0 0">Iglesia Cristiana Verbo Mañosca</p>
              </div>
              <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px">
                <p style="color:#333">Hola <strong>${data.nombre_completo}</strong>,</p>
                <p style="color:#333">Se ha actualizado el correo electrónico de tu cuenta a <strong>${data.email}</strong>.</p>
                <p style="color:#555">Por seguridad, verifica este nuevo correo haciendo clic en el botón de abajo antes de volver a iniciar sesión:</p>
                <div style="text-align:center;margin:28px 0">
                  <a href="${verificarUrl}" style="background:#1F4E5F;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">
                    ✅ Verificar mi cuenta
                  </a>
                </div>
                <p style="color:#888;font-size:12px">Si no puedes hacer clic, copia este enlace en tu navegador:<br>${verificarUrl}</p>
                <p style="color:#888;font-size:12px;margin-top:16px">Si no reconoces este cambio, contacta al administrador del sistema.</p>
              </div>
            </div>
          `,
        });
        console.log('✅ Email de verificación (cambio de correo) enviado a:', data.email);
      } catch (emailErr) {
        console.error('❌ EMAIL ERROR (cambio de correo):', {
          message: emailErr.message,
          code: emailErr.code,
          command: emailErr.command,
          response: emailErr.response,
          responseCode: emailErr.responseCode,
        });
      }
    }

    res.json({ success: true, usuario: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/usuarios/:id (solo admin — desactivar, nunca eliminar)
const eliminarUsuario = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.usuario.id))
      return res.status(400).json({ success: false, message: 'No puedes desactivarte a ti mismo' });

    const { data: target } = await supabase
      .from('usuarios').select('rol, email').eq('id', req.params.id).single();

    const esSuperAdmin = req.usuario?.email === SUPER_ADMIN_EMAIL;
    const targetEsSuperAdmin = target?.email === SUPER_ADMIN_EMAIL;

    if (targetEsSuperAdmin)
      return res.status(403).json({ success: false, message: 'No se puede desactivar al super administrador' });

    if (target?.rol === 'admin' && !esSuperAdmin)
      return res.status(403).json({ success: false, message: 'No se puede desactivar a un administrador' });

    await supabase.from('usuarios')
      .update({ activo: false, estado: 'desactivada' })
      .eq('id', req.params.id);

    res.json({ success: true, message: 'Usuario desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/usuarios/:id/foto
const subirFotoPerfil = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No se proporcionó imagen' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `perfil_${req.usuario.id}_${Date.now()}.${ext}`;
    const url = await subirArchivo('fotos-perfil', fileName, req.file.buffer, req.file.mimetype);

    await supabase.from('usuarios').update({ foto_url: url }).eq('id', req.usuario.id);
    res.json({ success: true, foto_url: url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listarUsuarios, obtenerUsuario, actualizarUsuario, eliminarUsuario, subirFotoPerfil };
