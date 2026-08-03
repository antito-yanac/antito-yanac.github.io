//======================================================
// Buscador Lugares Antamina 2026
// Archivo principal
//======================================================

import { cargarLugares } from "./data.js";
import { crearBuscador, teclado } from "./search.js";
import { crearMapa } from "./map.js";
import { inicializarFirebase } from "./notifications.js";
import { escucharMensajesPush } from "./mensajes.js";

//======================================================
// Referencias HTML
//======================================================

const input = document.getElementById("search");
const stats = document.getElementById("stats");
const results = document.getElementById("results");

//======================================================

let lugares = [];
let buscar = null;
let mapa = null;

//======================================================
// Inicio
//======================================================

async function iniciar() {

    try {

        stats.textContent = "Cargando lugares...";

        lugares = await cargarLugares();

        buscar = crearBuscador(lugares);

        mapa = crearMapa("map");

        mapa.cargarGeoJSON(lugares);

        stats.textContent = `${lugares.length} lugares cargados`;

        // Escuchar mensajes push en tiempo real (Firestore).
        // Todos los navegadores con la página abierta reciben el
        // mensaje real que el admin envíe desde admin.html.
        escucharMensajesPush();

        // Habilitar Firebase Messaging de forma silenciosa (permiso +
        // Service Worker + token). No muestra toasts de estado.
        inicializarFirebase().catch(err => console.warn("Firebase:", err.message));

    } catch (error) {

        console.error(error);

        stats.textContent = "Error cargando lugares.json";

    }

}

//======================================================
// Eventos
//======================================================

input.addEventListener("input", buscarTexto);

input.addEventListener("keydown", controlarTeclado);

//======================================================
// Buscar
//======================================================

function buscarTexto() {

    const texto = input.value.trim();

    cambiarColorFondo(texto);

    buscar(
        texto,
        results,
        mapa,
        stats
    );

}

//======================================================
// Teclado
//======================================================

function controlarTeclado(e) {

    teclado(e, mapa);

}

//======================================================
// Fondo dinámico
//======================================================

function cambiarColorFondo(texto) {

    if (texto.length === 0) {

        document.body.style.backgroundColor = "#2c3e50";

        return;

    }

    const tono = (texto.length * 18) % 360;

    document.body.style.backgroundColor =
        `hsl(${tono},45%,30%)`;

}

//======================================================

iniciar();
