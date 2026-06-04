// ============================================================
// routes/usuarioRoutes.js
// ============================================================
const express = require('express');
const routerU = express.Router();
const { listarUsuarios, obtenerUsuario, actualizarUsuario, eliminarUsuario } = require('../controllers/usuarioController');
const { proteger, soloAdmin } = require('../middleware/authMiddleware');
const { reglasUsuario, validar } = require('../middleware/validarMiddleware');

routerU.get('/', proteger, listarUsuarios);
routerU.get('/:id', proteger, obtenerUsuario);
routerU.put('/:id', proteger, soloAdmin, [...reglasUsuario, validar], actualizarUsuario);
routerU.delete('/:id', proteger, soloAdmin, eliminarUsuario);

module.exports = routerU;
