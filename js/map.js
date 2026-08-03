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

export function crearMapa(idDiv) {

    map = L.map(idDiv);

    // --------------------------------------------------
    // Crear el icono del marcador "Tú" aquí (cuando Leaflet
    // ya está garantizado que está cargado)
    // --------------------------------------------------
    iconoTu = L.divIcon({
        className: "",
        html: '<div style="position:relative;text-align:center;">' +
                '<div class="marker-tu"></div>' +
                '<div class="etiqueta-tu">Tú</div>' +
              '</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    // --------------------------------------------------
    // Capa base: MapTiler (raster tiles) reemplaza a
    // OpenStreetMap. Leaflet se mantiene igual.
    // --------------------------------------------------
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

    // --------------------------------------------------
    // Botón de ubicación actual (estilo Google Maps)
    // --------------------------------------------------
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

    // Verificar soporte de geolocation
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    // Estado de carga: animación pulse
    btn.classList.add("buscar");

    // Opciones de alta precisión
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // Éxito: quitar animación
            btn.classList.remove("buscar");

            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            // Eliminar marcador y círculo anteriores si existen
            if (markerUbicacion) {
                map.removeLayer(markerUbicacion);
            }
            if (circleAccuracy) {
                map.removeLayer(circleAccuracy);
            }

            // Círculo de precisión (radio = accuracy en metros)
            circleAccuracy = L.circle([lat, lng], {
                radius: accuracy,
                color: "#00c853",
                weight: 1.5,
                opacity: 0.4,
                fillColor: "#00c853",
                fillOpacity: 0.12
            }).addTo(map);

            // Marcador verde "Tú"
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

            // Volar hacia la ubicación con zoom apropiado
            // Mayor accuracy → mayor zoom
            let zoomLevel = 16;
            if (accuracy > 100) zoomLevel = 14;
            if (accuracy > 500) zoomLevel = 12;

            map.flyTo([lat, lng], zoomLevel, { duration: 1.2 });

            // Iniciar seguimiento continuo (actualiza al moverse)
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
                (err) => { /* errores de seguimiento silenciosos */ },
                { enableHighAccuracy: true, maximumAge: 5000 }
            );

            console.log("✅ Ubicación actual:", lat, lng, "±" + accuracy + "m");
        },
        (error) => {
            // Error: quitar animación
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

// ======================================================
// FIN: Funciones de ubicación
// ======================================================

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

            layer.bindPopup(`
                <b>${nombre}</b><br>
                ${feature.geometry.type}
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

        17,

        {

            duration: 1.2

        }

    );

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
