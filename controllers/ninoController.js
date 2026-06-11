const supabase = require('../config/supabase');

// GET /api/ninos
const listarNinos = async (req, res) => {
  try {
    const { grupo_id, buscar } = req.query;
    let query = supabase
      .from('ninos')
      .select('id, nombre_completo, edad, fecha_nacimiento, activo, grupo_id, numero_contacto, observacion, grupo:grupo_id(id, nombre, reunion:reunion_id(nombre))')
      .eq('activo', true)
      .order('nombre_completo');
    if (grupo_id) query = query.eq('grupo_id', grupo_id);
    if (buscar) query = query.ilike('nombre_completo', `%${buscar}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, ninos: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ninos/:id
const obtenerNino = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ninos')
      .select('*, grupo:grupo_id(id, nombre)')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Niño no encontrado' });
    res.json({ success: true, nino: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ninos
const crearNino = async (req, res) => {
  try {
    const { nombre_completo, edad, fecha_nacimiento, grupo_id, numero_contacto, observacion } = req.body;

    if (!nombre_completo || /\d/.test(nombre_completo)) {
      return res.status(400).json({ success: false, message: 'El nombre no puede contener números ni estar vacío' });
    }
    if (numero_contacto && !/^\d+$/.test(numero_contacto)) {
      return res.status(400).json({ success: false, message: 'El número de contacto solo puede contener dígitos' });
    }

    const { data, error } = await supabase
      .from('ninos')
      .insert({
        nombre_completo: nombre_completo.trim(),
        edad: edad || null,
        fecha_nacimiento: fecha_nacimiento || null,
        grupo_id: grupo_id || null,
        numero_contacto: numero_contacto?.trim() || null,
        observacion: observacion?.trim() || null,
      })
      .select('id, nombre_completo, edad, grupo_id, numero_contacto, observacion')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, nino: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/ninos/:id
const actualizarNino = async (req, res) => {
  try {
    const { nombre_completo, edad, fecha_nacimiento, grupo_id, numero_contacto, observacion } = req.body;

    if (nombre_completo && /\d/.test(nombre_completo)) {
      return res.status(400).json({ success: false, message: 'El nombre no puede contener números' });
    }
    if (numero_contacto && !/^\d+$/.test(numero_contacto)) {
      return res.status(400).json({ success: false, message: 'El número de contacto solo puede contener dígitos' });
    }

    const updates = {};
    if (nombre_completo) updates.nombre_completo = nombre_completo.trim();
    if (edad !== undefined) updates.edad = edad;
    if (fecha_nacimiento !== undefined) updates.fecha_nacimiento = fecha_nacimiento;
    if (grupo_id !== undefined) updates.grupo_id = grupo_id;
    if (numero_contacto !== undefined) updates.numero_contacto = numero_contacto?.trim() || null;
    if (observacion !== undefined) updates.observacion = observacion?.trim() || null;

    const { data, error } = await supabase
      .from('ninos').update(updates).eq('id', req.params.id)
      .select('*, grupo:grupo_id(id, nombre)')
      .single();

    if (error) throw error;
    res.json({ success: true, nino: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/ninos/:id
const eliminarNino = async (req, res) => {
  try {
    await supabase.from('ninos').update({ activo: false }).eq('id', req.params.id);
    res.json({ success: true, message: 'Niño eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listarNinos, obtenerNino, crearNino, actualizarNino, eliminarNino };
