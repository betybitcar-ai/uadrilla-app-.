const fetch = require('node-fetch');

async function generarImagenCuadrilla(promptTexto) {
  const modelURL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1";
  
  const response = await fetch(modelURL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: promptTexto })
  });

  if (!response.ok) {
    throw new Error("No se pudo generar la imagen con el servicio gratuito de Hugging Face.");
  }

  const buffer = await response.arrayBuffer();
  const base64Image = Buffer.from(buffer).toString('base64');
  
  return `data:image/jpeg;base64,${base64Image}`;
}

module.exports = { generarImagenCuadrilla };