//======================================================
// Buscador Lugares Antamina 2026
// Archivo principalvigilancia
//======================================================

import { cargarLugares } from "./data.js";
import { crearBuscador, teclado } from "./search.js";
import { crearMapa } from "./map.js";
import { inicializarFirebase } from "./notifications.js";
import { escucharMensajesPush } from "./mensajes.js";
import { mostrarAlertaCompleta, cerrarAlertaTotal } from "./alertas.js";

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
// Botón de prueba del Sistema de Alerta Meteorológica
// Simula la recepción de una alerta para verificar los
// 12 efectos visuales. Se puede eliminar en producción.
//======================================================

function configurarBotonPrueba() {

    const btn = document.getElementById("btn-test-alerta");

    if (!btn) return;

    let nivelIndex = 0;
    const niveles = ["vigilancia", "precaucion", "alerta", "emergencia"];
    const titulos = {
        vigilancia:  "🌩️ LIBRE DE ALERTAS",
        precaucion:  "⚡ PRECAUCIÓN: ACTIVIDAD ELÉCTRICA",
        alerta:      "⚡ ALERTA DE TORMENTA ELÉCTRICA",
        emergencia:  "⚡ ALERTA ROJA: TORMENTA ELÉCTRICA INTENSA"
    };
    const mensajes = {
        vigilancia:  "No se registran alertas activas por tormenta eléctrica. Puede continuar con sus actividades con normalidad.",
        precaucion:  "Posibles descargas eléctricas detectadas en las proximidades.",
        alerta:      "Se detectó actividad eléctrica intensa en el distrito de Yanacancha.",
        emergencia:  "Tormenta eléctrica severa sobre el distrito de Yanacancha. Descargas frecuentes."
    };

    btn.addEventListener("click", () => {
        const nivel = niveles[nivelIndex % niveles.length];
        nivelIndex++;

        // Usar coordenadas reales de un lugar de Antamina (Yanacancha)
        mostrarAlertaCompleta({
            nivel: nivel,
            titulo: titulos[nivel],
            mensaje: mensajes[nivel],
            distrito: "Yanacancha",
            intensidad: nivel === "emergencia" ? "Muy alta" : nivel === "alerta" ? "Alta" : "Moderada",
            lat: -9.574987,
            lng: -77.029009,
            duracionMin: nivel === "emergencia" ? 15 : nivel === "alerta" ? 30 : 45
        });
    });

}

configurarBotonPrueba();

//======================================================

iniciar();
