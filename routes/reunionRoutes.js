// routes/reunionRoutes.js
const express = require('express');
const r1 = express.Router();
const ctrl1 = require('../controllers/reunionController');
const { proteger, soloAdmin } = require('../middleware/authMiddleware');
const { reglasReunion, validar } = require('../middleware/validarMiddleware');
r1.get('/publico', ctrl1.listarReunionesPublico);
r1.get('/', proteger, ctrl1.listarReuniones);
r1.get('/:id', proteger, ctrl1.obtenerReunion);
r1.post('/', proteger, soloAdmin, [...reglasReunion, validar], ctrl1.crearReunion);
r1.put('/:id', proteger, soloAdmin, ctrl1.actualizarReunion);
r1.delete('/:id', proteger, soloAdmin, ctrl1.eliminarReunion);
module.exports = r1;
