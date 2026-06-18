const { body, param, validationResult } = require('express-validator');

// Verificar resultados de validación
const validar = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errores: errores.array().map(e => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
};

// Reglas para usuario (admin, docente, ayudante)
const reglasUsuario = [
  body('nombre_completo')
    .trim()
    .notEmpty().withMessage('El nombre completo es requerido')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras'),
  body('cedula')
    .trim()
    .notEmpty().withMessage('La cédula es requerida')
    .matches(/^\d{8,15}$/).withMessage('La cédula solo debe contener entre 8 y 15 dígitos'),
  body('email')
    .trim()
    .isEmail().withMessage('Email inválido'),
  body('telefono')
    .trim()
    .notEmpty().withMessage('El teléfono es requerido')
    .matches(/^\d{7,15}$/).withMessage('El teléfono solo debe contener entre 7 y 15 dígitos'),
  body('rol')
    .isIn(['admin', 'docente', 'ayudante']).withMessage('Rol inválido'),
];

const reglasPassword = [
  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe tener al menos una mayúscula')
    .matches(/[a-z]/).withMessage('La contraseña debe tener al menos una minúscula')
    .matches(/\d/).withMessage('La contraseña debe tener al menos un número')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('La contraseña debe tener al menos un carácter especial'),
];

// Reglas para niño
const reglasNino = [
  body('nombre_completo')
    .trim()
    .notEmpty().withMessage('El nombre completo es requerido')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras'),
  body('edad')
    .optional()
    .isInt({ min: 0, max: 17 }).withMessage('La edad debe ser un número entero entre 0 y 17'),
];

// Reglas para reunión
const reglasReunion = [
  body('nombre').trim().notEmpty().withMessage('El nombre de la reunión es requerido'),
  body('hora_inicio')
    .matches(/^\d{2}:\d{2}$/).withMessage('Hora de inicio inválida (formato HH:MM)'),
  body('hora_fin')
    .matches(/^\d{2}:\d{2}$/).withMessage('Hora de fin inválida (formato HH:MM)'),
];

// Reglas para grupo
const reglasGrupo = [
  body('nombre').trim().notEmpty().withMessage('El nombre del grupo es requerido'),
  body('reunion_id').isUUID().withMessage('ID de reunión inválido'),
  body('edad_min')
    .isInt({ min: 0 }).withMessage('La edad mínima debe ser un entero positivo'),
  body('edad_max')
    .isInt({ min: 1 }).withMessage('La edad máxima debe ser un entero mayor a 0'),
];

// Reglas para tarea
const reglasTarea = [
  body('titulo').trim().notEmpty().withMessage('El título es requerido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es requerida'),
];

// Reglas para publicación
const reglasPublicacion = [
  body('titulo').trim().notEmpty().withMessage('El título es requerido'),
  body('contenido').trim().notEmpty().withMessage('El contenido es requerido'),
  body('tipo_destinatario')
    .isIn([
      'todos', 'solo_docentes', 'solo_ayudantes',
      'docentes_especificos', 'ayudantes_especificos',
      'grupos_con_ninos', 'grupos_sin_ninos',
      'grupo_especifico_con_ninos', 'grupo_especifico_sin_ninos'
    ])
    .withMessage('Tipo de destinatario inválido'),
];

module.exports = {
  validar,
  reglasUsuario,
  reglasPassword,
  reglasNino,
  reglasReunion,
  reglasGrupo,
  reglasTarea,
  reglasPublicacion,
};
