const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarEmail = async ({ to, subject, html, text }) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Escuela Dominical <onboarding@resend.dev>',
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(error.message || 'Error al enviar email');
  }

  console.log('Email enviado:', data.id, '→', to);
  return data;
};

module.exports = { enviarEmail };
