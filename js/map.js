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

export function crearMapa(idDiv) {

    map = L.map(idDiv);

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

    return {

        cargarGeoJSON,

        irA,

        limpiarSeleccion

    };

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
