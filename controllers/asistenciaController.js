const supabase = require('../config/supabase');
const XLSX = require('xlsx');

// POST /api/asistencias/registro  — crear sesión de checklist
const iniciarRegistro = async (req, res) => {
  try {
    const { reunion_id, grupo_id } = req.body;
    const fecha = new Date().toISOString().split('T')[0];

    // Verificar permiso checklist para ayudantes
    if (req.usuario.rol === 'ayudante') {
      const { data: grupo } = await supabase
        .from('grupos')
        .select('ayudantes_checklist, ayudante1_id, ayudante2_id')
        .eq('id', grupo_id)
        .single();
      if (!grupo?.ayudantes_checklist ||
          (grupo.ayudante1_id !== req.usuario.id && grupo.ayudante2_id !== req.usuario.id)) {
        return res.status(403).json({ success: false, message: 'Sin acceso al checklist de este grupo' });
      }
    }

    // Buscar o crear registro del día
    let { data: registro } = await supabase
      .from('registros_asistencia')
      .select('*')
      .eq('reunion_id', reunion_id)
      .eq('grupo_id', grupo_id)
      .eq('fecha', fecha)
      .single();

    if (!registro) {
      const { data: nuevo, error } = await supabase
        .from('registros_asistencia')
        .insert({ reunion_id, grupo_id, fecha, registrado_por: req.usuario.id })
        .select()
        .single();
      if (error) throw error;
      registro = nuevo;
    }

    // Cargar asistencias ya registradas
    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('*, nino:nino_id(id, nombre_completo)')
      .eq('registro_id', registro.id)
      .order('orden_llegada');

    res.json({ success: true, registro, asistencias: asistencias || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/asistencias/marcar  — dar visto a un niño
const marcarAsistencia = async (req, res) => {
  try {
    const { registro_id, nino_id, llego_tarde, comentario } = req.body;
    const ahora = new Date().toISOString();

    // Verificar si ya está marcado
    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('registro_id', registro_id)
      .eq('nino_id', nino_id)
      .single();

    if (existente) {
      return res.status(400).json({ success: false, message: 'El niño ya fue marcado en este registro' });
    }

    // Contar cuántos ya están registrados para el orden
    const { count } = await supabase
      .from('asistencias')
      .select('id', { count: 'exact' })
      .eq('registro_id', registro_id);

    const orden = (count || 0) + 1;

    const { data, error } = await supabase
      .from('asistencias')
      .insert({
        registro_id,
        nino_id,
        hora_llegada: ahora,
        llego_tarde: llego_tarde || false,
        comentario: comentario || null,
        orden_llegada: orden,
      })
      .select('*, nino:nino_id(id, nombre_completo)')
      .single();

    if (error) throw error;

    // Actualizar hora_primer_visto si es el primero
    if (orden === 1) {
      await supabase
        .from('registros_asistencia')
        .update({ hora_primer_visto: ahora })
        .eq('id', registro_id);
    }

    // Actualizar hora_ultimo_visto siempre
    await supabase
      .from('registros_asistencia')
      .update({ hora_ultimo_visto: ahora })
      .eq('id', registro_id);

    res.status(201).json({ success: true, asistencia: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/asistencias/:id  — editar comentario / tarde
const editarAsistencia = async (req, res) => {
  try {
    const { llego_tarde, comentario } = req.body;
    const { data, error } = await supabase
      .from('asistencias')
      .update({ llego_tarde, comentario })
      .eq('id', req.params.id)
      .select('*, nino:nino_id(nombre_completo)')
      .single();
    if (error) throw error;
    res.json({ success: true, asistencia: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/asistencias/guardar  — guardar registro definitivamente
const guardarRegistro = async (req, res) => {
  try {
    const { registro_id } = req.body;
    const { data, error } = await supabase
      .from('registros_asistencia')
      .update({ guardado_at: new Date().toISOString() })
      .eq('id', registro_id)
      .select(`*, 
        reunion:reunion_id(nombre, hora_inicio, hora_fin),
        grupo:grupo_id(nombre)
      `)
      .single();
    if (error) throw error;
    res.json({ success: true, registro: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/asistencias/historial  — historial de registros
const historialRegistros = async (req, res) => {
  try {
    const { grupo_id, reunion_id, fecha_inicio, fecha_fin } = req.query;
    let query = supabase
      .from('registros_asistencia')
      .select(`*, 
        reunion:reunion_id(nombre, hora_inicio, hora_fin),
        grupo:grupo_id(nombre),
        registrado_por:registrado_por(nombre_completo)
      `)
      .not('guardado_at', 'is', null)
      .order('fecha', { ascending: false });

    if (grupo_id) query = query.eq('grupo_id', grupo_id);
    if (reunion_id) query = query.eq('reunion_id', reunion_id);
    if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
    if (fecha_fin) query = query.lte('fecha', fecha_fin);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, registros: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/asistencias/exportar/:registro_id  — exportar a Excel
const exportarExcel = async (req, res) => {
  try {
    const { data: registro, error: err1 } = await supabase
      .from('registros_asistencia')
      .select(`*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre)`)
      .eq('id', req.params.registro_id)
      .single();
    if (err1) throw err1;

    const { data: asistencias, error: err2 } = await supabase
      .from('asistencias')
      .select('*, nino:nino_id(nombre_completo)')
      .eq('registro_id', req.params.registro_id)
      .order('orden_llegada');
    if (err2) throw err2;

    const filas = asistencias.map((a, i) => ({
      '#': i + 1,
      'Nombre del Niño': a.nino?.nombre_completo || 'N/A',
      'Hora de Llegada': a.hora_llegada ? new Date(a.hora_llegada).toLocaleTimeString('es-EC') : '',
      'Llegó Tarde': a.llego_tarde ? 'Sí' : 'No',
      'Comentario': a.comentario || '',
    }));

    const infoHoja = [
      ['Reporte de Asistencia - Escuela Dominical Verbo Mañosca'],
      [`Reunión: ${registro.reunion?.nombre}`],
      [`Horario: ${registro.reunion?.hora_inicio} - ${registro.reunion?.hora_fin}`],
      [`Grupo: ${registro.grupo?.nombre}`],
      [`Fecha: ${registro.fecha}`],
      [`Primer ingreso: ${registro.hora_primer_visto ? new Date(registro.hora_primer_visto).toLocaleString('es-EC') : 'N/A'}`],
      [`Último ingreso: ${registro.hora_ultimo_visto ? new Date(registro.hora_ultimo_visto).toLocaleString('es-EC') : 'N/A'}`],
      [`Total asistentes: ${asistencias.length}`],
      [],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(infoHoja);
    XLSX.utils.sheet_add_json(ws, filas, { origin: -1 });
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const nombreArchivo = `asistencia_${registro.grupo?.nombre}_${registro.fecha}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { iniciarRegistro, marcarAsistencia, editarAsistencia, guardarRegistro, historialRegistros, exportarExcel };
