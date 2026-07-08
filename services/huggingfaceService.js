// Servicio de generación de tareas con IA
// Modelo: mistralai/Mistral-7B-Instruct-v0.3 con fallback local ante timeout

const generarTareaIA = async (descripcionUsuario, indice = 0) => {
  const temas = [
    `Crea una tarea educativa cristiana para niños de escuela dominical sobre: ${descripcionUsuario}. Incluye título y actividad práctica.`,
    `Diseña una actividad bíblica creativa para niños sobre: ${descripcionUsuario}. Debe ser divertida y educativa.`,
    `Genera una tarea de escuela dominical sobre: ${descripcionUsuario}. Incluye reflexión y actividad para niños.`,
  ];

  const prompt = temas[indice % temas.length];

  const response = await fetch(
    'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `<s>[INST] Eres un asistente para escuela dominical cristiana para niños. 
Genera una tarea educativa cristiana.
Solicitud: "${descripcionUsuario}"
Opción número ${indice + 1}.
Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"titulo": "título breve", "descripcion": "descripción de máximo 2 párrafos para niños"} [/INST]`,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.6 + (indice * 0.15),
          return_full_text: false,
          do_sample: true,
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    // Si el modelo está cargando, esperar y reintentar una vez
    if (response.status === 503) {
      await new Promise(r => setTimeout(r, 8000));
      return generarTareaIA(descripcionUsuario, indice);
    }
    throw new Error(`HuggingFace error ${response.status}: ${err}`);
  }

  const data = await response.json();

  let texto = '';
  if (Array.isArray(data) && data[0]?.generated_text) {
    texto = data[0].generated_text;
  } else if (data.generated_text) {
    texto = data.generated_text;
  } else if (data.error) {
    throw new Error(`HuggingFace: ${data.error}`);
  } else {
    throw new Error('Respuesta inesperada de HuggingFace');
  }

  // Intentar extraer JSON
  const jsonMatch = texto.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const resultado = JSON.parse(jsonMatch[0]);
      if (resultado.titulo && resultado.descripcion) {
        return { titulo: resultado.titulo, descripcion: resultado.descripcion, indice };
      }
    } catch {}
  }

  // Fallback: si no devuelve JSON válido, generar localmente
  return generarFallback(descripcionUsuario, indice);
};

// Fallback local si HuggingFace falla o no devuelve JSON válido
const generarFallback = (descripcionUsuario, indice) => {
  const opciones = [
    {
      titulo: `Explorando: ${descripcionUsuario}`,
      descripcion: `En esta actividad aprenderemos sobre ${descripcionUsuario} a través de la Biblia. Los niños deberán buscar versículos relacionados con el tema y reflexionar sobre cómo aplicar estas enseñanzas en su vida diaria.\n\nActividad: Dibuja o escribe lo que aprendiste hoy sobre ${descripcionUsuario} y compártelo con tu familia.`,
    },
    {
      titulo: `Lección bíblica: ${descripcionUsuario}`,
      descripcion: `Dios nos enseña sobre ${descripcionUsuario} a través de Su Palabra. En esta tarea, los niños leerán un pasaje bíblico relacionado y responderán preguntas sencillas para reflexionar sobre su significado.\n\nRecuerda: "La Palabra de Dios es lámpara a mis pies y lumbrera a mi camino" (Salmo 119:105).`,
    },
    {
      titulo: `Desafío cristiano: ${descripcionUsuario}`,
      descripcion: `Esta semana nuestro desafío es aprender más sobre ${descripcionUsuario}. Los niños deberán practicar en casa lo que aprendieron en clase y contarle a alguien de su familia lo más importante de la lección.\n\nNo olvides orar pidiendo a Dios que te ayude a vivir según Sus enseñanzas.`,
    },
  ];

  return { ...opciones[indice % opciones.length], indice };
};

module.exports = { generarTareaIA };
