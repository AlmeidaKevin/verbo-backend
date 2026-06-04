const supabase = require('../config/supabase');

const subirArchivo = async (bucket, fileName, buffer, mimeType) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return urlData.publicUrl;
};

const eliminarArchivo = async (bucket, fileName) => {
  const { error } = await supabase.storage.from(bucket).remove([fileName]);
  if (error) console.error('Error eliminando archivo:', error.message);
};

module.exports = { subirArchivo, eliminarArchivo };
