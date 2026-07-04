const supabase = require('../config/supabase');

// GET /api/chat/conversaciones
const listarConversaciones = async (req, res) => {
  try {
    const userId = req.usuario.id;

    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select(`
        id, created_at,
        usuario1:usuario1_id(id, nombre_completo, email, foto_url),
        usuario2:usuario2_id(id, nombre_completo, email, foto_url)
      `)
      .or(`usuario1_id.eq.${userId},usuario2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Para cada conversación traer el último mensaje y no leídos
    const resultado = await Promise.all(convs.map(async (c) => {
      const otro = c.usuario1.id === userId ? c.usuario2 : c.usuario1;

      const { data: ultimos } = await supabase
        .from('mensajes')
        .select('id, contenido, tipo, estado, remitente_id, created_at')
        .eq('conversacion_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { count: noLeidos } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('conversacion_id', c.id)
        .neq('remitente_id', userId)
        .neq('estado', 'visto');

      return {
        id: c.id,
        created_at: c.created_at,
        contacto: otro,
        ultimo_mensaje: ultimos?.[0] || null,
        no_leidos: noLeidos || 0,
      };
    }));

    // Ordenar por último mensaje
    resultado.sort((a, b) => {
      const fechaA = a.ultimo_mensaje?.created_at || a.created_at;
      const fechaB = b.ultimo_mensaje?.created_at || b.created_at;
      return new Date(fechaB) - new Date(fechaA);
    });

    res.json({ success: true, conversaciones: resultado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/chat/mensajes/:conversacionId
const listarMensajes = async (req, res) => {
  try {
    const { conversacionId } = req.params;
    const userId = req.usuario.id;

    const { data, error } = await supabase
      .from('mensajes')
      .select('id, contenido, tipo, archivo_url, archivo_nombre, archivo_tipo, estado, remitente_id, created_at')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Marcar como visto los mensajes del otro usuario
    await supabase
      .from('mensajes')
      .update({ estado: 'visto' })
      .eq('conversacion_id', conversacionId)
      .neq('remitente_id', userId)
      .neq('estado', 'visto');

    res.json({ success: true, mensajes: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/chat/conversaciones
const crearOBuscarConversacion = async (req, res) => {
  try {
    const { contacto_id } = req.body;
    const userId = req.usuario.id;

    if (contacto_id === userId)
      return res.status(400).json({ success: false, message: 'No puedes chatear contigo mismo' });

    // Buscar conversación existente en cualquier dirección
    const { data: existente } = await supabase
      .from('conversaciones')
      .select('id')
      .or(`and(usuario1_id.eq.${userId},usuario2_id.eq.${contacto_id}),and(usuario1_id.eq.${contacto_id},usuario2_id.eq.${userId})`)
      .single();

    if (existente) return res.json({ success: true, conversacion_id: existente.id });

    const { data: nueva, error } = await supabase
      .from('conversaciones')
      .insert({ usuario1_id: userId, usuario2_id: contacto_id })
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, conversacion_id: nueva.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/chat/mensajes
const enviarMensaje = async (req, res) => {
  try {
    const { conversacion_id, contenido, tipo = 'texto', archivo_url, archivo_nombre, archivo_tipo } = req.body;
    const userId = req.usuario.id;

    if (!contenido && !archivo_url)
      return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });

    const { data, error } = await supabase
      .from('mensajes')
      .insert({
        conversacion_id,
        remitente_id: userId,
        contenido: contenido || null,
        tipo,
        archivo_url: archivo_url || null,
        archivo_nombre: archivo_nombre || null,
        archivo_tipo: archivo_tipo || null,
        estado: 'enviado',
      })
      .select('id, contenido, tipo, archivo_url, archivo_nombre, archivo_tipo, estado, remitente_id, created_at')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, mensaje: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/chat/mensajes/:id/recibido
const marcarRecibido = async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('mensajes').update({ estado: 'recibido' }).eq('id', id).eq('estado', 'enviado');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/chat/no-leidos
const contarNoLeidos = async (req, res) => {
  try {
    const userId = req.usuario.id;

    const { data: convs } = await supabase
      .from('conversaciones')
      .select('id')
      .or(`usuario1_id.eq.${userId},usuario2_id.eq.${userId}`);

    if (!convs?.length) return res.json({ success: true, total: 0 });

    const ids = convs.map(c => c.id);
    const { count } = await supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .in('conversacion_id', ids)
      .neq('remitente_id', userId)
      .neq('estado', 'visto');

    res.json({ success: true, total: count || 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/chat/buscar-usuarios?q=
const buscarUsuarios = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.usuario.id;
    if (!q || q.trim().length < 2)
      return res.json({ success: true, usuarios: [] });

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, foto_url, rol')
      .neq('id', userId)
      .eq('activo', true)
      .neq('rol', 'admin')
      .or(`nombre_completo.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);

    if (error) throw error;
    res.json({ success: true, usuarios: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/chat/subir-archivo
const subirArchivo = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });

    if (req.file.size > 5 * 1024 * 1024)
      return res.status(400).json({ success: false, message: 'El archivo no puede superar 5MB' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('chat-archivos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      // Intentar crear el bucket si no existe
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        await supabase.storage.createBucket('chat-archivos', { public: true, fileSizeLimit: 5242880 });
        const { data: data2, error: error2 } = await supabase.storage
          .from('chat-archivos')
          .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
        if (error2) throw error2;
        const { data: urlData } = supabase.storage.from('chat-archivos').getPublicUrl(data2.path);
        return res.json({ success: true, url: urlData.publicUrl, nombre: req.file.originalname, tipo: req.file.mimetype });
      }
      throw error;
    }

    const { data: urlData } = supabase.storage.from('chat-archivos').getPublicUrl(data.path);
    res.json({ success: true, url: urlData.publicUrl, nombre: req.file.originalname, tipo: req.file.mimetype });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listarConversaciones, listarMensajes, crearOBuscarConversacion,
  enviarMensaje, marcarRecibido, contarNoLeidos, buscarUsuarios, subirArchivo,
};
