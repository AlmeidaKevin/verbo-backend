const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicacionController');
const { proteger, soloAdmin } = require('../middleware/authMiddleware');
const { reglasPublicacion, validar } = require('../middleware/validarMiddleware');
const { uploadArchivos } = require('../middleware/uploadMiddleware');


router.get('/no-vistas', proteger, ctrl.contarNoVistas);
router.post('/marcar-vistas', proteger, ctrl.marcarVistas);
// Ruta pública (sin auth) para niños
router.get('/publico', ctrl.publicacionesPublicas);

router.get('/', proteger, ctrl.listarPublicaciones);
router.post('/', proteger, soloAdmin, (req, res, next) => uploadArchivos(req, res, next), [...reglasPublicacion, validar], ctrl.crearPublicacion);
router.put('/:id', proteger, soloAdmin, ctrl.actualizarPublicacion);
router.delete('/:id', proteger, soloAdmin, ctrl.eliminarPublicacion);
module.exports = router;
