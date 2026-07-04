const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
dotenv.config();

const { iniciarCronJobs } = require('./services/cronService');

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/usuarios', require('./routes/usuarioRoutes'));
app.use('/api/reuniones', require('./routes/reunionRoutes'));
app.use('/api/grupos', require('./routes/grupoRoutes'));
app.use('/api/ninos', require('./routes/ninoRoutes'));
app.use('/api/asistencias', require('./routes/asistenciaRoutes'));
app.use('/api/tareas', require('./routes/tareaRoutes'));
app.use('/api/publicaciones', require('./routes/publicacionRoutes'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', message: 'Verbo Mañosca API corriendo ✅', timestamp: new Date() })
);
app.use('/api/chat', require('./routes/chatRoutes'));

// Error handler global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  iniciarCronJobs();
});

module.exports = app;
