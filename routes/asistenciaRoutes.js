const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/asistenciaController');
const { proteger } = require('../middleware/authMiddleware');

router.post('/registro', proteger, ctrl.iniciarRegistro);
router.post('/marcar', proteger, ctrl.marcarAsistencia);
router.put('/:id', proteger, ctrl.editarAsistencia);
router.post('/guardar', proteger, ctrl.guardarRegistro);
router.get('/historial', proteger, ctrl.historialRegistros);
router.get('/exportar/:registro_id', proteger, ctrl.exportarExcel);
module.exports = router;
