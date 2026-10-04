/* ===========================================================
   PROXY DE FRANKFURTER
   Tipo de cambio de dolares a euros, del Banco Central Europeo.

   Ruta:
     /api/cambio
   =========================================================== */

module.exports = async function handler(peticion, respuesta) {
  try {
    const salida = await fetch("https://api.frankfurter.app/latest?base=USD&symbols=EUR");

    if (!salida.ok) {
      respuesta.status(salida.status).json({ error: "Frankfurter respondio " + salida.status });
      return;
    }

    const datos = await salida.json();

    // El BCE publica los tipos una vez al dia laborable,
    // sobre las 16:00 CET. Cache de seis horas.
    respuesta.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    respuesta.status(200).json(datos);

  } catch (error) {
    respuesta.status(502).json({ error: "No se pudo contactar con Frankfurter" });
  }
};