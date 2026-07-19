// js/earth.js

export function abrirEarth(lugar) {

    const url =

`https://earth.google.com/web/search/${lugar.lat},${lugar.lng}`;

    window.open(url, "_blank");

}

export function copiarCoordenadas(lugar){

const texto =

`${lugar.lng}, ${lugar.lat}, ${lugar.alt}`;

navigator.clipboard.writeText(texto);

alert("Coordenadas copiadas.");

}