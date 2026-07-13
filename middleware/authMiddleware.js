const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const proteger = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'No autorizado, token requerido' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, rol, activo, created_at')   // ← se agregó created_at
      .eq('id', decoded.id)
      .single();
    if (error || !usuario) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!usuario.activo) {
      return res.status(401).json({ success: false, message: 'Cuenta desactivada' });
    }
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acceso solo para administradores' });
  }
  next();
};

const adminODocente = (req, res, next) => {
  if (!['admin', 'docente'].includes(req.usuario.rol)) {
    return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
  }
  next();
};

const todosLosRoles = (req, res, next) => {
  if (!['admin', 'docente', 'ayudante'].includes(req.usuario.rol)) {
    return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
  }
  next();
};

module.exports = { proteger, soloAdmin, adminODocente, todosLosRoles };
