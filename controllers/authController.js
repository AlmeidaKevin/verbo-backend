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
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !usuario)
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida)
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    // Verificar estado
    if (usuario.estado === 'pendiente')
      return res.status(403).json({ success: false, message: 'Primero verifica tu cuenta para acceder. Revisa tu correo electrónico.', codigo: 'PENDIENTE' });

    if (usuario.estado === 'desactivada' || !usuario.activo)
      return res.status(403).json({ success: false, message: 'Tu cuenta ha sido desactivada. Contacta al administrador.', codigo: 'DESACTIVADA' });

    const token = generarToken(usuario.id, usuario.rol);
    const { password_hash, reset_token, reset_token_expires, verification_token, ...usuarioSeguro } = usuario;

    res.json({ success: true, token, usuario: usuarioSeguro });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error en el servidor', error: err.message });
  }
};

// POST /api/auth/crear-usuario (solo admin)
const crearUsuario = async (req, res) => {
  try {
    const { nombre_completo, cedula, email, telefono, password, rol } = req.body;

    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .or(`email.eq.${email},cedula.eq.${cedula}`)
      .single();

    if (existe)
      return res.status(400).json({ success: false, message: 'Ya existe un usuario con ese email o cédula' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const verification_token = crypto.randomBytes(32).toString('hex');

    const { data: nuevo, error } = await supabase
      .from('usuarios')
      .insert({
        nombre_completo: nombre_completo.trim(),
        cedula: cedula.trim(),
        email: email.toLowerCase().trim(),
        telefono: telefono.trim(),
        password_hash,
        rol,
        estado: 'pendiente',
        activo: true,
        verification_token,
      })
      .select('id, nombre_completo, email, rol, cedula, telefono, activo, estado, created_at')
      .single();

    if (error) throw error;

    const verificarUrl = `${process.env.FRONTEND_URL}/verificar-cuenta/${verification_token}`;

    // Envío síncrono para ver el error en logs
    try {
      await enviarEmail({
        to: email,
        subject: 'Verifica tu cuenta - Escuela Dominical Verbo Mañosca',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:12px">
            <div style="background:#1F4E5F;padding:24px;border-radius:10px 10px 0 0;text-align:center">
              <h2 style="color:#ffffff;margin:0">Escuela Dominical</h2>
              <p style="color:#9EC5D0;margin:8px 0 0">Iglesia Cristiana Verbo Mañosca</p>
            </div>
            <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px">
              <p style="color:#333">Hola <strong>${nombre_completo}</strong>,</p>
              <p style="color:#333">Tu cuenta ha sido creada con el rol de <strong>${rol}</strong>.</p>
              <p style="color:#333"><strong>Email:</strong> ${email}<br><strong>Contraseña:</strong> ${password}</p>
              <p style="color:#555">Por favor verifica tu cuenta haciendo clic en el botón de abajo:</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${verificarUrl}" style="background:#1F4E5F;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">
                  ✅ Verificar mi cuenta
                </a>
              </div>
              <p style="color:#888;font-size:12px">Si no puedes hacer clic, copia este enlace en tu navegador:<br>${verificarUrl}</p>
              <p style="color:#888;font-size:12px;margin-top:16px">Por seguridad, cambia tu contraseña al ingresar.</p>
            </div>
          </div>
        `,
      });
      console.log('✅ Email de verificación enviado a:', email);
    } catch (emailErr) {
      console.error('❌ EMAIL ERROR:', {
        message: emailErr.message,
        code: emailErr.code,
        command: emailErr.command,
        response: emailErr.response,
        responseCode: emailErr.responseCode,
      });
    }

    res.status(201).json({ success: true, message: 'Usuario creado. Se envió email de verificación.', usuario: nuevo });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al crear usuario', error: err.message });
  }
};

// GET /api/auth/verificar/:token
const verificarCuenta = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, estado')
      .eq('verification_token', token)
      .single();

    if (error || !usuario)
      return res.status(400).json({ success: false, message: 'Token de verificación inválido o ya utilizado' });

    if (usuario.estado === 'pendiente') {
      await supabase
        .from('usuarios')
        .update({ estado: 'activada', email_verificado: true, verification_token: null })
        .eq('id', usuario.id);
    }

    res.json({ success: true, message: 'Cuenta verificada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/olvide-password
const olvidéPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!usuario)
      return res.json({ success: true, message: 'Si el email existe, recibirás un enlace' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await supabase
      .from('usuarios')
      .update({ reset_token: token, reset_token_expires: expires.toISOString() })
      .eq('id', usuario.id);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    try {
      await enviarEmail({
        to: email,
        subject: 'Recuperar contraseña - Escuela Dominical',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:12px">
            <div style="background:#1F4E5F;padding:24px;border-radius:10px 10px 0 0;text-align:center">
              <h2 style="color:#ffffff;margin:0">Recuperar Contraseña</h2>
            </div>
            <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px">
              <p>Hola <strong>${usuario.nombre_completo}</strong>,</p>
              <p>Haz clic en el enlace para restablecer tu contraseña. Válido por 1 hora.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${resetUrl}" style="background:#1F4E5F;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">
                  🔑 Restablecer contraseña
                </a>
              </div>
              <p style="color:#888;font-size:12px">Si no solicitaste esto, ignora este email.</p>
            </div>
          </div>
        `,
      });
      console.log('✅ Email de reset enviado a:', email);
    } catch (emailErr) {
      console.error('❌ EMAIL RESET ERROR:', emailErr.message);
    }

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

    if (!usuario)
      return res.status(400).json({ success: false, message: 'Token inválido o expirado' });

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
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, estado, created_at')
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
    if (!valida)
      return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password_nuevo, salt);

    await supabase.from('usuarios').update({ password_hash }).eq('id', req.usuario.id);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al cambiar contraseña', error: err.message });
  }
};

module.exports = {
  login, crearUsuario, verificarCuenta,
  olvidéPassword, resetPassword,
  obtenerPerfil, actualizarPerfil, cambiarPassword,
};
