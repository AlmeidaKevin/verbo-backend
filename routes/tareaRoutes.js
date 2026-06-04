// routes/tareaRoutes.js
const express = require('express');
const r1 = express.Router();
const ctrl1 = require('../controllers/tareaController');
const { proteger, adminODocente } = require('../middleware/authMiddleware');
const { reglasTarea, validar } = require('../middleware/validarMiddleware');
const { uploadArchivos } = require('../middleware/uploadMiddleware');

r1.get('/', proteger, ctrl1.listarTareas);
r1.post('/', proteger, adminODocente, (req, res, next) => uploadArchivos(req, res, next), [...reglasTarea, validar], ctrl1.crearTarea);
r1.put('/:id', proteger, adminODocente, ctrl1.actualizarTarea);
r1.delete('/:id', proteger, adminODocente, ctrl1.eliminarTarea);
r1.post('/generar-ia', proteger, adminODocente, ctrl1.generarConIA);
module.exports = r1;
