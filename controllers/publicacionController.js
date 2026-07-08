const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');
const { enviarEmail } = require('../services/emailService');

// GET /api/publicaciones
const listarPublicaciones = async (req, res) => {
  try {
    const userId = req.usuario.id;
    const rol = req.usuario.rol;

    let query = supabase
      .from('publicaciones')
      .select(`*, publicado_por:publicado_por(id, nombre_completo, foto_url, rol)`)
      .eq('activo', true)
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

    // Obtener IDs ya vistos por este usuario
    const { data: vistas } = await supabase
      .from('publicaciones_vistas')
      .select('publicacion_id')
      .eq('usuario_id', userId);

    const idsVistos = new Set((vistas || []).map(v => v.publicacion_id));

    // Añadir campo `vista` a cada publicación
    const publicacionesConVista = (data || []).map(p => ({
      ...p,
      vista: idsVistos.has(p.id) || p.publicado_por === userId, // las propias siempre marcadas como vistas
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

    // Enviar emails en background sin bloquear la respuesta
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
      // docentes_especificos, ayudantes_especificos, grupo_especifico_con_ninos, grupo_especifico_sin_ninos
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
    const { data, error } = await supabase
      .from('publicaciones')
      .update({ titulo: titulo?.trim(), contenido: contenido?.trim() })
      .eq('id', req.params.id)
      .select()
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
    await supabase.from('publicaciones').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Publicación eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/publicaciones/publico — para niños (sin auth)
const publicacionesPublicas = async (req, res) => {
  try {
    const { reunion_id, grupo_id } = req.query;

    // ── Tareas filtradas ──────────────────────────────────────
    let tareasQuery = supabase
      .from('tareas')
      .select(`titulo, descripcion, archivos, created_at,
        publicado_por:publicado_por(nombre_completo),
        reunion:reunion_id(id, nombre, hora_inicio, hora_fin),
        grupo:grupo_id(id, nombre)
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (reunion_id) tareasQuery = tareasQuery.eq('reunion_id', reunion_id);
    if (grupo_id) tareasQuery = tareasQuery.eq('grupo_id', grupo_id);

    const { data: tareas, error: tareasError } = await tareasQuery;
    if (tareasError) throw tareasError;

    // ── Publicaciones visibles para niños ─────────────────────
    // grupos_con_ninos → todos los niños
    // grupo_especifico_con_ninos → solo niños de grupos seleccionados (filtrado en frontend por grupos_ids)
    const { data: pubs, error: pubsError } = await supabase
      .from('publicaciones')
      .select(`id, titulo, contenido, archivos, created_at, tipo_destinatario, destinatarios_ids, grupos_ids,
        publicado_por:publicado_por(nombre_completo)
      `)
      .eq('activo', true)
      .in('tipo_destinatario', ['grupos_con_ninos', 'grupo_especifico_con_ninos'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (pubsError) throw pubsError;

    res.json({ success: true, contenidos: tareas || [], publicaciones: pubs || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/publicaciones/no-vistas — cuántas publicaciones nuevas tiene el usuario
const contarNoVistas = async (req, res) => {
  try {
    const userId = req.usuario.id;

    // Obtener IDs de publicaciones ya vistas
    const { data: vistas } = await supabase
      .from('publicaciones_vistas')
      .select('publicacion_id')
      .eq('usuario_id', userId);

    const idsVistos = (vistas || []).map(v => v.publicacion_id);

    // Contar publicaciones que le aplican y no ha visto
    let query = supabase
      .from('publicaciones')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .neq('publicado_por', userId);

    if (req.usuario.rol !== 'admin') {
      query = query.or(
        `tipo_destinatario.eq.todos,` +
        `tipo_destinatario.eq.grupos_con_ninos,` +
        `tipo_destinatario.eq.grupos_sin_ninos,` +
        `and(tipo_destinatario.eq.solo_docentes,${req.usuario.rol === 'docente' ? 'tipo_destinatario.eq.solo_docentes' : 'tipo_destinatario.eq.NONE'}),` +
        `and(tipo_destinatario.eq.solo_ayudantes,${req.usuario.rol === 'ayudante' ? 'tipo_destinatario.eq.solo_ayudantes' : 'tipo_destinatario.eq.NONE'}),` +
        `destinatarios_ids.cs.{${userId}}`
      );
    }

    if (idsVistos.length > 0) {
      query = query.not('id', 'in', `(${idsVistos.join(',')})`);
    }

    const { count } = await query;
    res.json({ success: true, no_vistas: count || 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/publicaciones/marcar-vistas — marcar publicaciones como vistas
const marcarVistas = async (req, res) => {
  try {
    const userId = req.usuario.id;
    const { publicacion_ids } = req.body; // array de IDs

    if (!publicacion_ids || publicacion_ids.length === 0) {
      return res.json({ success: true });
    }

    const filas = publicacion_ids.map(pid => ({
      usuario_id: userId,
      publicacion_id: pid,
    }));

    await supabase
      .from('publicaciones_vistas')
      .upsert(filas, { onConflict: 'usuario_id,publicacion_id', ignoreDuplicates: true });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listarPublicaciones,
  crearPublicacion,
  actualizarPublicacion,
  eliminarPublicacion,
  publicacionesPublicas,
  contarNoVistas,
  marcarVistas,
};
