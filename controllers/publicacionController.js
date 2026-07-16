const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');
const { enviarEmail } = require('../services/emailService');

const SUPER_ADMIN_EMAIL = 'almeidakevin783@gmail.com';

// GET /api/publicaciones
const listarPublicaciones = async (req, res) => {
  try {
    const userId = req.usuario.id;
    const rol = req.usuario.rol;
    const fechaCreacionUsuario = req.usuario.created_at;

    let query = supabase
      .from('publicaciones')
      .select(`*, publicado_por:publicado_por(id, nombre_completo, foto_url, rol), editado_por:editado_por(id, nombre_completo)`)
      .eq('activo', true)
      .gte('created_at', fechaCreacionUsuario)
      .order('created_at', { ascending: false });

    if (rol !== 'admin') {
      query = query.or(
        `tipo_destinatario.eq.todos,` +
        `tipo_destinatario.eq.grupos_con_ninos,` +
        `tipo_destinatario.eq.grupos_sin_ninos,` +
        `and(tipo_destinatario.eq.solo_docentes,${rol === 'docente' ? 'tipo_destinatario.eq.solo_docentes' : 'tipo_destinatario.eq.NONE'}),` +
        `and(tipo_destinatario.eq.solo_ayudantes,${rol === 'ayudante' ? 'tipo_destinatario.eq.solo_ayudantes' : 'tipo_destinatario.eq.NONE'}),` +
        `destinatarios_ids.cs.{${userId}}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const { data: vistas } = await supabase
      .from('publicaciones_vistas')
      .select('publicacion_id')
      .eq('usuario_id', userId);

    const idsVistos = new Set((vistas || []).map(v => v.publicacion_id));

    const publicacionesConVista = (data || []).map(p => ({
      ...p,
      vista: idsVistos.has(p.id) || p.publicado_por === userId,
    }));

    res.json({ success: true, publicaciones: publicacionesConVista });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/publicaciones
const crearPublicacion = async (req, res) => {
  try {
    const { titulo, contenido, tipo_destinatario, destinatarios_ids, grupos_ids } = req.body;
    let archivosGuardados = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = file.originalname.split('.').pop();
        const fileName = `pub_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const url = await subirArchivo('archivos-publicaciones', fileName, file.buffer, file.mimetype);
        archivosGuardados.push({ nombre: file.originalname, url, tipo: file.mimetype });
      }
    }

    let parsedDestinatarios = [];
    if (destinatarios_ids) {
      parsedDestinatarios = typeof destinatarios_ids === 'string'
        ? JSON.parse(destinatarios_ids)
        : destinatarios_ids;
    }

    let parsedGrupos = [];
    if (grupos_ids) {
      parsedGrupos = typeof grupos_ids === 'string'
        ? JSON.parse(grupos_ids)
        : grupos_ids;
    }

    const { data, error } = await supabase
      .from('publicaciones')
      .insert({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        publicado_por: req.usuario.id,
        tipo_destinatario,
        destinatarios_ids: parsedDestinatarios,
        grupos_ids: parsedGrupos,
        archivos: archivosGuardados,
      })
      .select(`*, publicado_por:publicado_por(id, nombre_completo, foto_url, rol)`)
      .single();

    if (error) throw error;

    enviarNotificacionPublicacion(data, parsedDestinatarios, tipo_destinatario).catch(console.error);

    res.status(201).json({ success: true, publicacion: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const enviarNotificacionPublicacion = async (publicacion, destinatariosIds, tipo) => {
  try {
    let emails = [];

    if (['todos', 'grupos_con_ninos', 'grupos_sin_ninos'].includes(tipo)) {
      const { data } = await supabase.from('usuarios').select('email').eq('activo', true).neq('rol', 'admin');
      emails = data?.map(u => u.email) || [];
    } else if (tipo === 'solo_docentes') {
      const { data } = await supabase.from('usuarios').select('email').eq('rol', 'docente').eq('activo', true);
      emails = data?.map(u => u.email) || [];
    } else if (tipo === 'solo_ayudantes') {
      const { data } = await supabase.from('usuarios').select('email').eq('rol', 'ayudante').eq('activo', true);
      emails = data?.map(u => u.email) || [];
    } else if (destinatariosIds.length > 0) {
      const { data } = await supabase.from('usuarios').select('email').in('id', destinatariosIds).eq('activo', true);
      emails = data?.map(u => u.email) || [];
    }

    if (emails.length > 0) {
      await enviarEmail({
        to: emails.join(','),
        subject: `Nueva publicación: ${publicacion.titulo}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
          <h2 style="color:#1F4E5F">${publicacion.titulo}</h2>
          <p>${publicacion.contenido}</p>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#1F4E5F;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">Ver en el sistema</a>
        </div>`,
      });
    }
  } catch (e) {
    console.error('Error enviando emails:', e.message);
  }
};

// PUT /api/publicaciones/:id
const actualizarPublicacion = async (req, res) => {
  try {
    const { titulo, contenido } = req.body;

    const { data: original, error: errorBusqueda } = await supabase
      .from('publicaciones')
      .select('id, publicado_por')
      .eq('id', req.params.id)
      .single();

    if (errorBusqueda || !original)
      return res.status(404).json({ success: false, message: 'Publicación no encontrada' });

    const esSuperAdmin = req.usuario?.email === SUPER_ADMIN_EMAIL;
    const esAutor = String(original.publicado_por) === String(req.usuario.id);

    if (!esAutor && !esSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Solo puedes editar tus propias publicaciones' });
    }

    const updates = {
      titulo: titulo?.trim(),
      contenido: contenido?.trim(),
    };

    // Si el super admin edita una publicación que no es suya, se registra quién la editó
    if (esSuperAdmin && !esAutor) {
      updates.editado_por = req.usuario.id;
    }

    const { data, error } = await supabase
      .from('publicaciones')
      .update(updates)
      .eq('id', req.params.id)
      .select(`*, publicado_por:publicado_por(id, nombre_completo, foto_url, rol), editado_por:editado_por(id, nombre_completo)`)
      .single();

    if (error) throw error;
    res.json({ success: true, publicacion: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/publicaciones/:id
const eliminarPublicacion = async (req, res) => {
  try {
    const { data: original, error: errorBusqueda } = await supabase
      .from('publicaciones')
      .select('id, publicado_por')
      .eq('id', req.params.id)
      .single();

    if (errorBusqueda || !original)
      return res.status(404).json({ success: false, message: 'Publicación no encontrada' });

    const esSuperAdmin = req.usuario?.email ===
