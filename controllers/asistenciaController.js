const supabase = require('../config/supabase');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

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

const iniciarRegistro = async (req, res) => {
  try {
    const { reunion_id, grupo_id, nuevo } = req.body;
    const fecha = new Date().toISOString().split('T')[0];

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
        return res.status(403).json({ success: false, message: 'Sin acceso al checklist de este grupo' });
      }
    }

    let registro = null;

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

    if (!registro) {
      const { data: nuevo_reg, error } = await supabase
        .from('registros_asistencia')
        .insert({ reunion_id, grupo_id, fecha, registrado_por: req.usuario.id })
        .select()
        .single();
      if (error) throw error;
      registro = nuevo_reg;
    }

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
      return res.status(400).json({ success: false, message: 'El nino ya fue marcado en este registro' });
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
      await supabase.from('registros_asistencia').update({ hora_primer_visto: ahora }).eq('id', registro_id);
    }
    await supabase.from('registros_asistencia').update({ hora_ultimo_visto: ahora }).eq('id', registro_id);

    res.status(201).json({ success: true, asistencia: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const desmarcarAsistencia = async (req, res) => {
  try {
    const { error } = await supabase.from('asistencias').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Asistencia desmarcada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
      .select('*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max)')
      .single();
    if (error) throw error;
    res.json({ success: true, registro: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const historialRegistros = async (req, res) => {
  try {
    const { grupo_id, reunion_id, fecha_inicio, fecha_fin } = req.query;
    let query = supabase
      .from('registros_asistencia')
      .select('*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max), registrado_por:registrado_por(nombre_completo)')
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

const exportar = async (req, res) => {
  try {
    const formato = (req.query.formato || 'xlsx').toLowerCase();

    const { data: registro, error: err1 } = await supabase
      .from('registros_asistencia')
      .select('*, reunion:reunion_id(nombre, hora_inicio, hora_fin), grupo:grupo_id(nombre, edad_min, edad_max)')
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
    const rangoEdad = grupo ? `${grupo.edad_min} - ${grupo.edad_max} anos` : '';
    const nombreArchivo = `asistencia_${grupo?.nombre || 'grupo'}_${registro.fecha}`;

    // EXCEL
    if (formato === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Verbo Manosca';
      const ws = wb.addWorksheet('Asistencia', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
      });

      ws.columns = [
        { key: 'A', width: 6  },
        { key: 'B', width: 36 },
        { key: 'C', width: 18 },
        { key: 'D', width: 13 },
        { key: 'E', width: 42 },
      ];

      const azul      = '1E40AF';
      const azulClaro = 'DBEAFE';
      const grisClaro = 'F1F5F9';
      const infoBg    = 'F8FAFC';
      const naranja   = 'F97316';
      const amarillo  = 'FFFBEB';
      const marron    = '92400E';

      const borde = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const fillSolid = (argb) => ({
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + argb },
      });

      const styleRow = (row, bgArgb, fontColor, bold, sz, center) => {
        fontColor = fontColor || '111827';
        bold = bold || false;
        sz = sz || 10;
        center = center || false;
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill      = fillSolid(bgArgb);
          cell.font      = { bold, color: { argb: 'FF' + fontColor }, size: sz };
          cell.border    = borde;
          cell.alignment = { vertical: 'middle', horizontal: center ? 'center' : 'left', wrapText: true };
        });
      };

      // Titulo
      const r1 = ws.addRow(['ESCUELA DOMINICAL VERBO MAÑOSCA', '', '', '', '']);
      ws.mergeCells('A' + r1.number + ':E' + r1.number);
      r1.height = 30;
      styleRow(r1, azul, 'FFFFFF', true, 15, true);

      // Subtitulo
      const r2 = ws.addRow(['Reporte de Asistencia', '', '', '', '']);
      ws.mergeCells('A' + r2.number + ':E' + r2.number);
      r2.height = 20;
      styleRow(r2, azul, 'FFFFFF', false, 11, true);

      ws.addRow([]);

      // Info
      const infoItems = [
        ['Reunion',          reunion ? reunion.nombre : ''],
        ['Horario',          reunion ? reunion.hora_inicio + ' - ' + reunion.hora_fin : ''],
        ['Grupo',            grupo ? grupo.nombre : ''],
        ['Rango de edad',    rangoEdad],
        ['Fecha',            registro.fecha],
        ['Primer ingreso',   fmt(registro.hora_primer_visto)],
        ['Ultimo ingreso',   fmt(registro.hora_ultimo_visto)],
        ['Total asistentes', String(asistencias.length)],
      ];

      for (let i = 0; i < infoItems.length; i += 2) {
        const l1 = infoItems[i][0];
        const v1 = infoItems[i][1];
        const l2 = infoItems[i + 1] ? infoItems[i + 1][0] : '';
        const v2 = infoItems[i + 1] ? infoItems[i + 1][1] : '';
        const row = ws.addRow([l1, v1, l2, v2, '']);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill      = fillSolid(infoBg);
          cell.border    = borde;
          cell.font      = { bold: colNum === 1 || colNum === 3, size: 9, color: { argb: 'FF111827' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      }

      // Observacion general
      if (registro.observacion_general) {
        ws.addRow([]);
        const rObs1 = ws.addRow(['Observacion general:', '', '', '', '']);
        ws.mergeCells('A' + rObs1.number + ':E' + rObs1.number);
        rObs1.height = 18;
        styleRow(rObs1, amarillo, marron, true, 9);

        const rObs2 = ws.addRow([registro.observacion_general, '', '', '', '']);
        ws.mergeCells('A' + rObs2.number + ':E' + rObs2.number);
        const obsLen = registro.observacion_general.length;
        rObs2.height = obsLen > 200 ? 80 : obsLen > 100 ? 50 : 32;
        styleRow(rObs2, amarillo, '111827', false, 9);
        rObs2.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
      }

      ws.addRow([]);

      // Cabecera tabla
      const rHead = ws.addRow(['#', 'Nombre del Niño', 'Hora de Llegada', 'Llego Tarde', 'Comentario / Nota']);
      rHead.height = 22;
      styleRow(rHead, azul, 'FFFFFF', true, 10, true);

      // Filas de datos
      asistencias.forEach((a, idx) => {
        const bg    = idx % 2 === 0 ? 'FFFFFF' : grisClaro;
        const tarde = a.llego_tarde ? 'Si' : 'No';
        const rData = ws.addRow([
          idx + 1,
          a.nino ? a.nino.nombre_completo : 'N/A',
          fmtHora(a.hora_llegada),
          tarde,
          a.comentario || '',
        ]);
        const cLen = (a.comentario || '').length;
        rData.height = cLen > 80 ? 48 : cLen > 40 ? 32 : 18;

        rData.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const isTarde = colNum === 4 && tarde === 'Si';
          cell.fill      = fillSolid(bg);
          cell.border    = borde;
          cell.font      = { bold: isTarde, size: 10, color: { argb: isTarde ? 'FF' + naranja : 'FF111827' } };
          cell.alignment = {
            vertical:   'middle',
            horizontal: colNum === 5 ? 'left' : 'center',
            wrapText:   true,
          };
        });
      });

      // Total
      const rTotal = ws.addRow(['Total de asistentes: ' + asistencias.length, '', '', '', '']);
      ws.mergeCells('A' + rTotal.number + ':E' + rTotal.number);
      rTotal.height = 20;
      styleRow(rTotal, azulClaro, azul, true, 10, true);

      // Pie
      ws.addRow([]);
      const rFecha = ws.addRow([
        'Generado el ' + new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
        '', '', '', '',
      ]);
      ws.mergeCells('A' + rFecha.number + ':E' + rFecha.number);
      styleRow(rFecha, 'FFFFFF', '6B7280', false, 8);

      // Ajuste automatico de ancho
      const colMaxLen = [6, 16, 16, 13, 10];
      asistencias.forEach((a, i) => {
        const vals = [
          String(i + 1),
          a.nino ? a.nino.nombre_completo : 'N/A',
          fmtHora(a.hora_llegada),
          a.llego_tarde ? 'Si' : 'No',
          a.comentario || '',
        ];
        vals.forEach((v, ci) => {
          const eff = ci === 4 ? Math.min(v.length, 60) : v.length;
          if (eff > colMaxLen[ci]) colMaxLen[ci] = eff;
        });
      });
      infoItems.forEach(([l, v], i) => {
        const colL = i % 2 === 0 ? 0 : 2;
        const colV = i % 2 === 0 ? 1 : 3;
        if (l.length + 2 > colMaxLen[colL]) colMaxLen[colL] = l.length + 2;
        if (v.length + 2 > colMaxLen[colV]) colMaxLen[colV] = v.length + 2;
      });

      ws.getColumn(1).width = Math.max(colMaxLen[0] + 3, 6);
      ws.getColumn(2).width = Math.max(colMaxLen[1] + 3, 20);
      ws.getColumn(3).width = Math.max(colMaxLen[2] + 3, 16);
      ws.getColumn(4).width = Math.max(colMaxLen[3] + 3, 13);
      ws.getColumn(5).width = Math.max(colMaxLen[4] + 3, 20);

      res.setHeader('Content-Disposition', 'attachment; filename="' + nombreArchivo + '.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    // PDF
    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        res.setHeader('Content-Disposition', 'attachment; filename="' + nombreArchivo + '.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
      });

      const AZUL       = '#1e40af';
      const AZUL_CLARO = '#dbeafe';
      const GRIS       = '#6b7280';
      const NEGRO      = '#111827';
      const NARANJA    = '#f97316';
      const pageW      = doc.page.width - 90;

      doc.rect(45, 40, pageW, 60).fill(AZUL);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
        .text('ESCUELA DOMINICAL VERBO MAÑOSCA', 55, 52, { width: pageW - 20, align: 'center' });
      doc.font('Helvetica').fontSize(10).text('Reporte de Asistencia', 55, 72, { width: pageW - 20, align: 'center' });

      let y = 118;
      const col1 = 45;
      const col2 = 310;

      const infoItemsPDF = [
        ['Reunion',          reunion ? reunion.nombre : ''],
        ['Horario',          reunion ? reunion.hora_inicio + ' - ' + reunion.hora_fin : ''],
        ['Grupo',            grupo ? grupo.nombre : ''],
        ['Rango de edad',    rangoEdad],
        ['Fecha',            registro.fecha],
        ['Primer ingreso',   fmt(registro.hora_primer_visto)],
        ['Ultimo ingreso',   fmt(registro.hora_ultimo_visto)],
        ['Total asistentes', String(asistencias.length)],
      ];

      doc.rect(col1, y - 8, pageW, infoItemsPDF.length * 18 + 16).fill('#f8fafc');
      infoItemsPDF.forEach(([label, val], idx) => {
        const x    = idx % 2 === 0 ? col1 + 6 : col2;
        const rowY = y + Math.floor(idx / 2) * 18;
        doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(8).text(label + ':', x, rowY);
        doc.fillColor(NEGRO).font('Helvetica').fontSize(8).text(val, x + 80, rowY, { width: 150 });
      });
      y += Math.ceil(infoItemsPDF.length / 2) * 18 + 20;

      if (registro.observacion_general) {
        const obsHeight = doc.heightOfString(registro.observacion_general, { width: pageW - 12 }) + 28;
        doc.rect(col1, y, pageW, obsHeight).fill('#fffbeb');
        doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(8).text('Observacion general:', col1 + 6, y + 6);
        doc.fillColor(NEGRO).font('Helvetica').fontSize(8)
          .text(registro.observacion_general, col1 + 6, y + 18, { width: pageW - 12 });
        y += doc.heightOfString(registro.observacion_general, { width: pageW - 12 }) + 30;
      }

      const colWidths = [30, 220, 75, 65, 155];
      const headers   = ['#', 'Nombre del Niño', 'Hora', 'Tarde', 'Comentario / Nota'];
      const rowH      = 18;

      doc.rect(col1, y, pageW, rowH).fill(AZUL);
      let x = col1;
      headers.forEach((h, i) => {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
          .text(h, x + 4, y + 5, { width: colWidths[i] - 6, align: 'center' });
        x += colWidths[i];
      });
      y += rowH;

      asistencias.forEach((a, idx) => {
        const rowColor = idx % 2 === 0 ? '#ffffff' : '#f1f5f9';
        doc.rect(col1, y, pageW, rowH).fill(rowColor);
        const vals = [
          String(idx + 1),
          a.nino ? a.nino.nombre_completo : 'N/A',
          fmtHora(a.hora_llegada),
          a.llego_tarde ? 'Si' : 'No',
          a.comentario || '',
        ];
        x = col1;
        vals.forEach((v, i) => {
          const color = i === 3 && v === 'Si' ? NARANJA : NEGRO;
          doc.fillColor(color)
            .font(i === 3 && v === 'Si' ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8)
            .text(v, x + 4, y + 5, { width: colWidths[i] - 6, align: i === 4 ? 'left' : 'center' });
          x += colWidths[i];
        });
        doc.moveTo(col1, y + rowH).lineTo(col1 + pageW, y + rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        y += rowH;
        if (y > doc.page.height - 60) { doc.addPage(); y = 45; }
      });

      y += 4;
      doc.rect(col1, y, pageW, rowH).fill(AZUL_CLARO);
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(8)
        .text('Total de asistentes: ' + asistencias.length, col1 + 6, y + 5);
      y += rowH + 16;

      doc.fillColor(GRIS).font('Helvetica').fontSize(7)
        .text('Generado el ' + new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }), col1, y);

      doc.end();
      return;
    }

    res.status(400).json({ success: false, message: 'Formato no soportado. Usa xlsx o pdf' });
  } catch (err) {
    console.error('ERROR EXPORTAR:', err);
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
