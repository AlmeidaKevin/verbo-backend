const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');

// GET /api/usuarios
const listarUsuarios = async (req, res) => {
  try {
    const { rol } = req.query;
    let query = supabase
      .from('usuarios')
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, created_at')
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
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, created_at')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, usuario: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/usuarios/:id  (solo admin)
const actualizarUsuario = async (req, res) => {
  try {
    const { nombre_completo, cedula, email, telefono, rol, activo } = req.body;
    const updates = {};
    if (nombre_completo) updates.nombre_completo = nombre_completo.trim();
    if (cedula) updates.cedula = cedula.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (telefono) updates.telefono = telefono.trim();
    if (rol) updates.rol = rol;
    if (activo !== undefined) updates.activo = activo;

    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo')
      .single();

    if (error) throw error;
    res.json({ success: true, usuario: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/usuarios/:id  (solo admin - desactivar)
const eliminarUsuario = async (req, res) => {
  try {
    if (req.params.id === req.usuario.id) {
      return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });
    }
    await supabase.from('usuarios').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Usuario desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/usuarios/:id/foto
const subirFotoPerfil = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó imagen' });
    }
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
