// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { login, crearUsuario, olvidéPassword, resetPassword, obtenerPerfil, actualizarPerfil, cambiarPassword, verificarCuenta } = require('../controllers/authController');
const { proteger, soloAdmin } = require('../middleware/authMiddleware');
const { reglasUsuario, reglasPassword, validar } = require('../middleware/validarMiddleware');
const { uploadFoto } = require('../middleware/uploadMiddleware');
const { subirFotoPerfil } = require('../controllers/usuarioController');

router.post('/login', login);
router.post('/olvide-password', olvidéPassword);
router.post('/reset-password/:token', [...reglasPassword, validar], resetPassword);
router.post('/crear-usuario', proteger, soloAdmin, [...reglasUsuario, ...reglasPassword, validar], crearUsuario);

router.get('/verificar/:token', verificarCuenta);
router.get('/perfil', proteger, obtenerPerfil);
router.put('/perfil', proteger, actualizarPerfil);
router.put('/cambiar-password', proteger, [...reglasPassword.map(r => r.customWithMessage ? r : r), validar], cambiarPassword);
router.post('/perfil/foto', proteger, (req, res, next) => uploadFoto(req, res, next), subirFotoPerfil);

module.exports = router;
