const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/asistenciaController');
const { proteger } = require('../middleware/authMiddleware');

router.post('/registro', proteger, ctrl.iniciarRegistro);
router.get('/registros-del-dia', proteger, ctrl.registrosDelDia);
router.post('/marcar', proteger, ctrl.marcarAsistencia);
router.put('/:id', proteger, ctrl.editarAsistencia);
router.put('/registro/:id/observacion', proteger, ctrl.actualizarObservacion);
router.post('/guardar', proteger, ctrl.guardarRegistro);
router.get('/historial', proteger, ctrl.historialRegistros);
router.get('/exportar/:registro_id', proteger, ctrl.exportar);

module.exports = router;
