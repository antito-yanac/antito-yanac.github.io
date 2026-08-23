// js/map.js

let map;

let geoLayer;

let markerSeleccionado = null;

// ======================================================
// API key de MapTiler
// ======================================================
// Reemplaza este valor por tu propia key si cambia.
// Consíguela en: https://cloud.maptiler.com/account/keys/
// Recomendado: restringir la key por dominio desde el panel
// de MapTiler (antito-yanac.github.io) una vez en producción.
const MAPTILER_KEY = "j4zAW83dNrfEbSRUvYN0";

// Estilo del mapa. Opciones disponibles:
//   hybrid-v4    -> satelital + etiquetas (actual)
//   satellite    -> solo satelital
//   streets-v4   -> calles clásico
//   topo-v4      -> topográfico
//   basic-v4     -> minimalista
//   dark-v4      -> oscuro
//   pastel-v4    -> pastel
const MAP_STYLE = "hybrid-v4";

// ======================================================
// Variables para ubicación actual ("Tú")
// ======================================================
let markerUbicacion = null;   // marcador verde "Tú"
let circleAccuracy = null;    // círculo de precisión GPS
let watchId = null;           // ID del seguimiento continuo
let iconoTu = null;           // icono del marcador (se crea en crearMapa)

// ======================================================
// 7. MAPA ILUMINADO — Alerta meteorológica
// ======================================================
export function iluminarDistrito(lat, lng, nivelKey = "emergencia") {

    if (!map) return null;

    const colores = {
        vigilancia: "#2ecc71",
        precaucion: "#f1c40f",
        alerta:     "#e67e22",
        emergencia: "#e74c3c"
    };
    const color = colores[nivelKey] || colores.emergencia;

    // --- Círculo rojo parpadeante ---
    const circulo = L.circle([lat, lng], {
        radius: 1800,            // metros
        color: color,
        weight: 3,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.2,
        dashArray: "6 6"
    }).addTo(map);

    // --- Núcleo (punto central sólido) ---
    const nucleo = L.circleMarker([lat, lng], {
        radius: 10,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
    }).addTo(map);

    // --- Rayo SVG cayendo sobre el punto ---
    const rayoIcon = L.divIcon({
        className: "al-mapa-rayo",
        html: `<svg class="al-mapa-rayo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                 <polygon points="58,5 30,52 48,52 38,95 72,42 52,42 62,5"
                          fill="#ffeb3b" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
               </svg>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
    const rayoMarker = L.marker([lat, lng], {
        icon: rayoIcon,
        zIndexOffset: 2000
    }).addTo(map);

    // --- Anillo de pulso expansivo (radar) ---
    const pulsoIcon = L.divIcon({
        className: "",
        html: `<div style="width:40px;height:40px;border-radius:50%;
                 border:3px solid ${color};position:relative;
                 animation:al-radar-pulso 2s ease-out infinite;"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    const pulsoMarker = L.marker([lat, lng], { icon: pulsoIcon, zIndexOffset: 1900 }).addTo(map);

    // --- Popup informativo en el punto ---
    circulo.bindPopup(
        `<b>⚡ Zona de alerta</b><br>` +
        `Actividad eléctrica detectada<br>` +
        `Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`
    );

    // --- Parpadeo del círculo (opacidad) ---
    let parpadeoOn = true;
    const intervalParpadeo = setInterval(() => {
        parpadeoOn = !parpadeoOn;
        circulo.setStyle({ fillOpacity: parpadeoOn ? 0.35 : 0.12, opacity: parpadeoOn ? 0.9 : 0.4 });
    }, 700);

    // --- Volar al punto ---
    map.flyTo([lat, lng], 12, { duration: 1.4 });

    return {
        map,
        circulo,
        nucleo,
        rayoMarker,
        pulsoMarker,
        intervalParpadeo,
        detener() {
            clearInterval(intervalParpadeo);
            try { map.removeLayer(circulo); } catch(e){}
            try { map.removeLayer(nucleo); } catch(e){}
            try { map.removeLayer(rayoMarker); } catch(e){}
            try { map.removeLayer(pulsoMarker); } catch(e){}
        }
    };
}

// ======================================================
// 7b. ILUMINAR ZONA DESDE GEOJSON (lugares.json)
// ======================================================
export async function iluminarDistritoZona(nombreZona, nivelKey = "emergencia") {
    if (!map) return null;

    const colores = {
        vigilancia: "#2ecc71",
        precaucion: "#f1c40f",
        alerta:     "#e67e22",
        emergencia: "#e74c3c"
    };
    const color = colores[nivelKey] || colores.emergencia;

    // --- 1. Buscar el punto en el GeoJSON cargado ---
    let puntoEncontrado = null;

    const zonaLower = (nombreZona || "").toLowerCase();
    const partes = nombreZona.split("-");
    const nombreBusqueda = partes.length > 1
        ? partes.slice(1).join("-").trim().toLowerCase()
        : zonaLower;

    if (geoLayer) {
        geoLayer.eachLayer(layer => {
            if (puntoEncontrado) return;
            const f = layer.feature;
            if (!f) return;
            if (f.geometry && f.geometry.type === "Point") {
                const nombre = (f.properties?.Name || "").toLowerCase();
                if (nombre.includes(nombreBusqueda) || nombreBusqueda.includes(nombre)) {
                    const coords = f.geometry.coordinates;
                    puntoEncontrado = {
                        lat: coords[1],
                        lng: coords[0],
                        nombre: f.properties?.Name || nombreZona,
                        layer: layer
                    };
                }
            }
        });
    }

    // --- 2. Si no se encuentra en GeoJSON, usar coordenadas de zonas.json ---
    if (!puntoEncontrado) {
        try {
            const data = await cargarZonas();
            if (data && data.zonas) {
                const zona = data.zonas.find(z =>
                    z.nombre === nombreZona ||
                    z.nombre.includes(nombreZona) ||
                    nombreZona.includes(z.nombreCorto)
                );
                if (zona) {
                    puntoEncontrado = {
                        lat: zona.lat,
                        lng: zona.lng,
                        nombre: zona.nombre,
                        layer: null
                    };
                }
            }
        } catch (e) { /* fallback ya manejado */ }
    }

    if (!puntoEncontrado) {
        console.warn("map.js: no se encontró punto para la zona:", nombreZona);
        return null;
    }

    const lat = puntoEncontrado.lat;
    const lng = puntoEncontrado.lng;

    // --- 3. Pintar el efecto sobre el punto encontrado ---
    const circulo = L.circle([lat, lng], {
        radius: 1800,
        color: color,
        weight: 3,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.2,
        dashArray: "6 6"
    }).addTo(map);

    const circuloMedio = L.circle([lat, lng], {
        radius: 900,
        color: color,
        weight: 2,
        opacity: 0.7,
        fillColor: color,
        fillOpacity: 0.15
    }).addTo(map);

    const nucleo = L.circleMarker([lat, lng], {
        radius: 10,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
    }).addTo(map);

    const rayoIcon = L.divIcon({
        className: "al-mapa-rayo",
        html: `<svg class="al-mapa-rayo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                 <polygon points="58,5 30,52 48,52 38,95 72,42 52,42 62,5"
                          fill="#ffeb3b" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
               </svg>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
    const rayoMarker = L.marker([lat, lng], {
        icon: rayoIcon,
        zIndexOffset: 2000
    }).addTo(map);

    const pulsoIcon = L.divIcon({
        className: "",
        html: `<div style="width:40px;height:40px;border-radius:50%;
                 border:3px solid ${color};position:relative;
                 animation:al-radar-pulso 2s ease-out infinite;"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    const pulsoMarker = L.marker([lat, lng], { icon: pulsoIcon, zIndexOffset: 1900 }).addTo(map);

    circulo.bindPopup(
        `<b>⚡ Zona de alerta</b><br>` +
        `Actividad eléctrica detectada<br>` +
        `<b>${puntoEncontrado.nombre}</b><br>` +
        `Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`
    );

    let parpadeoOn = true;
    const intervalParpadeo = setInterval(() => {
        parpadeoOn = !parpadeoOn;
        circulo.setStyle({ fillOpacity: parpadeoOn ? 0.35 : 0.12, opacity: parpadeoOn ? 0.9 : 0.4 });
        circuloMedio.setStyle({ fillOpacity: parpadeoOn ? 0.25 : 0.08, opacity: parpadeoOn ? 0.7 : 0.3 });
    }, 700);

    map.flyTo([lat, lng], 12, { duration: 1.4 });

    return {
        map,
        circulo,
        circuloMedio,
        nucleo,
        rayoMarker,
        pulsoMarker,
        puntoEncontrado,
        intervalParpadeo,
        detener() {
            clearInterval(intervalParpadeo);
            try { map.removeLayer(circulo); } catch(e){}
            try { map.removeLayer(circuloMedio); } catch(e){}
            try { map.removeLayer(nucleo); } catch(e){}
            try { map.removeLayer(rayoMarker); } catch(e){}
            try { map.removeLayer(pulsoMarker); } catch(e){}
        }
    };
}

export function crearMapa(idDiv) {

    map = L.map(idDiv);

    iconoTu = L.divIcon({
        className: "",
        html: '<div style="position:relative;text-align:center;">' +
                '<div class="marker-tu"></div>' +
                '<div class="etiqueta-tu">Tú</div>' +
              '</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    L.tileLayer(
        `https://api.maptiler.com/maps/${MAP_STYLE}/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
        {
            tileSize: 512,
            zoomOffset: -1,
            minZoom: 1,
            attribution:
                '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
                '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
            crossOrigin: true
        }
    ).addTo(map);

    map.setView([-9.50, -77.00], 9);

    const btnUbicacion = document.getElementById("btn-ubicacion");
    if (btnUbicacion) {
        btnUbicacion.addEventListener("click", mostrarMiUbicacion);
    }

    return {
        cargarGeoJSON,
        irA,
        limpiarSeleccion
    };

}

// ======================================================
// FUNCIÓN: Mostrar mi ubicación actual
// ======================================================
function mostrarMiUbicacion() {

    const btn = document.getElementById("btn-ubicacion");

    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    btn.classList.add("buscar");

    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            btn.classList.remove("buscar");

            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            if (markerUbicacion) {
                map.removeLayer(markerUbicacion);
            }
            if (circleAccuracy) {
                map.removeLayer(circleAccuracy);
            }

            circleAccuracy = L.circle([lat, lng], {
                radius: accuracy,
                color: "#00c853",
                weight: 1.5,
                opacity: 0.4,
                fillColor: "#00c853",
                fillOpacity: 0.12
            }).addTo(map);

            markerUbicacion = L.marker([lat, lng], {
                icon: iconoTu,
                zIndexOffset: 1000
            }).addTo(map);

            markerUbicacion.bindPopup(
                `<b>📍 Tu ubicación</b><br>` +
                `Lat: ${lat.toFixed(6)}<br>` +
                `Lng: ${lng.toFixed(6)}<br>` +
                `Precisión: ±${Math.round(accuracy)} m`
            );

            let zoomLevel = 16;
            if (accuracy > 100) zoomLevel = 14;
            if (accuracy > 500) zoomLevel = 12;

            map.flyTo([lat, lng], zoomLevel, { duration: 1.2 });

            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
            watchId = navigator.geolocation.watchPosition(
                (pos2) => {
                    if (markerUbicacion) {
                        markerUbicacion.setLatLng([pos2.coords.latitude, pos2.coords.longitude]);
                    }
                    if (circleAccuracy) {
                        circleAccuracy.setLatLng([pos2.coords.latitude, pos2.coords.longitude]);
                        circleAccuracy.setRadius(pos2.coords.accuracy);
                    }
                },
                (err) => { },
                { enableHighAccuracy: true, maximumAge: 5000 }
            );

            console.log("✅ Ubicación actual:", lat, lng, "±" + accuracy + "m");
        },
        (error) => {
            btn.classList.remove("buscar");

            let mensaje = "No se pudo obtener tu ubicación.\n\n";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    mensaje += "⛔ Permiso denegado.\n" +
                               "Activa la ubicación:\n" +
                               "1. Toca el ícono 🔒 en la barra de direcciones\n" +
                               "2. Permite el acceso a tu ubicación\n" +
                               "3. Recarga la página";
                    break;
                case error.POSITION_UNAVAILABLE:
                    mensaje += "📡 Posición no disponible.\n" +
                               "Verifica que el GPS esté activado.";
                    break;
                case error.TIMEOUT:
                    mensaje += "⏱️ Tiempo agotado.\n" +
                               "Inténtalo de nuevo.";
                    break;
                default:
                    mensaje += "Error desconocido: " + error.message;
            }
            alert(mensaje);
        },
        options
    );

}

function cargarGeoJSON(lugares) {

    if (geoLayer) {

        geoLayer.remove();

    }

    const geojson = {

        type: "FeatureCollection",

        features: lugares.map(l => l.feature)

    };

    geoLayer = L.geoJSON(geojson, {

        pointToLayer(feature, latlng) {

            return L.circleMarker(latlng, {

                radius: 7,

                fillColor: "#4285f4",

                color: "#ffffff",

                weight: 2,

                opacity: 1,

                fillOpacity: 0.9

            });

        },

        onEachFeature(feature, layer) {

            const nombre = feature.properties?.Name || "Sin nombre";

            // Se eliminó la variable del tipo de geometría (Point/Polygon)
            layer.bindPopup(`
                <b>${nombre}</b>
            `);

        }

    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), {

        padding: [30, 30]

    });

}

function limpiarSeleccion() {

    if (markerSeleccionado) {

        markerSeleccionado.setStyle({

            fillColor: "#4285f4",

            radius: 7

        });

    }

}

function irA(lugar) {

    limpiarSeleccion();

    map.flyTo(

        [lugar.lat, lugar.lng],

        12,

        {

            duration: 1.2

        }

    );
    map.once("moveend", () => {

        const desplazamientoY =
            Math.round(map.getSize().y * 0.10);

        map.panBy(
            [0, desplazamientoY],
            {
                animate: true,
                duration: 0.5
            }
        );

    });

    geoLayer.eachLayer(layer => {

        const f = layer.feature;

        if (f === lugar.feature) {

            markerSeleccionado = layer;

            if (layer.setStyle) {

                layer.setStyle({

                    radius: 11,

                    fillColor: "#ff4444"

                });

            }

            layer.openPopup();

        }

    });

}

// ======================================================
// PINTAR POLÍGONO DE ZONA CON COLOR DE ALERTA
// ======================================================
let zonasData = null;
let poligonoZonaActivo = null;

async function cargarZonas() {
    if (zonasData) return zonasData;
    try {
        const resp = await fetch("./zonas.json");
        zonasData = await resp.json();
        return zonasData;
    } catch (e) {
        console.warn("map.js: no se pudo cargar zonas.json", e);
        return null;
    }
}

export async function pintarPoligonoZona(nombreZona, color = "#e74c3c") {
    if (!map) return null;

    limpiarPoligonosZona();

    const data = await cargarZonas();
    if (!data || !data.zonas) return null;

    const zona = data.zonas.find(z =>
        z.nombre === nombreZona ||
        z.nombreCorto === nombreZona ||
        z.nombre.includes(nombreZona) ||
        nombreZona.includes(z.nombreCorto)
    );

    if (!zona) {
        console.warn("map.js: zona no encontrada:", nombreZona);
        return null;
    }

    const latlngs = zona.poligono.map(coord => [coord[1], coord[0]]);

    poligonoZonaActivo = L.polygon(latlngs, {
        color: color,
        weight: 4,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.3,
        dashArray: "10 6"
    }).addTo(map);

    poligonoZonaActivo.bindPopup(
        `<b>⚡ ${zona.nombre}</b><br>` +
        `Zona bajo alerta meteorológica`
    );

    if (zona.lat && zona.lng) {
        map.flyTo([zona.lat, zona.lng], 13, { duration: 1.4 });
    } else {
        map.fitBounds(poligonoZonaActivo.getBounds(), { padding: [40, 40] });
    }

    return {
        zona: zona,
        poligono: poligonoZonaActivo,
        detener() {
            limpiarPoligonosZona();
        }
    };
}

export function limpiarPoligonosZona() {
    if (poligonoZonaActivo && map) {
        try {
            map.removeLayer(poligonoZonaActivo);
        } catch (e) { }
        poligonoZonaActivo = null;
    }
}
