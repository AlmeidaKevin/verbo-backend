const supabase = require('../config/supabase');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : 'N/A';
const fmtHora = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Guayaquil',
      })
    : '';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asistencias/registro  — crear O recuperar sesión de checklist
// Si se pasa ?nuevo=true se fuerza la creación de un nuevo registro ese día
// ─────────────────────────────────────────────────────────────────────────────
const iniciarRegistro = async (req, res) => {
  try {
    const { reunion_id, grupo_id, nuevo } = req.body;
    const fecha = new Date().toISOString().split('T')[0];

    // Verificar permiso checklist para ayudantes
    if (req.usuario.rol === 'ayudante') {
      const { data: grupo } = await supabase
        .from('grupos')
        .select('ayudantes_checklist, ayudante1_id, ayudante2_id')
        .eq('id', grupo_id)
        .single();
      if (
        !grupo?.ayudantes_checklist ||
        (grupo.ayudante1_id !== req.usuario.id && grupo.ayudante2_id !== req.usuario.id)
      ) {
        return res
          .status(403)
          .json({ success: false, message: 'Sin acceso al checklist de este grupo' });
      }
    }

    let registro = null;

    // Si NO se pide nuevo, buscar el existente del día
    if (!nuevo) {
      const { data: existente } = await supabase
        .from('registros_asistencia')
        .select('*')
        .eq('reunion_id', reunion_id)
        .eq('grupo_id', grupo_id)
        .eq('fecha', fecha)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      registro = existente;
    }

    // Si no hay registro o se pidió uno nuevo, crear
    if (!registro) {
      const { data: nuevo_reg, error } = await supabase
        .from('registros_asistencia')
        .insert({ reunion_id, grupo_id, fecha, registrado_por: req.usuario.id })
        .select()
        .single();
      if (error) throw error;
      registro = nuevo_reg;
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/asistencias/registros-del-dia  — listar registros de hoy para reunión+grupo
// ─────────────────────────────────────────────────────────────────────────────
const registrosDelDia = async (req, res) => {
  try {
    const { reunion_id, grupo_id } = req.query;
    const fecha = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('registros_asistencia')
      .select('id, fecha, created_at, guardado_at, observacion_general')
      .eq('reunion_id', reunion_id)
      .eq('grupo_id', grupo_id)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, registros: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asistencias/marcar
// ─────────────────────────────────────────────────────────────────────────────
const marcarAsistencia = async (req, res) => {
  try {
    const { registro_id, nino_id, llego_tarde, comentario } = req.body;
    const ahora = new Date().toISOString();

    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('registro_id', registro_id)
      .eq('nino_id', nino_id)
      .maybeSingle();

    if (existente) {
      return res
        .status(400)
        .json({ success: false, message: 'El niño ya fue marcado en este registro' });
    }

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

    if (orden === 1) {
      await supabase
        .from('registros_asistencia')
        .update({ hora_primer_visto: ahora })
        .eq('id', registro_id);
    }
    await supabase
      .from('registros_asistencia')
      .update({ hora_ultimo_visto: ahora })
      .eq('id', registro_id);

    res.status(201).json({ success: true, asistencia: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/asistencias/:id  — editar comentario / tarde
// ─────────────────────────────────────────────────────────────────────────────
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


// DELETE /api/asistencias/:id  — desmarcar un niño
const desmarcarAsistencia = async (req, res) => {
  try {
    const { error } = await supabase
      .from('asistencias')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Asistencia desmarcada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asistencias/guardar  — guardar + observación general
// ─────────────────────────────────────────────────────────────────────────────
const guardarRegistro = async (req, res) => {
  try {
    const { registro_id, observacion_general } = req.body;
    const { data, error } = await supabase
      .from('registros_asistencia')
      .update({
        guardado_at: new Date().toISOString(),
        observacion_general: observacion_general?.trim() || null,
      })
      .eq('id', registro_id)
      .select(
        `*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max)`
      )
      .single();
    if (error) throw error;
    res.json({ success: true, registro: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/asistencias/registro/:id/observacion  — guardar solo observación general
// ─────────────────────────────────────────────────────────────────────────────
const actualizarObservacion = async (req, res) => {
  try {
    const { observacion_general } = req.body;
    const { data, error } = await supabase
      .from('registros_asistencia')
      .update({ observacion_general: observacion_general?.trim() || null })
      .eq('id', req.params.id)
      .select('id, observacion_general')
      .single();
    if (error) throw error;
    res.json({ success: true, registro: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/asistencias/historial
// ─────────────────────────────────────────────────────────────────────────────
const historialRegistros = async (req, res) => {
  try {
    const { grupo_id, reunion_id, fecha_inicio, fecha_fin } = req.query;
    let query = supabase
      .from('registros_asistencia')
      .select(
        `*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max), registrado_por:registrado_por(nombre_completo)`
      )
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/asistencias/exportar/:registro_id?formato=xlsx|pdf
// ─────────────────────────────────────────────────────────────────────────────
const exportar = async (req, res) => {
  try {
    const formato = (req.query.formato || 'xlsx').toLowerCase();

    const { data: registro, error: err1 } = await supabase
      .from('registros_asistencia')
      .select(
        `*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max)`
      )
      .eq('id', req.params.registro_id)
      .single();
    if (err1) throw err1;

    const { data: asistencias, error: err2 } = await supabase
      .from('asistencias')
      .select('*, nino:nino_id(nombre_completo)')
      .eq('registro_id', req.params.registro_id)
      .order('orden_llegada');
    if (err2) throw err2;

    const grupo = registro.grupo;
    const reunion = registro.reunion;
    const rangoEdad = grupo ? `${grupo.edad_min} – ${grupo.edad_max} años` : '';
    const nombreArchivo = `asistencia_${grupo?.nombre || 'grupo'}_${registro.fecha}`;

    // ── EXCEL ────────────────────────────────────────────────────────────────
    if (formato === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Cabecera informativa
      const encabezado = [
        ['ESCUELA DOMINICAL VERBO MAÑOSCA'],
        ['Reporte de Asistencia'],
        [],
        ['Reunión:', reunion?.nombre || ''],
        ['Horario:', reunion ? `${reunion.hora_inicio} – ${reunion.hora_fin}` : ''],
        ['Grupo:', grupo?.nombre || ''],
        ['Rango de edad:', rangoEdad],
        ['Fecha:', registro.fecha],
        ['Primer ingreso:', fmt(registro.hora_primer_visto)],
        ['Último ingreso:', fmt(registro.hora_ultimo_visto)],
        ['Total asistentes:', asistencias.length],
      ];

      if (registro.observacion_general) {
        encabezado.push(['Observación general:', registro.observacion_general]);
      }
      encabezado.push([]);

      XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: 'A1' });

      // Tabla de datos
      const filas = asistencias.map((a, i) => ({
        '#': i + 1,
        'Nombre del Niño': a.nino?.nombre_completo || 'N/A',
        'Hora de Llegada': fmtHora(a.hora_llegada),
        'Llegó Tarde': a.llego_tarde ? 'Sí' : 'No',
        'Comentario / Nota': a.comentario || '',
      }));

      const dataStartRow = encabezado.length + 1;
      XLSX.utils.sheet_add_json(ws, filas, { origin: { r: dataStartRow, c: 0 } });

      // Anchos de columna
      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 35 },  // Nombre
        { wch: 16 },  // Hora
        { wch: 12 },  // Tarde
        { wch: 40 },  // Comentario
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      return res.send(buffer);
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
      });

      const AZUL = '#1e40af';
      const AZUL_CLARO = '#dbeafe';
      const GRIS = '#6b7280';
      const NEGRO = '#111827';
      const NARANJA = '#f97316';
      const pageW = doc.page.width - 90; // ancho útil

      // ── Encabezado ──
      doc.rect(45, 40, pageW, 60).fill(AZUL);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(15)
        .text('ESCUELA DOMINICAL VERBO MAÑOSCA', 55, 52, { width: pageW - 20 });
      doc
        .font('Helvetica')
        .fontSize(10)
        .text('Reporte de Asistencia', 55, 72);

      // ── Bloque de info ──
      let y = 118;
      const col1 = 45;
      const col2 = 310;

      const infoItems = [
        ['Reunión', reunion?.nombre || ''],
        ['Horario', reunion ? `${reunion.hora_inicio} – ${reunion.hora_fin}` : ''],
        ['Grupo', grupo?.nombre || ''],
        ['Rango de edad', rangoEdad],
        ['Fecha', registro.fecha],
        ['Primer ingreso', fmt(registro.hora_primer_visto)],
        ['Último ingreso', fmt(registro.hora_ultimo_visto)],
        ['Total asistentes', String(asistencias.length)],
      ];

      // Fondo sutil
      doc.rect(col1, y - 8, pageW, infoItems.length * 18 + 16).fill('#f8fafc');

      infoItems.forEach(([label, val], idx) => {
        const x = idx % 2 === 0 ? col1 + 6 : col2;
        const rowY = y + Math.floor(idx / 2) * 18;
        doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(8).text(`${label}:`, x, rowY);
        doc
          .fillColor(NEGRO)
          .font('Helvetica')
          .fontSize(8)
          .text(val, x + 80, rowY, { width: 150 });
      });

      y += Math.ceil(infoItems.length / 2) * 18 + 20;

      // Observación general
      if (registro.observacion_general) {
        const obsHeight = doc.heightOfString(registro.observacion_general, { width: pageW - 12 }) + 28;
        doc.rect(col1, y, pageW, obsHeight).fill('#fffbeb');
        doc
          .fillColor('#92400e')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('Observación general:', col1 + 6, y + 6);
        doc
          .fillColor(NEGRO)
          .font('Helvetica')
          .fontSize(8)
          .text(registro.observacion_general, col1 + 6, y + 18, { width: pageW - 12 });
        y += doc.heightOfString(registro.observacion_general, { width: pageW - 12 }) + 30;
      }

      // ── Tabla ──
      const colWidths = [30, 220, 75, 65, 155]; // #, Nombre, Hora, Tarde, Comentario
      const headers = ['#', 'Nombre del Niño', 'Hora', 'Tarde', 'Comentario / Nota'];
      const rowH = 18;

      // Cabecera tabla
      doc.rect(col1, y, pageW, rowH).fill(AZUL);
      let x = col1;
      headers.forEach((h, i) => {
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(h, x + 4, y + 5, { width: colWidths[i] - 6, align: i === 0 ? 'center' : 'left' });
        x += colWidths[i];
      });
      y += rowH;

      // Filas
      asistencias.forEach((a, idx) => {
        const rowColor = idx % 2 === 0 ? '#ffffff' : '#f1f5f9';
        doc.rect(col1, y, pageW, rowH).fill(rowColor);

        const vals = [
          String(idx + 1),
          a.nino?.nombre_completo || 'N/A',
          fmtHora(a.hora_llegada),
          a.llego_tarde ? 'Sí' : 'No',
          a.comentario || '',
        ];

        x = col1;
        vals.forEach((v, i) => {
          const color = i === 3 && v === 'Sí' ? NARANJA : NEGRO;
          doc
            .fillColor(color)
            .font(i === 3 && v === 'Sí' ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8)
            .text(v, x + 4, y + 5, { width: colWidths[i] - 6, align: i === 0 ? 'center' : 'left' });
          x += colWidths[i];
        });

        // línea separadora
        doc.moveTo(col1, y + rowH).lineTo(col1 + pageW, y + rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        y += rowH;

        // Nueva página si es necesario
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 45;
        }
      });

      // Fila total
      y += 4;
      doc.rect(col1, y, pageW, rowH).fill(AZUL_CLARO);
      doc
        .fillColor(AZUL)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(`Total de asistentes: ${asistencias.length}`, col1 + 6, y + 5);
      y += rowH + 16;

      // Pie de página
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(7)
        .text(
          `Generado el ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`,
          col1,
          y
        );

      doc.end();
      return;
    }

    res.status(400).json({ success: false, message: 'Formato no soportado. Usa xlsx o pdf' });
  } catch (err) {
    console.error('ERROR EXPORTAR PDF:', err);
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
};

module.exports = {
  iniciarRegistro,
  registrosDelDia,
  marcarAsistencia,
  editarAsistencia,
  desmarcarAsistencia,
  guardarRegistro,
  actualizarObservacion,
  historialRegistros,
  exportar,
};
