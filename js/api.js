/* ===========================================================
   CAPA DE DATOS (cliente)

   Funciona de dos maneras segun donde corra:

     MODO PROXY (en Vercel)
       Llama a /api/..., funciones serverless de nuestro propio
       dominio. No hay CORS, porque es el mismo origen, y la
       clave de RAWG vive en el servidor.

     MODO DIRECTO (en local, con php -S o Live Server)
       Esos servidores no ejecutan JavaScript de servidor, asi
       que /api/ devuelve 404. Entonces se llama a las APIs
       externas directamente. CheapShark y Frankfurter lo
       permiten; RAWG necesita que pongas la clave abajo.

   La eleccion se hace sola al arrancar, probando /api/cambio.

   Limitacion conocida: CheapShark solo vende claves de PC, y
   ninguna API gratuita da precios de las tiendas de Nintendo,
   PlayStation o Xbox. Por eso la tienda es solo de PC.
   =========================================================== */


/* ===========================================================
   CONFIGURACION
   =========================================================== */

const PROXY = "/api";

// Directo, solo para el modo local
const CHEAPSHARK  = "https://www.cheapshark.com/api/1.0";
const FRANKFURTER = "https://api.frankfurter.app";
const RAWG        = "https://api.rawg.io/api";

/* Clave de RAWG SOLO para desarrollo en local.
   En produccion la pone el servidor, en la variable de entorno
   RAWG_KEY, y esta constante se queda vacia.

   NO subas este archivo con la clave puesta si el repositorio
   es publico: cualquiera podria leerla. */
const RAWG_KEY_LOCAL = "";

const TOPE = 8000;             // ms maximos esperando una respuesta
const CAMBIO_RESERVA = 0.92;   // si no hay tipo de cambio

let modoProxy      = true;     // se decide al arrancar
let rawgDisponible = true;

function hayRawg() {
  return rawgDisponible;
}

function enProxy() {
  return modoProxy;
}


/* ===========================================================
   PETICIONES
   =========================================================== */

/* AbortController permite cancelar un fetch. Sin esto, si el
   servidor no contesta, el await se queda esperando para
   siempre y la pagina no pasa de los esqueletos. */
async function pedir(url) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TOPE);

  try {
    const respuesta = await fetch(url, { signal: control.signal });

    if (respuesta.status === 404) throw new Error("SIN_API");
    if (!respuesta.ok) throw new Error("Respondio " + respuesta.status);

    return await respuesta.json();

  } catch (error) {
    if (error.name === "AbortError") throw new Error("Sin respuesta a tiempo");
    throw error;
  } finally {
    clearTimeout(reloj);
  }
}

function montarUrl(base, parametros) {
  const url = new URL(base, window.location.origin);

  for (const [k, v] of Object.entries(parametros)) {
    url.searchParams.set(k, v);
  }
  return url;
}

/* Decide el modo. Prueba el proxy una vez; si no esta, pasa a
   llamar directamente a las APIs externas. */
async function elegirModo() {
  try {
    await pedir(montarUrl(PROXY + "/cambio", {}));
    modoProxy = true;
  } catch (error) {
    modoProxy = false;
    console.info("Sin funciones de servidor: modo directo.");
  }
  return modoProxy;
}


/* ===========================================================
   TIPO DE CAMBIO
   CheapShark devuelve solo dolares: no tiene parametro de
   moneda ni de pais. Por eso convertimos nosotros.
   =========================================================== */

let cambioUsdEur = CAMBIO_RESERVA;

async function cargarCambio() {
  try {
    const datos = modoProxy
      ? await pedir(montarUrl(PROXY + "/cambio", {}))
      : await pedir(`${FRANKFURTER}/latest?base=USD&symbols=EUR`);

    cambioUsdEur = datos.rates.EUR;
  } catch (error) {
    console.warn("Sin tipo de cambio actualizado, uso el fijo.", error);
  }
}

function aEuros(dolares) {
  return Math.round(Number(dolares) * cambioUsdEur * 100) / 100;
}


/* ===========================================================
   TITULOS
   CheapShark devuelve el mismo juego con sufijos distintos:
   "DOOM", "DOOM Game of the Year Edition", "DOOM (1993)".
   Comparando el titulo tal cual los tres parecen juegos
   distintos y acaban saliendo juntos en el escaparate.
   =========================================================== */

const SUFIJOS = /\b(game of the year|goty|definitive|complete|deluxe|ultimate|enhanced|remastered|directors cut|gold|premium|standard|anniversary)\b.*$/i;

function clave(titulo) {
  return String(titulo)
    .toLowerCase()
    .replace(/\(\d{4}\)/g, "")       // el ano entre parentesis
    .replace(/'/g, "")
    .replace(SUFIJOS, "")            // los sufijos de edicion
    .replace(/\bedition\b/g, "")
    .replace(/[^a-z0-9]/g, "")       // puntuacion y espacios
    .trim();
}

function quitarRepetidos(lista) {
  const vistos = new Map();

  lista.forEach(juego => {
    const k = clave(juego.titulo);
    if (!k) return;

    const previo = vistos.get(k);
    // Nos quedamos con el mas barato de cada juego
    if (!previo || juego.precio < previo.precio) vistos.set(k, juego);
  });

  return [...vistos.values()];
}

/* Un juego sin precio no se puede comprar, asi que no se ensena.
   Tambien fuera los de precio cero, que suelen ser entradas
   raras del catalogo y no una oferta de verdad. */
function soloConPrecio(lista) {
  return lista.filter(j => typeof j.precio === "number" && j.precio > 0);
}


/* ===========================================================
   PUNTUACION
   Mezcla calidad y popularidad. La usa el sorteo ponderado
   para que salgan antes los juegos que la gente conoce.
   =========================================================== */

function puntuar(juego) {
  let suma = 0;
  let pesos = 0;

  if (juego.valoracion) { suma += juego.valoracion; pesos++; }
  if (juego.metacritic) { suma += juego.metacritic; pesos++; }

  const calidad = pesos > 0 ? suma / pesos : 55;

  // El numero de resenas separa lo conocido de lo que no lo es.
  // Pesa fuerte a proposito: sin esto salen juegos que nadie ha
  // oido nombrar, solo porque estan muy rebajados.
  const popularidad = juego.resenas
    ? Math.min(Math.log10(juego.resenas) * 18, 90)
    : 0;

  return calidad + popularidad;
}


/* ===========================================================
   CHEAPSHARK
   =========================================================== */

function normalizar(oferta) {
  const juego = {
    id:            oferta.dealID,
    titulo:        oferta.title,
    portada:       oferta.thumb,
    portadaGrande: null,
    steamAppID:    oferta.steamAppID || null,
    generos:       [],
    precio:        aEuros(oferta.salePrice),
    original:      aEuros(oferta.normalPrice),
    oferta:        Math.round(Number(oferta.savings)),
    metacritic:    Number(oferta.metacriticScore) || null,
    valoracion:    Number(oferta.steamRatingPercent) || null,
    resenas:       Number(oferta.steamRatingCount) || null,
    enlace:        "https://www.cheapshark.com/redirect?dealID=" + oferta.dealID
  };

  juego.puntos = puntuar(juego);
  return juego;
}

// La misma peticion, por el proxy o directa segun el modo
function urlCheapshark(ruta, parametros) {
  return modoProxy
    ? montarUrl(PROXY + "/cheapshark", { ruta: ruta, ...parametros })
    : montarUrl(`${CHEAPSHARK}/${ruta}`, parametros);
}

async function pedirOfertas(parametros = {}) {
  const datos = await pedir(urlCheapshark("deals", parametros));
  return soloConPrecio(quitarRepetidos(datos.map(normalizar)));
}


/* ---------- Funciones publicas ---------- */

/* Pedimos dos listas y las juntamos: una ordenada por numero de
   resenas, que trae los juegos conocidos, y otra por nota de
   chollo, que trae las rebajas buenas. Solo con la segunda
   salian juegos muy desconocidos. */
async function traerJuegos(filtros = {}) {
  const base = { pageSize: 60, onSale: 1, ...filtros };

  const [populares, chollos] = await Promise.all([
    pedirOfertas({ ...base, sortBy: "Reviews" }),
    pedirOfertas({ ...base, sortBy: "Deal Rating" })
  ]);

  return quitarRepetidos([...populares, ...chollos]);
}

async function buscarJuegos(texto, cuantos = 8) {
  return pedirOfertas({ title: texto, pageSize: cuantos });
}

async function sugerirJuegos(texto, limite = 8) {
  const datos = await pedir(urlCheapshark("games", { title: texto, limit: limite }));

  return quitarRepetidos(datos.map(j => ({
    titulo:  j.external,          // en /games el titulo se llama external
    portada: j.thumb,
    precio:  j.cheapest ? aEuros(j.cheapest) : 0
  })));
}


/* ===========================================================
   RAWG
   En modo proxy la clave la pone el servidor.
   En modo directo hace falta RAWG_KEY_LOCAL.
   =========================================================== */

const cacheRawg = new Map();

function urlRawg(parametros) {
  if (modoProxy) return montarUrl(PROXY + "/rawg", parametros);
  return montarUrl(`${RAWG}/games`, { key: RAWG_KEY_LOCAL, ...parametros });
}

async function pedirRawg(parametros = {}) {
  if (!modoProxy && !RAWG_KEY_LOCAL) {
    throw new Error("Sin clave de RAWG en local");
  }

  const datos = await pedir(urlRawg(parametros));

  if (datos && datos.error) throw new Error(datos.error);
  return datos;
}

async function enriquecer(juego) {
  if (!hayRawg()) return juego;
  if (juego.generos.length > 0) return juego;

  const k = clave(juego.titulo);
  if (cacheRawg.has(k)) return { ...juego, ...cacheRawg.get(k) };

  try {
    const datos = await pedirRawg({ search: juego.titulo, page_size: 1 });
    const hallado = datos.results[0];
    if (!hallado) return juego;

    const extra = {
      generos: (hallado.genres || []).map(g => g.name),
      portadaGrande: hallado.background_image
    };

    cacheRawg.set(k, extra);
    return { ...juego, ...extra };

  } catch (error) {
    console.warn("RAWG no disponible para " + juego.titulo, error);
    return juego;
  }
}

async function enriquecerLista(lista) {
  return Promise.all(lista.map(enriquecer));
}

/* Juegos de un genero o etiqueta.
   RAWG sabe de generos pero no de precios; CheapShark al reves.
   Pedimos los titulos a RAWG y luego su precio a CheapShark. */
async function traerPorEtiqueta(parametroRawg, cuantos = 12) {
  const datos = await pedirRawg({
    ...parametroRawg,
    ordering: "-added",
    page_size: cuantos
  });

  const busquedas = datos.results.map(j => buscarJuegos(j.name, 1).catch(() => []));
  return quitarRepetidos((await Promise.all(busquedas)).flat());
}

/* Comprueba una vez si RAWG se puede usar en este entorno.
   Si no, los vales y sobres de genero ni se ofrecen. */
async function comprobarRawg() {
  try {
    await pedirRawg({ page_size: 1 });
    rawgDisponible = true;
  } catch (error) {
    rawgDisponible = false;
    console.info("RAWG no disponible: sin categorias ni vales de genero.");
  }
  return rawgDisponible;
}


/* ===========================================================
   CATALOGO DE RESERVA
   Si nada responde, la tienda sigue funcionando.
   =========================================================== */

const RESERVA = [
  { titulo: "Alan Wake",             precio: 4.99,  original: 14.99, oferta: 67, metacritic: 83, resenas: 24000 },
  { titulo: "Atomic Heart",          precio: 9.99,  original: 59.99, oferta: 83, metacritic: 75, resenas: 61000 },
  { titulo: "Balatro",               precio: 11.24, original: 14.99, oferta: 25, metacritic: 90, resenas: 48000 },
  { titulo: "Cyberpunk 2077",        precio: 29.99, original: 59.99, oferta: 50, metacritic: 86, resenas: 680000 },
  { titulo: "Dead by Daylight",      precio: 5.99,  original: 19.99, oferta: 70, metacritic: 71, resenas: 590000 },
  { titulo: "Dead Space 2",          precio: 4.99,  original: 19.99, oferta: 75, metacritic: 90, resenas: 19000 },
  { titulo: "Devil May Cry 5",       precio: 8.99,  original: 29.99, oferta: 70, metacritic: 88, resenas: 97000 },
  { titulo: "DOOM",                  precio: 3.99,  original: 19.99, oferta: 80, metacritic: 85, resenas: 160000 },
  { titulo: "God of War",            precio: 24.99, original: 49.99, oferta: 50, metacritic: 93, resenas: 180000 },
  { titulo: "Little Nightmares",     precio: 3.99,  original: 19.99, oferta: 80, metacritic: 79, resenas: 52000 },
  { titulo: "Days Gone",             precio: 12.49, original: 49.99, oferta: 75, metacritic: 71, resenas: 61000 },
  { titulo: "Detroit: Become Human", precio: 14.99, original: 39.99, oferta: 62, metacritic: 78, resenas: 95000 },
  { titulo: "Hollow Knight",         precio: 7.49,  original: 14.99, oferta: 50, metacritic: 90, resenas: 270000 },
  { titulo: "Hades",                 precio: 12.49, original: 24.99, oferta: 50, metacritic: 93, resenas: 230000 },
  { titulo: "Slay the Spire",        precio: 6.24,  original: 24.99, oferta: 75, metacritic: 89, resenas: 110000 }
].map((j, i) => {
  const juego = {
    ...j,
    id: "reserva-" + i,
    steamAppID: null,
    portada: null,
    portadaGrande: null,
    generos: [],
    valoracion: null,
    enlace: null
  };
  juego.puntos = puntuar(juego);
  return juego;
});