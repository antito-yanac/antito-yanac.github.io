//======================================================
// Google Earth Search v1.4
// Archivo principal
//======================================================

import { cargarLugares } from "./data.js";
import { crearBuscador, teclado } from "./search.js";
import { crearMapa } from "./map.js";

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