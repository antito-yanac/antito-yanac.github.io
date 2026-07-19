// js/search.js

import { abrirEarth } from "./earth.js";
import {mostrarInformacion} from "./ui.js";

let fuse;
let resultados = [];
let indiceSeleccionado = -1;

export function crearBuscador(lugares) {

    fuse = new Fuse(lugares, {

        keys: [
            "nombre"
        ],

        threshold: 0.35,

        ignoreLocation: true,

        includeScore: true

    });

    return buscar;

}

function buscar(texto, contenedor, mapa, stats) {

    contenedor.innerHTML = "";

    indiceSeleccionado = -1;

    if (texto.trim() === "") {

        resultados = [];

        stats.innerHTML = "";

        return 0;

    }

    resultados = fuse.search(texto).map(r => r.item);

    stats.innerHTML =
        `${resultados.length} resultado(s)`;

    resultados.forEach((lugar, index) => {

        const div = document.createElement("div");

        div.className = "result";

        div.dataset.index = index;

        div.innerHTML = `

        <h3>${resaltar(lugar.nombre, texto)}</h3>

        <p>

        ${lugar.tipo}

        </p>

        <small>

        ${lugar.lat.toFixed(6)},
        ${lugar.lng.toFixed(6)}

        </small>

        `;

        div.onclick = () => {

            seleccionar(index, mapa);

        };

        div.ondblclick = () => {

            abrirEarth(lugar);

        };

        contenedor.appendChild(div);

    });

    if (resultados.length > 0) {

        seleccionar(0, mapa);

    }

    return resultados.length;

}

function seleccionar(index, mapa) {

    const items =
        document.querySelectorAll(".result");

    items.forEach(x =>
        x.classList.remove("selected")
    );

    indiceSeleccionado = index;

    if (items[index]) {

        items[index].classList.add("selected");

        items[index].scrollIntoView({

            block: "nearest"

        });

    }

    mapa.irA(resultados[index]);
    mostrarInformacion(resultados[index]);

}

export function teclado(e, mapa) {

    if (resultados.length === 0)
        return;

    switch (e.key) {

        case "ArrowDown":

            e.preventDefault();

            indiceSeleccionado++;

            if (indiceSeleccionado >= resultados.length)
                indiceSeleccionado = 0;

            seleccionar(indiceSeleccionado, mapa);

            break;

        case "ArrowUp":

            e.preventDefault();

            indiceSeleccionado--;

            if (indiceSeleccionado < 0)
                indiceSeleccionado =
                    resultados.length - 1;

            seleccionar(indiceSeleccionado, mapa);

            break;

        case "Enter":

            abrirEarth(resultados[indiceSeleccionado]);

            break;

        case "Escape":

            document.getElementById("search").value = "";

            document.getElementById("results").innerHTML = "";

            break;

    }

}

function resaltar(texto, buscar) {

    const exp =
        new RegExp(`(${buscar})`, "ig");

    return texto.replace(
        exp,
        "<mark>$1</mark>"
    );

}