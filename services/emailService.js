const axios = require('axios');

const enviarEmail = async ({ to, subject, html, text }) => {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'Escuela Dominical Verbo Mañosca',
          email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log('Email enviado:', response.data.messageId, '→', to);
    return response.data;
  } catch (err) {
    const detalle = err.response?.data?.message || err.message;
    console.error('Brevo error:', detalle);
    throw new Error(detalle);
  }
};

module.exports = { enviarEmail };
