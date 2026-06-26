const enviarEmail = async ({ to, subject, html }) => {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: {
        email: process.env.EMAIL_FROM,
        name: 'Escuela Dominical Verbo Mañosca',
      },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    console.error('❌ SendGrid error:', error);
    throw new Error(JSON.stringify(error));
  }

  console.log('✅ Correo enviado a:', to);
};

module.exports = { enviarEmail };
