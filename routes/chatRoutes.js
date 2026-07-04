const express = require('express');
const router = express.Router();
const multer = require('multer');
const { proteger } = require('../middleware/authMiddleware');
const {
  listarConversaciones, listarMensajes, crearOBuscarConversacion,
  enviarMensaje, marcarRecibido, contarNoLeidos, buscarUsuarios, subirArchivo,
} = require('../controllers/chatController');

const uploadChat = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

router.get('/no-leidos', proteger, contarNoLeidos);
router.get('/conversaciones', proteger, listarConversaciones);
router.get('/mensajes/:conversacionId', proteger, listarMensajes);
router.get('/buscar-usuarios', proteger, buscarUsuarios);
router.post('/conversaciones', proteger, crearOBuscarConversacion);
router.post('/mensajes', proteger, enviarMensaje);
router.put('/mensajes/:id/recibido', proteger, marcarRecibido);
router.post('/subir-archivo', proteger, (req, res, next) => uploadChat(req, res, next), subirArchivo);

module.exports = router;
