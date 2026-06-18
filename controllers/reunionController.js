const supabase = require('../config/supabase');

// GET /api/reuniones
const listarReuniones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reuniones')
      .select('*, grupos(id, nombre, edad_min, edad_max)')
      .eq('activo', true)
      .order('hora_inicio');
    if (error) throw error;
    res.json({ success: true, reuniones: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/reuniones/:id
const obtenerReunion = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reuniones')
      .select(`*, grupos(id, nombre, edad_min, edad_max,
        docente:docente_id(id, nombre_completo, email),
        ayudante1:ayudante1_id(id, nombre_completo, email),
        ayudante2:ayudante2_id(id, nombre_completo, email)
      )`)
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Reunión no encontrada' });
    res.json({ success: true, reunion: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/reuniones
const crearReunion = async (req, res) => {
  try {
    const { nombre, hora_inicio, hora_fin, descripcion } = req.body;
    if (hora_inicio >= hora_fin) {
      return res.status(400).json({ success: false, message: 'La hora de inicio debe ser menor a la hora de fin' });
    }

    // Verificar duplicado: mismo nombre Y mismo horario
    const { data: existente } = await supabase
      .from('reuniones')
      .select('id')
      .eq('nombre', nombre.trim())
      .eq('hora_inicio', hora_inicio)
      .eq('hora_fin', hora_fin)
      .eq('activo', true)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ success: false, message: 'Ya existe una reunión con ese nombre y horario' });
    }

    const { data, error } = await supabase
      .from('reuniones')
      .insert({ nombre: nombre.trim(), hora_inicio, hora_fin, descripcion })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, reunion: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




// PUT /api/reuniones/:id
const actualizarReunion = async (req, res) => {
  try {
    const { nombre, hora_inicio, hora_fin, descripcion } = req.body;
    if (hora_inicio && hora_fin && hora_inicio >= hora_fin) {
      return res.status(400).json({ success: false, message: 'La hora de inicio debe ser menor a la hora de fin' });
    }

    // Verificar duplicado excluyendo la reunión actual
    if (nombre && hora_inicio && hora_fin) {
      const { data: existente } = await supabase
        .from('reuniones')
        .select('id')
        .eq('nombre', nombre.trim())
        .eq('hora_inicio', hora_inicio)
        .eq('hora_fin', hora_fin)
        .eq('activo', true)
        .neq('id', req.params.id)
        .maybeSingle();

      if (existente) {
        return res.status(400).json({ success: false, message: 'Ya existe una reunión con ese nombre y horario' });
      }
    }

    const updates = {};
    if (nombre) updates.nombre = nombre.trim();
    if (hora_inicio) updates.hora_inicio = hora_inicio;
    if (hora_fin) updates.hora_fin = hora_fin;
    if (descripcion !== undefined) updates.descripcion = descripcion;

    const { data, error } = await supabase
      .from('reuniones').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, reunion: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// DELETE /api/reuniones/:id
const eliminarReunion = async (req, res) => {
  try {
    await supabase.from('reuniones').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Reunión eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// GET /api/reuniones/publico — sin auth
const listarReunionesPublico = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reuniones')
      .select('id, nombre, hora_inicio, hora_fin')
      .eq('activo', true)
      .order('hora_inicio');
    if (error) throw error;
    res.json({ success: true, reuniones: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listarReuniones, obtenerReunion, crearReunion, actualizarReunion, eliminarReunion, listarReunionesPublico};
