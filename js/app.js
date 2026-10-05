/* ===========================================================
   BALATROSHOP - interfaz
   Usa las funciones de api.js. Aqui no hay ninguna URL.
   =========================================================== */

document.addEventListener("DOMContentLoaded", function () {


  /* ---------- Constantes ---------- */

  const CUANTOS    = 5;     // juegos visibles en el escaparate
  const MAX_SLOTS  = 10;    // huecos de la biblioteca
  const MAX_VALES  = 2;     // vales activos a la vez
  const ESPERA     = 300;   // ms antes de pedir sugerencias
  const MEMORIA    = 15;    // titulos recientes que no se repiten
  const TOPE_IMG   = 5000;  // ms maximos esperando una imagen


  /* ---------- Vales ----------
     Dos tipos:
       genero -> pide los titulos a RAWG (necesita clave)
       filtro -> parametros de CheapShark, mas un predicado para
                 poder aplicarlos tambien sobre una lista de RAWG
     Solo se pueden tener MAX_VALES activos a la vez. */

  const VALES = [
    { id: "shooter",   nombre: "Vale shooter",   icono: "\u2316", descripcion: "La tienda se llena de shooters.",                    tipo: "genero", rawg: { genres: "shooter" } },
    { id: "carreras",  nombre: "Vale carreras",  icono: "\u26A1", descripcion: "La tienda se llena de juegos de coches y carreras.", tipo: "genero", rawg: { genres: "racing" } },
    { id: "roguelite", nombre: "Vale roguelite", icono: "\u2620", descripcion: "La tienda se llena de roguelites y roguelikes.",     tipo: "genero", rawg: { tags: "roguelike" } },
    { id: "terror",    nombre: "Vale terror",    icono: "\u2665", descripcion: "La tienda se llena de juegos de terror.",            tipo: "genero", rawg: { tags: "horror" } },
    { id: "rol",       nombre: "Vale rolero",    icono: "\u2694", descripcion: "La tienda se llena de juegos de rol.",               tipo: "genero", rawg: { genres: "role-playing-games-rpg" } },
    { id: "indie",     nombre: "Vale indie",     icono: "\u273F", descripcion: "La tienda se llena de juegos independientes.",       tipo: "genero", rawg: { genres: "indie" } },
    { id: "estrategia",nombre: "Vale estratega", icono: "\u265C", descripcion: "La tienda se llena de juegos de estrategia.",        tipo: "genero", rawg: { genres: "strategy" } },
    { id: "aventura",  nombre: "Vale aventura",  icono: "\u2691", descripcion: "La tienda se llena de aventuras.",                   tipo: "genero", rawg: { genres: "adventure" } },

    { id: "chollero",  nombre: "Vale chollero",  icono: "\u20AC", descripcion: "Solo juegos por debajo de 10 euros.",                tipo: "filtro", filtros: { upperPrice: 10 }, local: j => j.precio !== null && j.precio <= 10 },
    { id: "aclamado",  nombre: "Vale aclamado",  icono: "\u2605", descripcion: "Solo juegos con Metacritic de 80 o mas.",            tipo: "filtro", filtros: { metacritic: 80 },  local: j => (j.metacritic || 0) >= 80 },
    { id: "exitazo",   nombre: "Vale exitazo",   icono: "\u263A", descripcion: "Solo juegos con un 90 por ciento de resenas positivas.", tipo: "filtro", filtros: { steamRating: 90 }, local: j => (j.valoracion || 0) >= 90 },
    { id: "rebajon",   nombre: "Vale rebajon",   icono: "\u2193", descripcion: "Solo juegos rebajados un 60 por ciento o mas.",      tipo: "filtro", filtros: {}, local: j => (j.oferta || 0) >= 60 }
  ];


  /* ---------- Sobres ----------
     cuantas: cartas que reparte, exacto.
     sesgo:   funcion opcional que da mas papeletas a ciertos
              juegos dentro del sobre. */

  const SOBRES = [
    { id: "chollo",  nombre: "Sobre chollo",  icono: "\u20AC", cuantas: 4, clase: "envoltorio--rojo",
      descripcion: "Cuatro juegos bien valorados por menos de 5 euros.",
      filtros: { upperPrice: 5, metacritic: 75 } },

    { id: "grande",  nombre: "Sobre grande",  icono: "\u25A0", cuantas: 8, clase: "envoltorio--azul",
      descripcion: "Ocho juegos de toda la tienda, sin filtro. Mas donde elegir.",
      filtros: {} },

    { id: "oferton", nombre: "Sobre oferton", icono: "\u2193", cuantas: 5, clase: "envoltorio--oro",
      descripcion: "Cinco juegos, con mucha mas probabilidad de que salgan los mas rebajados.",
      filtros: {}, sesgo: j => 1 + (j.oferta || 0) / 12 },

    { id: "sangre",  nombre: "Sobre shooter", icono: "\u2316", cuantas: 4, clase: "envoltorio--verde",
      descripcion: "Cuatro shooters.", genero: { genres: "shooter" } },

    { id: "sustos",  nombre: "Sobre terror",  icono: "\u2665", cuantas: 4, clase: "envoltorio--morado",
      descripcion: "Cuatro juegos de terror.", genero: { tags: "horror" } },

    { id: "ruedas",  nombre: "Sobre carreras", icono: "\u26A1", cuantas: 4, clase: "envoltorio--azul",
      descripcion: "Cuatro juegos de coches y carreras.", genero: { genres: "racing" } },

    { id: "mazmorra", nombre: "Sobre roguelite", icono: "\u2620", cuantas: 4, clase: "envoltorio--rojo",
      descripcion: "Cuatro roguelites y roguelikes.", genero: { tags: "roguelike" } },

    { id: "rol",     nombre: "Sobre rolero",  icono: "\u2694", cuantas: 5, clase: "envoltorio--morado",
      descripcion: "Cinco juegos de rol.", genero: { genres: "role-playing-games-rpg" } }
  ];

  const SOBRES_A_LA_VEZ = 2;

  /* Con el proxy, saber si RAWG esta configurado requiere
     preguntar al servidor. Por eso estas listas se rellenan en
     el arranque, no aqui. */
  let VALES_USABLES  = VALES;
  let SOBRES_USABLES = SOBRES;


  /* ---------- Estado ---------- */

  let biblioteca    = [];
  let catalogo      = [];
  let recientes     = [];
  let valesActivos  = [];   // maximo MAX_VALES
  let valeOfrecido  = null; // el que se ve en la ranura del panel
  let sobresVisibles = [];
  let poolBusqueda  = [];   // resultados de la busqueda en curso
  let temporizador  = null;


  /* ---------- Referencias al DOM ---------- */

  const zonaJuegos     = document.getElementById("juegos");
  const zonaSobres     = document.getElementById("sobres");
  const zonaVale       = document.getElementById("vales");
  const zonaActivos    = document.getElementById("vales-activos");
  const filaSlots      = document.getElementById("fila-slots");
  const contador       = document.getElementById("contador-slots");
  const contadorVales  = document.getElementById("contador-vales");
  const bloqueBiblio   = document.getElementById("biblioteca");
  const bloqueActivos  = document.getElementById("bloque-vales-activos");

  const carritoTotal   = document.getElementById("carrito-total");
  const carritoCuantos = document.getElementById("carrito-cuantos");

  const modal       = document.getElementById("modal");
  const modalTitulo = document.getElementById("modal-titulo");
  const modalTexto  = document.getElementById("modal-texto");
  const modalCartas = document.getElementById("modal-cartas");
  const btnSaltar   = document.getElementById("btn-saltar");


  const btnComprar    = document.getElementById("btn-comprar");
  const modalCompra   = document.getElementById("modal-compra");
  const listaCompra   = document.getElementById("lista-compra");
  const totalCompra   = document.getElementById("total-compra");
  const btnCerrarComp = document.getElementById("btn-cerrar-compra");
  const btnVaciar     = document.getElementById("btn-vaciar");

  const btnCambiar  = document.getElementById("btn-cambiar");
  const campoBuscar = document.getElementById("campo-buscar");
  const btnBuscar   = document.getElementById("btn-buscar");
  const listaSug    = document.getElementById("sugerencias");

  const barraError  = document.getElementById("barra-error");


  /* ---------- Guardado local ----------
     localStorage guarda texto en el navegador y sobrevive al
     cierre de la pestana. Va dentro de try/catch porque en modo
     incognito, o con el almacenamiento bloqueado, lanza error. */

  const GUARDADO = "balatroshop:biblioteca";

  function guardar() {
    try {
      localStorage.setItem(GUARDADO, JSON.stringify(biblioteca));
    } catch (error) {
      console.warn("No se pudo guardar la biblioteca", error);
    }
  }

  function recuperar() {
    try {
      const texto = localStorage.getItem(GUARDADO);
      if (!texto) return [];
      const datos = JSON.parse(texto);
      return Array.isArray(datos) ? datos : [];
    } catch (error) {
      console.warn("No se pudo recuperar la biblioteca", error);
      return [];
    }
  }


  /* ---------- Utilidades ---------- */

  function formatearPrecio(n) {
    if (n === null || n === undefined) return "Sin precio";
    return n.toFixed(2).replace(".", ",") + " \u20AC";
  }

  function limpiar(texto) {
    return String(texto).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function mensaje(contenedor, texto) {
    contenedor.innerHTML = `<p class="mensaje">${texto}</p>`;
  }

  function mostrarError(texto) {
    barraError.textContent = texto;
    barraError.classList.add("barra-error--visible");
  }

  function ocultarError() {
    barraError.classList.remove("barra-error--visible");
  }

  function sacudir(elemento) {
    elemento.classList.remove("sacudir");
    void elemento.offsetWidth;        // reinicia la animacion
    elemento.classList.add("sacudir");
  }

  function sortear(lista, n) {
    const copia = [...lista];
    const elegidos = [];
    const total = Math.min(n, copia.length);

    for (let i = 0; i < total; i++) {
      const indice = Math.floor(Math.random() * copia.length);
      elegidos.push(copia.splice(indice, 1)[0]);
    }
    return elegidos;
  }

  /* Sorteo ponderado: sigue siendo aleatorio, pero los juegos
     mejor valorados y mas populares tienen mas papeletas.
     Se ordenan por puntuacion y cada uno recibe 1/(posicion+3).
     El parametro sesgo permite que un sobre favorezca ademas
     otra cosa, por ejemplo el porcentaje de descuento. */
  function sortearPonderado(lista, n, sesgo) {
    const ordenada = [...lista].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
    const elegidos = [];
    const total = Math.min(n, ordenada.length);

    for (let i = 0; i < total; i++) {
      const papeletas = ordenada.map((juego, pos) => {
        const base = 1 / (pos + 3);
        return sesgo ? base * sesgo(juego) : base;
      });

      const suma = papeletas.reduce((a, b) => a + b, 0);
      let tirada = Math.random() * suma;
      let elegido = 0;

      for (let j = 0; j < papeletas.length; j++) {
        tirada -= papeletas[j];
        if (tirada <= 0) { elegido = j; break; }
      }

      elegidos.push(ordenada.splice(elegido, 1)[0]);
    }
    return elegidos;
  }


  /* ===========================================================
     PORTADAS
     Steam publica una portada vertical de 600x900 (relacion 2:3),
     que es exactamente la forma de la carta. CheapShark nos da el
     steamAppID, asi que construimos la URL sin pedir nada.
     =========================================================== */

  function portadasDe(juego) {
    const lista = [];

    if (juego.steamAppID) {
      const base = "https://cdn.cloudflare.steamstatic.com/steam/apps/" + juego.steamAppID;
      lista.push(base + "/library_600x900_2x.jpg");
      lista.push(base + "/library_600x900.jpg");
      lista.push(base + "/header.jpg");
    }

    if (juego.portadaGrande) lista.push(juego.portadaGrande);
    if (juego.portada)       lista.push(juego.portada);

    return lista;
  }

  /* El tope de tiempo evita que un servidor lento deje la tienda
     esperando para siempre en un movil viejo. */
  function cargarImagen(url) {
    return new Promise(resolve => {
      const img = new Image();
      let resuelto = false;

      const acabar = valor => {
        if (resuelto) return;
        resuelto = true;
        resolve(valor);
      };

      const reloj = setTimeout(() => acabar(null), TOPE_IMG);

      img.onload = () => {
        clearTimeout(reloj);
        acabar({ url: url, vertical: img.naturalHeight > img.naturalWidth });
      };
      img.onerror = () => { clearTimeout(reloj); acabar(null); };

      img.src = url;
    });
  }

  async function resolverPortada(juego) {
    if (juego.imagen) return juego;          // ya resuelta antes

    for (const url of portadasDe(juego)) {
      const resultado = await cargarImagen(url);
      if (resultado) return { ...juego, imagen: resultado.url, vertical: resultado.vertical };
    }
    return { ...juego, imagen: null, vertical: false };
  }

  /* Resuelve las portadas de toda la lista a la vez, para que las
     cartas aparezcan juntas y ya con imagen. */
  async function conPortadas(lista) {
    return Promise.all(lista.map(resolverPortada));
  }


  /* ---------- Esqueletos ----------
     Siluetas del tamano exacto de las cartas mientras se preparan
     datos e imagenes. Ocupan el mismo espacio, asi que la pagina
     no da saltos al revelar las cartas. */

  function pintarEsqueletos(cuantos, contenedor) {
    contenedor.innerHTML = "";

    for (let i = 0; i < cuantos; i++) {
      const hueso = document.createElement("div");
      hueso.className = "esqueleto";
      hueso.style.animationDelay = `${i * 0.1}s`;
      hueso.innerHTML = `
        <div class="esqueleto-precio"></div>
        <div class="esqueleto-portada"></div>
      `;
      contenedor.appendChild(hueso);
    }
  }


  /* ---------- Categoria ----------
     Se ensena una sola, la primera que devuelve RAWG.
     Lo de DLC es una heuristica sobre el titulo: ni CheapShark ni
     RAWG marcan los contenidos descargables en la busqueda. */

  const PALABRAS_DLC = /\b(dlc|expansion|season pass|soundtrack|add[- ]?on|content pack|character pack|map pack)\b/i;

  function categoriaDe(juego) {
    if (juego.generos.length > 0) return juego.generos[0];
    if (PALABRAS_DLC.test(juego.titulo)) return "DLC";
    return null;
  }


  /* ---------- Tooltip, compartido por cartas y slots ---------- */

  function crearTooltip(juego, abajo = false) {
    const info = document.createElement("div");
    info.className = abajo ? "info info--abajo" : "info";

    const antes = juego.oferta > 0 && juego.original
      ? `<span class="antes">${formatearPrecio(juego.original)}</span>`
      : "";

    const categoria = categoriaDe(juego);

    const lista = categoria
      ? `<ul class="info-categorias"><li>${limpiar(categoria)}</li></ul>`
      : "";

    info.innerHTML = `
      <strong class="info-titulo">${limpiar(juego.titulo)}</strong>
      <p class="info-precio">${formatearPrecio(juego.precio)} ${antes}</p>
      ${lista}
    `;
    return info;
  }


  /* ---------- Cartas ---------- */

  function crearCarta(juego) {
    const carta = document.createElement("article");
    carta.className = "carta repartir";
    carta.tabIndex = 0;

    const sello = juego.oferta > 0 ? `<span class="sello">-${juego.oferta} %</span>` : "";

    const imagen = juego.imagen
      ? `<img class="portada-fondo"  src="${juego.imagen}" alt="" aria-hidden="true">
         <img class="portada-frente" src="${juego.imagen}" alt="">`
      : "";

    carta.innerHTML = `
      <span class="etiqueta-precio">${formatearPrecio(juego.precio)}</span>
      <div class="portada${juego.vertical ? " portada--vertical" : ""}">
        <span class="portada-texto">${limpiar(juego.titulo)}</span>
        ${imagen}
      </div>
      ${sello}
    `;

    carta.appendChild(crearTooltip(juego));
    carta.addEventListener("click", () => elegir(juego));
    return carta;
  }

  function pintarCartas(lista, contenedor) {
    contenedor.innerHTML = "";

    if (lista.length === 0) {
      mensaje(contenedor, "Nada que mostrar.");
      return;
    }

    lista.forEach((juego, i) => {
      const carta = crearCarta(juego);
      carta.style.animationDelay = `${i * 0.07}s`;
      contenedor.appendChild(carta);
    });
  }

  /* Pinta esqueletos, prepara datos e imagenes, y solo entonces
     revela las cartas. Nunca se ve una carta a medio cargar. */
  async function mostrarJuegos(lista, contenedor, cuantosEsqueletos) {
    pintarEsqueletos(cuantosEsqueletos || lista.length, contenedor);

    const conDatos  = await enriquecerLista(lista);
    const completos = await conPortadas(conDatos);

    pintarCartas(completos, contenedor);
    return completos;
  }


  /* ===========================================================
     CATALOGO
     Lo que ofrece la tienda depende de los vales activos.

     Si hay algun vale de genero, los titulos los pone RAWG y los
     vales de filtro se aplican despues sobre esa lista, en local.
     Si no hay ninguno de genero, los filtros van directos a
     CheapShark, que es mas rapido y trae mas juegos.
     =========================================================== */

  function filtrosLocales(lista) {
    return valesActivos
      .filter(v => v.tipo === "filtro")
      .reduce((actual, vale) => actual.filter(vale.local), lista);
  }

  async function construirCatalogo() {
    const generos = valesActivos.filter(v => v.tipo === "genero");

    if (generos.length > 0) {
      const listas = await Promise.all(generos.map(v => traerPorEtiqueta(v.rawg, 14)));
      return filtrosLocales(quitarRepetidos(listas.flat()));
    }

    // Solo filtros: van directos a CheapShark
    const parametros = {};
    valesActivos.forEach(v => Object.assign(parametros, v.filtros || {}));

    return filtrosLocales(await traerJuegos(parametros));
  }

  async function recargarTienda() {
    pintarEsqueletos(CUANTOS, zonaJuegos);

    try {
      await cargarCambio();
      catalogo = await construirCatalogo();
      ocultarError();
    } catch (error) {
      catalogo = RESERVA;

      mostrarError(
        "No se pudo conectar (" + error.message + "). " +
        (enProxy()
          ? "Revisa que la carpeta api/ este desplegada."
          : "Comprueba tu conexion y desactiva el bloqueador de anuncios, " +
            "que suele bloquear cheapshark.com.") +
        " Mientras tanto se usan datos de reserva."
      );
      console.error(error);
    }

    if (catalogo.length === 0) {
      mensaje(zonaJuegos, "Esa combinacion de vales no deja ningun juego. Quita uno.");
      return;
    }

    recientes = [];
    await repartirJuegos();
  }


  /* ---------- Escaparate ---------- */

  function recordar(lista) {
    lista.forEach(j => recientes.unshift(clave(j.titulo)));
    recientes = recientes.slice(0, MEMORIA);
  }

  /* De donde salen los juegos del reroll.
     Si el buscador tiene texto y hay resultados, el reroll se
     hace sobre esos resultados, no sobre toda la tienda. */
  function fuenteActual() {
    const buscando = campoBuscar.value.trim() !== "" && poolBusqueda.length > 0;
    const base = buscando ? poolBusqueda : catalogo;

    const mios = biblioteca.map(j => clave(j.titulo));
    return base.filter(j => !mios.includes(clave(j.titulo)));
  }

  async function repartirJuegos() {
    const pila = fuenteActual();
    const buscando = campoBuscar.value.trim() !== "" && poolBusqueda.length > 0;

    if (pila.length === 0) {
      mensaje(zonaJuegos, buscando
        ? "Ya tienes todos los resultados de esa busqueda."
        : "No quedan juegos nuevos. Prueba con otro vale.");
      return;
    }

    let pool = pila.filter(j => !recientes.includes(clave(j.titulo)));
    if (pool.length < CUANTOS) pool = pila;

    const elegidos = sortearPonderado(pool, CUANTOS);
    recordar(elegidos);

    await mostrarJuegos(elegidos, zonaJuegos, CUANTOS);
  }

  function quitarDelEscaparate(titulo) {
    zonaJuegos.querySelectorAll(".carta").forEach(carta => {
      const suyo = carta.querySelector(".info-titulo");
      if (suyo && suyo.textContent === titulo) {
        carta.classList.add("carta--saliendo");
        setTimeout(() => carta.remove(), 250);
      }
    });
  }


  /* ===========================================================
     VALES
     Uno se ofrece en la ranura del panel. Al canjearlo pasa a la
     seccion de vales activos y la ranura ofrece otro distinto.
     Como mucho MAX_VALES activos: para canjear uno mas, hay que
     quitar alguno con su X.
     =========================================================== */

  function valesDisponibles() {
    const usados = valesActivos.map(v => v.id);
    return VALES_USABLES.filter(v => !usados.includes(v.id));
  }

  function ofrecerVale() {
    const pila = valesDisponibles().filter(v => !valeOfrecido || v.id !== valeOfrecido.id);
    valeOfrecido = sortear(pila.length > 0 ? pila : valesDisponibles(), 1)[0] || null;
    pintarValeOfrecido();
  }

  function pintarValeOfrecido() {
    zonaVale.innerHTML = "";
    if (!valeOfrecido) {
      mensaje(zonaVale, "Sin vales.");
      return;
    }

    const vale = valeOfrecido;
    const lleno = valesActivos.length >= MAX_VALES;

    const elemento = document.createElement("article");
    elemento.className = "vale-carta" + (lleno ? " vale-carta--bloqueada" : "");
    elemento.tabIndex = 0;

    elemento.innerHTML = `
      <span class="etiqueta-precio etiqueta-precio--gratis">Gratis</span>
      <div class="vale-cuerpo">
        <span class="vale-icono">${vale.icono}</span>
        <strong>${vale.nombre}</strong>
      </div>
    `;

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `
      <strong class="info-titulo">${vale.nombre}</strong>
      <p class="info-texto">${vale.descripcion}</p>
      <ul class="info-categorias">
        <li>${lleno ? "Ya tienes 2 vales" : "Pulsa para canjear"}</li>
      </ul>
    `;
    elemento.appendChild(info);

    elemento.addEventListener("click", () => canjearVale(vale));
    zonaVale.appendChild(elemento);
  }

  function pintarValesActivos() {
    zonaActivos.innerHTML = "";
    contadorVales.textContent = valesActivos.length;

    if (valesActivos.length === 0) {
      mensaje(zonaActivos, "Ninguno canjeado.");
      return;
    }

    valesActivos.forEach(vale => {
      const ficha = document.createElement("article");
      ficha.className = "vale-activo";
      ficha.tabIndex = 0;

      ficha.innerHTML = `
        <span class="vale-activo-icono">${vale.icono}</span>
        <div class="vale-activo-texto">
          <strong>${vale.nombre}</strong>
          <span>${vale.descripcion}</span>
        </div>
        <button class="quitar quitar--vale" type="button" title="Quitar este vale">&times;</button>
      `;

      ficha.querySelector(".quitar").addEventListener("click", evento => {
        evento.stopPropagation();
        quitarVale(vale);
      });

      zonaActivos.appendChild(ficha);
    });
  }

  async function canjearVale(vale) {
    if (valesActivos.length >= MAX_VALES) {
      sacudir(bloqueActivos);
      return;
    }

    valesActivos.push(vale);
    pintarValesActivos();
    ofrecerVale();                 // la ranura ofrece otro distinto
    await recargarTienda();
  }

  async function quitarVale(vale) {
    valesActivos = valesActivos.filter(v => v.id !== vale.id);
    pintarValesActivos();
    pintarValeOfrecido();          // vuelve a poder canjearse
    await recargarTienda();
  }


  /* ===========================================================
     SOBRES
     Se ensenan SOBRES_A_LA_VEZ. Al abrir uno, se sustituye por
     otro distinto, para que el usuario pueda seguir comprando.
     =========================================================== */

  /* Los sobres que no estan ya puestos en la mesa.
     sobresVisibles puede tener huecos (null) donde habia un
     sobre ya usado. */
  function sobresDisponibles() {
    const puestos = sobresVisibles.filter(Boolean).map(s => s.id);
    return SOBRES_USABLES.filter(s => !puestos.includes(s.id));
  }

  // Al usar un sobre desaparece y deja el hueco libre
  function gastarSobre(posicion) {
    sobresVisibles[posicion] = null;
    pintarSobres();
  }

  // El usuario pide un sobre nuevo para ese hueco
  function traerSobreNuevo(posicion) {
    const nuevo = sortear(sobresDisponibles(), 1)[0];
    if (!nuevo) return;

    sobresVisibles[posicion] = nuevo;
    pintarSobres();

    zonaSobres.classList.remove("renovado");
    void zonaSobres.offsetWidth;
    zonaSobres.classList.add("renovado");
  }

  function pintarSobres() {
    zonaSobres.innerHTML = "";

    sobresVisibles.forEach((sobre, posicion) => {

      // Hueco libre: el usuario puede pedir otro sobre
      if (!sobre) {
        const hueco = document.createElement("button");
        hueco.type = "button";
        hueco.className = "sobre sobre--vacio";

        hueco.innerHTML = `
          <span class="sobre-mas">+</span>
          <span class="sobre-texto">Otro sobre</span>
        `;

        hueco.addEventListener("click", () => traerSobreNuevo(posicion));
        zonaSobres.appendChild(hueco);
        return;
      }

      const elemento = document.createElement("article");
      elemento.className = "sobre";
      elemento.tabIndex = 0;

      elemento.innerHTML = `
        <div class="envoltorio ${sobre.clase}">
          <span class="envoltorio-icono">${sobre.icono}</span>
          ${sobre.nombre}
        </div>
        <p class="nota">Elige 1 de ${sobre.cuantas}</p>
      `;

      const info = document.createElement("div");
      info.className = "info";
      info.innerHTML = `
        <strong class="info-titulo">${sobre.nombre}</strong>
        <p class="info-texto">${sobre.descripcion}</p>
        <ul class="info-categorias"><li>Elige 1 de ${sobre.cuantas}</li></ul>
      `;
      elemento.appendChild(info);

      elemento.addEventListener("click", () => abrirSobre(sobre, posicion, elemento));
      zonaSobres.appendChild(elemento);
    });
  }

  async function fuenteDelSobre(sobre) {
    if (sobre.genero) return traerPorEtiqueta(sobre.genero, 16);
    return traerJuegos(sobre.filtros || {});
  }

  async function abrirSobre(sobre, posicion, elemento) {
    elemento.classList.add("sobre--abriendo");
    setTimeout(() => elemento.classList.remove("sobre--abriendo"), 400);

    modalTitulo.textContent = `${sobre.nombre} - elige 1 de ${sobre.cuantas}`;
    modalTexto.textContent  = sobre.descripcion;
    modalCartas.classList.remove("modal-cartas--cerrado");
    pintarEsqueletos(sobre.cuantas, modalCartas);
    modal.classList.add("modal--visible");

    let fuente;
    try {
      fuente = await fuenteDelSobre(sobre);
    } catch (error) {
      fuente = catalogo;
      console.warn("Sobre con datos de reserva", error);
    }

    const mios = biblioteca.map(j => clave(j.titulo));
    fuente = fuente.filter(j => !mios.includes(clave(j.titulo)));
    if (fuente.length === 0) fuente = catalogo;

    const cartas = await mostrarJuegos(
      sortearPonderado(fuente, sobre.cuantas, sobre.sesgo),
      modalCartas,
      sobre.cuantas
    );

    /* Solo se puede sacar UNA carta del sobre. El cerrojo evita
       que dos clics rapidos cuelen dos juegos antes de que el
       modal termine de cerrarse. */
    let yaElegido = false;

    modalCartas.querySelectorAll(".carta").forEach((carta, i) => {
      carta.addEventListener("click", evento => {
        evento.stopPropagation();
        if (yaElegido) return;

        if (elegir(cartas[i])) {
          yaElegido = true;
          modalCartas.classList.add("modal-cartas--cerrado");
          cerrarModal();
          gastarSobre(posicion);    // el sobre desaparece de la mesa
        }
      });
    });
  }

  function cerrarModal() {
    modal.classList.remove("modal--visible");
  }


  /* ---------- Carrito y biblioteca ---------- */

  function totalCarrito() {
    const suma = biblioteca.reduce((total, j) => total + (j.precio || 0), 0);
    return Math.round(suma * 100) / 100;
  }

  function pintarCarrito() {
    carritoTotal.textContent   = formatearPrecio(totalCarrito());
    carritoCuantos.textContent = biblioteca.length;

    btnComprar.disabled = biblioteca.length === 0;
    btnComprar.textContent = biblioteca.length === 0
      ? "Comprar"
      : `Comprar ${biblioteca.length} ${biblioteca.length === 1 ? "juego" : "juegos"}`;
  }

  function pintarSlots() {
    filaSlots.innerHTML = "";

    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";

      const juego = biblioteca[i];
      if (juego) {
        slot.classList.add("slot--lleno");
        slot.tabIndex = 0;

        const imagen = juego.imagen
          ? `<img class="portada-frente" src="${juego.imagen}" alt="">`
          : "";

        slot.innerHTML = `
          <div class="portada${juego.vertical ? " portada--vertical" : ""}">
            <span class="portada-texto">${limpiar(juego.titulo)}</span>
            ${imagen}
          </div>
          <button class="quitar" type="button" title="Quitar de la biblioteca">&times;</button>
        `;

        slot.appendChild(crearTooltip(juego, true));

        slot.querySelector(".quitar").addEventListener("click", evento => {
          evento.stopPropagation();
          devolver(juego);
        });
      }
      filaSlots.appendChild(slot);
    }

    contador.textContent = biblioteca.length;
    bloqueBiblio.classList.toggle("biblioteca--llena", biblioteca.length >= MAX_SLOTS);
  }

  function elegir(juego) {
    if (biblioteca.length >= MAX_SLOTS) {
      sacudir(bloqueBiblio);
      return false;
    }

    if (biblioteca.some(j => clave(j.titulo) === clave(juego.titulo))) return false;

    biblioteca.push(juego);
    guardar();
    quitarDelEscaparate(juego.titulo);
    pintarSlots();
    pintarCarrito();
    return true;
  }

  /* Al quitar un juego NO se recarga el escaparate: el usuario
     perderia de vista lo que estaba mirando. El juego vuelve a
     estar disponible y saldra en el proximo reroll. */
  function devolver(juego) {
    biblioteca = biblioteca.filter(j => clave(j.titulo) !== clave(juego.titulo));
    guardar();
    pintarSlots();
    pintarCarrito();
  }


  /* ===========================================================
     COMPRA
     CheapShark devuelve un enlace de redireccion por oferta que
     lleva a la tienda que la tiene: Steam, GOG, Fanatical,
     Instant Gaming... Lo usamos tal cual. Si un juego no trae
     enlace, caemos en la busqueda de Steam por su titulo.
     =========================================================== */

  function enlaceDe(juego) {
    if (juego.enlace) return juego.enlace;
    return "https://store.steampowered.com/search/?term=" + encodeURIComponent(juego.titulo);
  }

  function abrirCompra() {
    if (biblioteca.length === 0) return;

    listaCompra.innerHTML = "";

    biblioteca.forEach(juego => {
      const fila = document.createElement("li");
      fila.className = "linea-compra";

      const miniatura = juego.imagen
        ? `<img src="${juego.imagen}" alt="">`
        : `<span class="linea-sin-imagen"></span>`;

      fila.innerHTML = `
        ${miniatura}
        <span class="linea-titulo">${limpiar(juego.titulo)}</span>
        <span class="linea-precio">${formatearPrecio(juego.precio)}</span>
        <a class="boton linea-ir" href="${enlaceDe(juego)}" target="_blank" rel="noopener">Ir a la tienda</a>
      `;
      listaCompra.appendChild(fila);
    });

    totalCompra.textContent = formatearPrecio(totalCarrito());
    modalCompra.classList.add("modal--visible");
  }

  function cerrarCompra() {
    modalCompra.classList.remove("modal--visible");
  }

  function vaciar() {
    biblioteca = [];
    guardar();
    pintarSlots();
    pintarCarrito();
    cerrarCompra();
  }


  /* ---------- Buscador ---------- */

  function cerrarSugerencias() {
    listaSug.innerHTML = "";
    listaSug.classList.remove("sugerencias--visible");
  }

  function pintarSugerencias(lista) {
    if (lista.length === 0) { cerrarSugerencias(); return; }

    listaSug.innerHTML = "";

    lista.forEach(juego => {
      const fila = document.createElement("li");
      fila.className = "sugerencia";
      fila.tabIndex = 0;

      fila.innerHTML = `
        ${juego.portada ? `<img src="${juego.portada}" alt="" onerror="this.remove()">` : ""}
        <span class="sugerencia-titulo">${limpiar(juego.titulo)}</span>
        ${juego.precio ? `<span class="sugerencia-precio">${formatearPrecio(juego.precio)}</span>` : ""}
      `;

      const elegirSug = () => {
        campoBuscar.value = juego.titulo;
        cerrarSugerencias();
        buscar();
      };

      fila.addEventListener("click", elegirSug);
      fila.addEventListener("keydown", e => { if (e.key === "Enter") elegirSug(); });

      listaSug.appendChild(fila);
    });

    listaSug.classList.add("sugerencias--visible");
  }

  /* Debounce: cada tecla cancela el temporizador anterior y abre
     uno nuevo, asi solo se pide cuando el usuario deja de escribir. */
  function alEscribir() {
    clearTimeout(temporizador);
    const texto = campoBuscar.value.trim();

    if (texto.length < 2) { cerrarSugerencias(); return; }

    temporizador = setTimeout(async () => {
      try {
        pintarSugerencias(await sugerirJuegos(texto, 8));
      } catch (error) {
        cerrarSugerencias();
        console.warn("Sin sugerencias", error);
      }
    }, ESPERA);
  }

  /* La busqueda ensena TODOS los resultados que devuelve
     CheapShark, no una muestra. Y los guarda en poolBusqueda
     para que el boton de cambiar juegos rerollee sobre ellos. */
  async function buscar() {
    const texto = campoBuscar.value.trim();
    cerrarSugerencias();

    if (texto === "") {
      poolBusqueda = [];
      recientes = [];
      repartirJuegos();
      return;
    }

    pintarEsqueletos(CUANTOS, zonaJuegos);

    try {
      poolBusqueda = await buscarJuegos(texto, 60);   // el tope de CheapShark

      if (poolBusqueda.length === 0) {
        mensaje(zonaJuegos, "Ningun juego con ese nombre.");
        return;
      }

      recientes = [];
      recordar(poolBusqueda);
      await mostrarJuegos(poolBusqueda, zonaJuegos, Math.min(poolBusqueda.length, 8));

    } catch (error) {
      poolBusqueda = [];
      mensaje(zonaJuegos, "Error en la busqueda.");
      console.error(error);
    }
  }


  /* ---------- Eventos ---------- */

  btnCambiar.addEventListener("click", repartirJuegos);
  btnBuscar.addEventListener("click", buscar);
  btnSaltar.addEventListener("click", cerrarModal);
  btnComprar.addEventListener("click", abrirCompra);
  btnCerrarComp.addEventListener("click", cerrarCompra);
  btnVaciar.addEventListener("click", vaciar);

  campoBuscar.addEventListener("input", () => {
    // Si el usuario vacia el campo, se vuelve a la tienda normal
    if (campoBuscar.value.trim() === "" && poolBusqueda.length > 0) {
      poolBusqueda = [];
      recientes = [];
      cerrarSugerencias();
      repartirJuegos();
      return;
    }
    alEscribir();
  });

  campoBuscar.addEventListener("keydown", evento => {
    if (evento.key === "Enter")  buscar();
    if (evento.key === "Escape") cerrarSugerencias();
  });

  document.addEventListener("click", evento => {
    if (!evento.target.closest(".buscador")) cerrarSugerencias();
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") { cerrarModal(); cerrarCompra(); }
  });


  /* ---------- Arranque ---------- */

  /* Deja la interfaz montada con lo que tengamos, sin depender
     de ninguna peticion. Asi nunca se queda en esqueletos. */
  function montarInterfaz() {
    VALES_USABLES  = VALES.filter(v => v.tipo !== "genero" || hayRawg());
    SOBRES_USABLES = SOBRES.filter(s => !s.genero || hayRawg());

    sobresVisibles = sortear(SOBRES_USABLES, SOBRES_A_LA_VEZ);

    pintarValesActivos();
    ofrecerVale();
    pintarSobres();
  }

  async function arrancar() {
    biblioteca = recuperar();      // lo que el usuario dejo la vez anterior

    pintarSlots();
    pintarCarrito();
    pintarEsqueletos(CUANTOS, zonaJuegos);

    // Proxy en Vercel, o llamada directa en local
    await elegirModo();

    // Primero la tienda, que es lo que el usuario espera ver
    await recargarTienda();

    // Y despues, sin bloquear nada, si hay RAWG configurado
    const conRawg = await comprobarRawg();

    if (!conRawg) {
      console.info("Sin RAWG: no se ofrecen vales ni sobres de genero.");
    }

    montarInterfaz();
  }

  // Monta ya lo que no depende del servidor
  montarInterfaz();
  arrancar();

});