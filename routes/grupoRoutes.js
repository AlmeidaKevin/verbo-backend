const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/grupoController');
const { proteger, soloAdmin, adminODocente } = require('../middleware/authMiddleware');
const { reglasGrupo, validar } = require('../middleware/validarMiddleware');

router.get('/', proteger, ctrl.listarGrupos);
router.get('/:id', proteger, ctrl.obtenerGrupo);
router.post('/', proteger, soloAdmin, [...reglasGrupo, validar], ctrl.crearGrupo);
router.put('/:id', proteger, soloAdmin, ctrl.actualizarGrupo);
router.delete('/:id', proteger, soloAdmin, ctrl.eliminarGrupo);
module.exports = router;
