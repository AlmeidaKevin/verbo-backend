const cron = require('node-cron');
const supabase = require('../config/supabase');
const { enviarEmail } = require('./emailService');

const iniciarCronJobs = () => {
  // Cada sábado a las 8:00 AM — recordatorio de clase dominical
  cron.schedule('0 8 * * 6', async () => {
    console.log('Ejecutando recordatorio semanal...');
    try {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('email, nombre_completo')
        .eq('activo', true);

      if (!usuarios || usuarios.length === 0) return;

      const { data: reuniones } = await supabase
        .from('reuniones')
        .select('nombre, hora_inicio, hora_fin')
        .eq('activo', true)
        .order('hora_inicio');

      const horarios = reuniones?.map(r => `• ${r.nombre}: ${r.hora_inicio} - ${r.hora_fin}`).join('<br>') || '';

      for (const usuario of usuarios) {
        await enviarEmail({
          to: usuario.email,
          subject: '¡Mañana es Escuela Dominical! 🙏',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
              <h2 style="color:#6366f1">¡Hola ${usuario.nombre_completo}!</h2>
              <p>Te recordamos que mañana es Escuela Dominical.</p>
              <h3>Horarios de reuniones:</h3>
              <p>${horarios}</p>
              <p>¡Te esperamos! 🙌</p>
            </div>
          `,
        });
      }
      console.log(`Recordatorios enviados a ${usuarios.length} usuarios`);
    } catch (err) {
      console.error('Error en cron recordatorio:', err.message);
    }
  }, { timezone: 'America/Guayaquil' });

  console.log('✅ Cron jobs iniciados (recordatorio dominical: sábados 8:00 AM)');
};

module.exports = { iniciarCronJobs };
