const nodemailer = require('nodemailer');

const crearTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: parseInt(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000, // 10s máximo para conectar
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const enviarEmail = async ({ to, subject, html, text }) => {
  const transporter = crearTransporter();

  const info = await transporter.sendMail({
    from: `"Escuela Dominical Verbo Mañosca" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });

  console.log('Email enviado:', info.messageId, '→', to);
  return info;
};

module.exports = { enviarEmail };
