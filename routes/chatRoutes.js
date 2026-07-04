const express = require('express');
const router = express.Router();
const { proteger } = require('../middleware/authMiddleware');
const { uploadFoto } = require('../middleware/uploadMiddleware');
const {
  listarConversaciones, listarMensajes, crearOBuscarConversacion,
  enviarMensaje, marcarRecibido, contarNoLeidos, buscarUsuarios, subirArchivo,
} = require('../controllers/chatController');

router.get('/no-leidos', proteger, contarNoLeidos);
router.get('/conversaciones', proteger, listarConversaciones);
router.get('/mensajes/:conversacionId', proteger, listarMensajes);
router.get('/buscar-usuarios', proteger, buscarUsuarios);
router.post('/conversaciones', proteger, crearOBuscarConversacion);
router.post('/mensajes', proteger, enviarMensaje);
router.put('/mensajes/:id/recibido', proteger, marcarRecibido);
router.post('/subir-archivo', proteger, (req, res, next) => uploadFoto(req, res, next), subirArchivo);

module.exports = router;
