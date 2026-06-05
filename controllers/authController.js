const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { enviarEmail } = require('../services/emailService');

const generarToken = (id, rol) =>
  jwt.sign({ id, rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('activo', true)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario.id, usuario.rol);
    const { password_hash, reset_token, reset_token_expires, ...usuarioSeguro } = usuario;

    res.json({ success: true, token, usuario: usuarioSeguro });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error en el servidor', error: err.message });
  }
};

// POST /api/auth/crear-usuario  (solo admin)
const crearUsuario = async (req, res) => {
  try {
    const { nombre_completo, cedula, email, telefono, password, rol } = req.body;

    // Verificar duplicados
    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .or(`email.eq.${email},cedula.eq.${cedula}`)
      .single();

    if (existe) {
      return res.status(400).json({ success: false, message: 'Ya existe un usuario con ese email o cédula' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: nuevo, error } = await supabase
      .from('usuarios')
      .insert({
        nombre_completo: nombre_completo.trim(),
        cedula: cedula.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono.trim(),
        password_hash,
        rol,
      })
      .select('id, nombre_completo, email, rol, cedula, telefono, activo, created_at')
      .single();

    if (error) throw error;


    // Intentar enviar correo
    try {
      await enviarEmail({
        to: email,
        subject: 'Bienvenido - Escuela Dominical Verbo Mañosca',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
            <h2 style="color:#6366f1">¡Bienvenido a la Escuela Dominical!</h2>
            <p>Hola <strong>${nombre_completo}</strong>, tu cuenta ha sido creada.</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Contraseña temporal:</strong> ${password}</p>
            <p><strong>Rol:</strong> ${rol}</p>
  
            <a href="${process.env.FRONTEND_URL}/login"
               style="background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;margin-top:16px">
              Iniciar Sesión
            </a>
  
            <p style="margin-top:20px;color:#888;font-size:12px">
              Por seguridad, cambia tu contraseña al ingresar.
            </p>
          </div>
        `,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Usuario creado pero el correo no pudo enviarse',
        error: error.message,
        usuario: nuevo
      });
    }
  
    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      usuario: nuevo
    });
  
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: err.message
    });
  }

  
// POST /api/auth/olvide-password
const olvidéPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Siempre responder igual para no revelar si existe el email
    if (!usuario) {
      return res.json({ success: true, message: 'Si el email existe, recibirás un enlace' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await supabase
      .from('usuarios')
      .update({ reset_token: token, reset_token_expires: expires.toISOString() })
      .eq('id', usuario.id);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await enviarEmail({
      to: email,
      subject: 'Recuperar contraseña - Escuela Dominical',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
          <h2 style="color:#6366f1">Recuperar contraseña</h2>
          <p>Hola <strong>${usuario.nombre_completo}</strong></p>
          <p>Haz clic en el siguiente enlace para restablecer tu contraseña. Válido por 1 hora.</p>
          <a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">
            Restablecer contraseña
          </a>
          <p style="margin-top:20px;color:#888;font-size:12px">Si no solicitaste esto, ignora este email.</p>
        </div>
      `,
    });

    res.json({ success: true, message: 'Si el email existe, recibirás un enlace' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al procesar solicitud', error: err.message });
  }
};

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('reset_token', token)
      .gt('reset_token_expires', new Date().toISOString())
      .single();

    if (!usuario) {
      return res.status(400).json({ success: false, message: 'Token inválido o expirado' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await supabase
      .from('usuarios')
      .update({ password_hash, reset_token: null, reset_token_expires: null })
      .eq('id', usuario.id);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al resetear contraseña', error: err.message });
  }
};

// GET /api/auth/perfil
const obtenerPerfil = async (req, res) => {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, created_at')
      .eq('id', req.usuario.id)
      .single();
    res.json({ success: true, usuario });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener perfil', error: err.message });
  }
};

// PUT /api/auth/perfil
const actualizarPerfil = async (req, res) => {
  try {
    const { nombre_completo, telefono } = req.body;
    const updates = {};
    if (nombre_completo) updates.nombre_completo = nombre_completo.trim();
    if (telefono) updates.telefono = telefono.trim();

    const { data: actualizado, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', req.usuario.id)
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url')
      .single();

    if (error) throw error;
    res.json({ success: true, usuario: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar perfil', error: err.message });
  }
};

// PUT /api/auth/cambiar-password
const cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('password_hash')
      .eq('id', req.usuario.id)
      .single();

    const valida = await bcrypt.compare(password_actual, usuario.password_hash);
    if (!valida) {
      return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password_nuevo, salt);

    await supabase.from('usuarios').update({ password_hash }).eq('id', req.usuario.id);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al cambiar contraseña', error: err.message });
  }
};

module.exports = { login, crearUsuario, olvidéPassword, resetPassword, obtenerPerfil, actualizarPerfil, cambiarPassword };
