const enviarEmail = async ({ to, subject, html }) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: 'Escuela Dominical Verbo Mañosca',
        email: process.env.EMAIL_FROM,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Brevo error:', error);
    throw new Error(JSON.stringify(error));
  }

  console.log('✅ Correo enviado a:', to);
};

module.exports = { enviarEmail };
