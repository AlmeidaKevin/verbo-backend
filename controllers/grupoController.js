const supabase = require('../config/supabase');

// ── helper: cargar ayudantes extra de un grupo ────────────────────────────
const cargarAyudantesExtra = async (grupoId) => {
  const { data } = await supabase
    .from('grupo_ayudantes_extra')
    .select('id, orden, ayudante:ayudante_id(id, nombre_completo, email)')
    .eq('grupo_id', grupoId)
    .order('orden');
  return data || [];
};

// GET /api/grupos
const listarGrupos = async (req, res) => {
  try {
    const { reunion_id } = req.query;
    let query = supabase
      .from('grupos')
      .select(`id, nombre, edad_min, edad_max, ayudantes_checklist, activo, reunion_id, docente_id, ayudante1_id, ayudante2_id, created_at,
        reunion:reunion_id(id, nombre, hora_inicio, hora_fin),
        docente:docente_id(id, nombre_completo, email, foto_url),
        ayudante1:ayudante1_id(id, nombre_completo, email),
        ayudante2:ayudante2_id(id, nombre_completo, email)
      `)
      .eq('activo', true);

    if (reunion_id) query = query.eq('reunion_id', reunion_id);

    if (req.usuario.rol === 'docente') {
      query = query.eq('docente_id', req.usuario.id);
    } else if (req.usuario.rol === 'ayudante') {
      query = query.or(`ayudante1_id.eq.${req.usuario.id},ayudante2_id.eq.${req.usuario.id}`);
    }

    const { data, error } = await query.order('nombre');
    if (error) throw error;

    // Cargar ayudantes extra para cada grupo
    const gruposConExtra = await Promise.all(
      (data || []).map(async (g) => {
        const ayudantesExtra = await cargarAyudantesExtra(g.id);
        return { ...g, ayudantes_extra: ayudantesExtra };
      })
    );

    res.json({ success: true, grupos: gruposConExtra });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/grupos/:id
const obtenerGrupo = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('grupos')
      .select(`*,
        reunion:reunion_id(id, nombre, hora_inicio, hora_fin),
        docente:docente_id(id, nombre_completo, email, foto_url),
        ayudante1:ayudante1_id(id, nombre_completo, email, foto_url),
        ayudante2:ayudante2_id(id, nombre_completo, email, foto_url),
        ninos(id, nombre_completo, edad, activo)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });

    const ayudantesExtra = await cargarAyudantesExtra(req.params.id);
    res.json({ success: true, grupo: { ...data, ayudantes_extra: ayudantesExtra } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/grupos
const crearGrupo = async (req, res) => {
  try {
    const { nombre, reunion_id, docente_id, ayudante1_id, ayudante2_id, edad_min, edad_max, ayudantes_extra } = req.body;

    if (parseInt(edad_max) <= parseInt(edad_min)) {
      return res.status(400).json({ success: false, message: 'La edad máxima debe ser mayor a la mínima' });
    }

    const { data, error } = await supabase
      .from('grupos')
      .insert({ nombre: nombre.trim(), reunion_id, docente_id, ayudante1_id, ayudante2_id, edad_min, edad_max })
      .select(`*, reunion:reunion_id(nombre), docente:docente_id(nombre_completo)`)
      .single();

    if (error) throw error;

    // Insertar ayudantes extra si los hay
    if (ayudantes_extra && ayudantes_extra.length > 0) {
      const filas = ayudantes_extra
        .filter(id => id)
        .map((ayudante_id, idx) => ({ grupo_id: data.id, ayudante_id, orden: idx + 3 }));
      if (filas.length > 0) {
        await supabase.from('grupo_ayudantes_extra').insert(filas);
      }
    }

    const ayudantesExtraData = await cargarAyudantesExtra(data.id);
    res.status(201).json({ success: true, grupo: { ...data, ayudantes_extra: ayudantesExtraData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/grupos/:id
const actualizarGrupo = async (req, res) => {
  try {
    const { nombre, reunion_id, docente_id, ayudante1_id, ayudante2_id, edad_min, edad_max, ayudantes_checklist, ayudantes_extra } = req.body;

    const updates = {};
    if (nombre) updates.nombre = nombre.trim();
    if (reunion_id) updates.reunion_id = reunion_id;
    if (docente_id !== undefined) updates.docente_id = docente_id;
    if (ayudante1_id !== undefined) updates.ayudante1_id = ayudante1_id;
    if (ayudante2_id !== undefined) updates.ayudante2_id = ayudante2_id;
    if (edad_min !== undefined) updates.edad_min = edad_min;
    if (edad_max !== undefined) updates.edad_max = edad_max;
    if (ayudantes_checklist !== undefined) updates.ayudantes_checklist = ayudantes_checklist;

    if (updates.edad_min !== undefined && updates.edad_max !== undefined) {
      if (parseInt(updates.edad_max) <= parseInt(updates.edad_min)) {
        return res.status(400).json({ success: false, message: 'La edad máxima debe ser mayor a la mínima' });
      }
    }

    const { data, error } = await supabase
      .from('grupos').update(updates).eq('id', req.params.id)
      .select(`*, reunion:reunion_id(nombre), docente:docente_id(nombre_completo)`).single();
    if (error) throw error;

    // Actualizar ayudantes extra: borrar los actuales e insertar los nuevos
    if (ayudantes_extra !== undefined) {
      await supabase.from('grupo_ayudantes_extra').delete().eq('grupo_id', req.params.id);
      const filas = (ayudantes_extra || [])
        .filter(id => id)
        .map((ayudante_id, idx) => ({ grupo_id: req.params.id, ayudante_id, orden: idx + 3 }));
      if (filas.length > 0) {
        await supabase.from('grupo_ayudantes_extra').insert(filas);
      }
    }

    const ayudantesExtraData = await cargarAyudantesExtra(req.params.id);
    res.json({ success: true, grupo: { ...data, ayudantes_extra: ayudantesExtraData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/grupos/:id
const eliminarGrupo = async (req, res) => {
  try {
    await supabase.from('grupos').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Grupo eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// PUT /api/grupos/:id/checklist — admin o docente del grupo
const toggleChecklist = async (req, res) => {
  try {
    const { ayudantes_checklist } = req.body;
    const grupoId = req.params.id;

    // Verificar que el docente pertenece a este grupo
    if (req.usuario.rol === 'docente') {
      const { data: grupo } = await supabase
        .from('grupos')
        .select('docente_id')
        .eq('id', grupoId)
        .single();
      if (!grupo || grupo.docente_id !== req.usuario.id) {
        return res.status(403).json({ success: false, message: 'No eres el docente de este grupo' });
      }
    }

    const { data, error } = await supabase
      .from('grupos')
      .update({ ayudantes_checklist })
      .eq('id', grupoId)
      .select('id, nombre, ayudantes_checklist')
      .single();

    if (error) throw error;
    res.json({ success: true, grupo: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// GET /api/grupos/publico — sin auth
const listarGruposPublico = async (req, res) => {
  try {
    const { reunion_id } = req.query;
    let query = supabase
      .from('grupos')
      .select('id, nombre, edad_min, edad_max, reunion_id')
      .eq('activo', true)
      .order('nombre');
    if (reunion_id) query = query.eq('reunion_id', reunion_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, grupos: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listarGrupos, obtenerGrupo, crearGrupo, actualizarGrupo, eliminarGrupo, toggleChecklist, listarGruposPublico};
