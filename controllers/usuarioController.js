const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');

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

    // OJO: se agrega "email" al select, se necesita para saber si el objetivo es el super admin
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
        // El super admin no puede cambiar su propio estado: siempre permanece activo
        if (intentaCambiarEstado) {
          return res.status(403).json({ success: false, message: 'El super administrador siempre permanece activo' });
        }
      } else if (!esSuperAdmin && !esUnoMismo) {
        // Un admin regular no puede tocar el estado de otro admin (ni del super admin)
        return res.status(403).json({ success: false, message: 'No se puede modificar el estado de otro administrador' });
      }
    }

    const updates = {};
    if (nombre_completo) updates.nombre_completo = nombre_completo.trim();
    if (cedula) updates.cedula = cedula.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (telefono) updates.telefono = telefono.trim();
    if (rol) updates.rol = rol;

    // Manejo de estado
    if (estado) {
      updates.estado = estado;
      // Si el admin cambia a 'desactivada', también desactivar activo
      if (estado === 'desactivada') updates.activo = false;
      else updates.activo = true;
    } else if (activo !== undefined) {
      updates.activo = activo;
      updates.estado = activo ? 'activada' : 'desactivada';
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, nombre_completo, cedula, email, telefono, rol, foto_url, activo, estado, email_verificado')
      .single();

    if (error) throw error;
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
