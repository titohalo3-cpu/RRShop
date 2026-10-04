/* ===========================================================
   PROXY DE RAWG
   Funcion serverless de Vercel.

   Ademas de resolver el CORS, esto esconde la clave: vive en
   una variable de entorno del servidor y nunca llega al
   navegador. Antes estaba escrita en js/api.js, donde
   cualquiera podia leerla abriendo el archivo.

   La clave se configura en Vercel:
     Project Settings > Environment Variables > RAWG_KEY

   Ruta:
     /api/rawg?search=doom&page_size=1
     /api/rawg?genres=shooter&ordering=-added&page_size=14
   =========================================================== */

const BASE = "https://api.rawg.io/api/games";

module.exports = async function handler(peticion, respuesta) {
  const clave = process.env.RAWG_KEY;

  if (!clave) {
    respuesta.status(500).json({ error: "Falta la variable de entorno RAWG_KEY" });
    return;
  }

  const url = new URL(BASE);
  url.searchParams.set("key", clave);

  for (const [k, v] of Object.entries(peticion.query)) {
    url.searchParams.set(k, v);
  }

  try {
    const salida = await fetch(url);

    if (!salida.ok) {
      respuesta.status(salida.status).json({ error: "RAWG respondio " + salida.status });
      return;
    }

    const datos = await salida.json();

    // Los generos de un juego no cambian: cache de una hora
    respuesta.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    respuesta.status(200).json(datos);

  } catch (error) {
    respuesta.status(502).json({ error: "No se pudo contactar con RAWG" });
  }
};