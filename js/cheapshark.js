/* ===========================================================
   PROXY DE CHEAPSHARK
   Funcion serverless de Vercel.

   El navegador llama a /api/cheapshark, que esta en nuestro
   mismo dominio, asi que no hay CORS. Esta funcion, que corre
   en el servidor, llama a CheapShark y devuelve la respuesta.

   Desde servidor a servidor no existe la politica del mismo
   origen: CORS es una norma que aplica el navegador, no la API.

   Rutas:
     /api/cheapshark?ruta=deals&pageSize=60&sortBy=Reviews
     /api/cheapshark?ruta=games&title=doom&limit=8
   =========================================================== */

const BASE = "https://www.cheapshark.com/api/1.0";

// Solo dejamos pasar las rutas que usamos, para que nadie pueda
// convertir nuestro proxy en un reenviador de cualquier cosa.
const RUTAS = ["deals", "games"];

module.exports = async function handler(peticion, respuesta) {
  const { ruta, ...parametros } = peticion.query;

  if (!RUTAS.includes(ruta)) {
    respuesta.status(400).json({ error: "Ruta no permitida" });
    return;
  }

  const url = new URL(`${BASE}/${ruta}`);
  for (const [clave, valor] of Object.entries(parametros)) {
    url.searchParams.set(clave, valor);
  }

  try {
    const salida = await fetch(url);

    if (!salida.ok) {
      respuesta.status(salida.status).json({ error: "CheapShark respondio " + salida.status });
      return;
    }

    const datos = await salida.json();

    // Cache en el borde de Vercel: 5 minutos.
    // Los precios no cambian cada segundo y asi evitamos
    // machacar la API en cada recarga.
    respuesta.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    respuesta.status(200).json(datos);

  } catch (error) {
    respuesta.status(502).json({ error: "No se pudo contactar con CheapShark" });
  }
};