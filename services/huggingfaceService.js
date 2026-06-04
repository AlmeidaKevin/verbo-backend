// Servicio HuggingFace para generar tareas con IA
// Modelo: mistralai/Mistral-7B-Instruct-v0.3 (gratuito en HF Inference API)

const generarTareaIA = async (descripcionUsuario, indice = 0) => {
  const prompt = `<s>[INST] Eres un asistente educativo para una escuela dominical cristiana para niños.
El docente necesita crear una tarea para sus estudiantes.
Descripción del docente: "${descripcionUsuario}"

Genera la opción número ${indice + 1} de tarea educativa cristiana para niños.
Responde SOLO con un JSON válido con esta estructura exacta (sin texto adicional):
{
  "titulo": "Título breve y atractivo para niños",
  "descripcion": "Descripción detallada de la tarea, máximo 3 párrafos, adecuada para niños de escuela dominical"
}
[/INST]`;

  const response = await fetch(
    'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.7 + indice * 0.1, // variar temperatura para opciones distintas
          return_full_text: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HuggingFace error: ${err}`);
  }

  const data = await response.json();

  // Extraer el texto generado
  let texto = '';
  if (Array.isArray(data) && data[0]?.generated_text) {
    texto = data[0].generated_text;
  } else if (data.generated_text) {
    texto = data.generated_text;
  } else {
    throw new Error('Respuesta inesperada de HuggingFace');
  }

  // Extraer JSON del texto
  const jsonMatch = texto.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta');
  }

  const resultado = JSON.parse(jsonMatch[0]);

  if (!resultado.titulo || !resultado.descripcion) {
    throw new Error('Respuesta JSON incompleta');
  }

  return {
    titulo: resultado.titulo,
    descripcion: resultado.descripcion,
    indice,
  };
};

module.exports = { generarTareaIA };
