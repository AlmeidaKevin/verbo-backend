const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ninoController');
const { proteger } = require('../middleware/authMiddleware');
const { reglasNino, validar } = require('../middleware/validarMiddleware');

router.get('/', proteger, ctrl.listarNinos);
router.get('/:id', proteger, ctrl.obtenerNino);
router.post('/', proteger, [...reglasNino, validar], ctrl.crearNino);
router.put('/:id', proteger, [...reglasNino, validar], ctrl.actualizarNino);
router.delete('/:id', proteger, ctrl.eliminarNino);
module.exports = router;
