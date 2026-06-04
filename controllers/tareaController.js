const supabase = require('../config/supabase');
const { subirArchivo } = require('../services/storageService');
const { generarTareaIA } = require('../services/huggingfaceService');

// GET /api/tareas
const listarTareas = async (req, res) => {
  try {
    const { grupo_id, reunion_id } = req.query;
    let query = supabase
      .from('tareas')
      .select(`*, 
        publicado_por:publicado_por(id, nombre_completo, foto_url),
        reunion:reunion_id(nombre),
        grupo:grupo_id(nombre)
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (req.usuario.rol === 'docente') query = query.eq('publicado_por', req.usuario.id);
    if (grupo_id) query = query.eq('grupo_id', grupo_id);
    if (reunion_id) query = query.eq('reunion_id', reunion_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, tareas: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/tareas
const crearTarea = async (req, res) => {
  try {
    const { titulo, descripcion, reunion_id, grupo_id, generado_por_ia } = req.body;
    let archivosGuardados = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = file.originalname.split('.').pop();
        const fileName = `tarea_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const url = await subirArchivo('archivos-tareas', fileName, file.buffer, file.mimetype);
        archivosGuardados.push({ nombre: file.originalname, url, tipo: file.mimetype });
      }
    }

    const { data, error } = await supabase
      .from('tareas')
      .insert({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        reunion_id: reunion_id || null,
        grupo_id: grupo_id || null,
        publicado_por: req.usuario.id,
        generado_por_ia: generado_por_ia === 'true' || generado_por_ia === true,
        archivos: archivosGuardados,
      })
      .select(`*, publicado_por:publicado_por(nombre_completo), reunion:reunion_id(nombre), grupo:grupo_id(nombre)`)
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, tarea: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/tareas/:id
const actualizarTarea = async (req, res) => {
  try {
    const { titulo, descripcion } = req.body;
    const updates = {};
    if (titulo) updates.titulo = titulo.trim();
    if (descripcion) updates.descripcion = descripcion.trim();

    const { data, error } = await supabase
      .from('tareas').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, tarea: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/tareas/:id
const eliminarTarea = async (req, res) => {
  try {
    await supabase.from('tareas').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Tarea eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/tareas/generar-ia
const generarConIA = async (req, res) => {
  try {
    const { descripcion, indice } = req.body;
    if (!descripcion) {
      return res.status(400).json({ success: false, message: 'Se requiere una descripción' });
    }
    const resultado = await generarTareaIA(descripcion, indice || 0);
    res.json({ success: true, ...resultado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listarTareas, crearTarea, actualizarTarea, eliminarTarea, generarConIA };
