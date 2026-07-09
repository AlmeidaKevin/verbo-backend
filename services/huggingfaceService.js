// Servicio de generación de tareas con IA
// Modelo: mistralai/Mistral-7B-Instruct-v0.3 con fallback local ante timeout

// Servicio de generación de tareas con IA
// Modelo: mistralai/Mistral-7B-Instruct-v0.3 con fallback local ante timeout

const generarTareaIA = async (descripcionUsuario, indice = 0) => {
  try {
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
        signal: AbortSignal.timeout(20000), // 20 segundos máximo
      }
    );

    if (!response.ok) throw new Error(`HuggingFace status: ${response.status}`);

    const data = await response.json();
    let texto = '';
    if (Array.isArray(data) && data[0]?.generated_text) texto = data[0].generated_text;
    else if (data.generated_text) texto = data.generated_text;
    else throw new Error('Respuesta inesperada');

    const jsonMatch = texto.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const resultado = JSON.parse(jsonMatch[0]);
      if (resultado.titulo && resultado.descripcion) {
        return { titulo: resultado.titulo, descripcion: resultado.descripcion, indice };
      }
    }
    throw new Error('JSON inválido');
  } catch (err) {
    console.log('HuggingFace no disponible, usando generador local:', err.message);
    return generarFallback(descripcionUsuario, indice);
  }
};

const generarFallback = (descripcionUsuario, indice) => {
  const tema = descripcionUsuario.toLowerCase();

  const plantillas = [
    {
      titulo: `Aprendiendo sobre: ${descripcionUsuario}`,
      descripcion: `En esta actividad aprenderemos sobre "${descripcionUsuario}" a través de la Biblia y la oración. Los niños deberán buscar un versículo relacionado con el tema y reflexionar sobre cómo aplicar estas enseñanzas en su vida diaria.\n\nActividad: Dibuja o escribe lo que aprendiste hoy sobre "${descripcionUsuario}" y compártelo con tu familia esta semana.`,
    },
    {
      titulo: `Lección bíblica: ${descripcionUsuario}`,
      descripcion: `Dios nos enseña sobre "${descripcionUsuario}" a través de Su Palabra. En esta tarea, los niños leerán un pasaje bíblico relacionado con el tema y responderán preguntas sencillas para reflexionar sobre su significado en nuestra vida cristiana.\n\nRecuerda: "La Palabra de Dios es lámpara a mis pies y lumbrera a mi camino" (Salmo 119:105). Practica lo aprendido en casa.`,
    },
    {
      titulo: `Desafío cristiano: ${descripcionUsuario}`,
      descripcion: `Esta semana nuestro desafío especial es aprender más sobre "${descripcionUsuario}". Los niños deberán practicar en casa lo que aprendieron en clase y contarle a alguien de su familia cuál fue la parte más importante de la lección de hoy.\n\nNo olvides orar cada día pidiendo a Dios que te ayude a vivir según Sus enseñanzas y a ser un ejemplo para los demás.`,
    },
    {
      titulo: `Tarea especial: ${descripcionUsuario}`,
      descripcion: `¡Esta semana tenemos una tarea especial sobre "${descripcionUsuario}"! Dios quiere que aprendamos más sobre este tema tan importante. Lee junto a tus padres o hermanos un pasaje de la Biblia relacionado y conversen sobre lo que significa para su familia.\n\nEscribe en tu cuaderno tres cosas que aprendiste y tráelas la próxima clase para compartir con tus compañeros.`,
    },
  ];

  return { ...plantillas[indice % plantillas.length], indice };
};

module.exports = { generarTareaIA };
