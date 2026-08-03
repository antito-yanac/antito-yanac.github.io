// js/mensajes.js
//
// Sistema de mensajes en tiempo real usando Firebase Firestore.
//
// ¿Por qué Firestore y no "FCM puro"?
// Enviar una notificación push real (FCM) a MUCHOS dispositivos requiere
// un servidor backend con la Admin SDK / clave privada — no se puede hacer
// de forma segura solo con JavaScript en el navegador.
//
// Firestore SÍ permite tiempo real sin backend: el panel admin escribe
// un documento, y TODOS los navegadores con la página abierta (gracias a
// onSnapshot) reciben el cambio al instante y muestran el popup con el
// mensaje real.
//
// Esto cubre el caso principal: "que llegue el mensaje real a todos los
// que están viendo la página en ese momento".

import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { obtenerApp } from "./firebase-app.js";
import { mostrarToast, reproducirSonido } from "./notifications.js";

const NOMBRE_COLECCION = "mensajes_push";

let db = null;
let yaEscuchando = false;
let primeraCarga = true; // evita mostrar todos los mensajes viejos al abrir la página

function obtenerDB() {
    if (!db) {
        db = getFirestore(obtenerApp());
    }
    return db;
}

/**
 * Envía un mensaje nuevo a Firestore. Todos los navegadores con
 * escucharMensajesPush() activo lo recibirán en tiempo real.
 * @param {string} titulo
 * @param {string} cuerpo
 */
export async function enviarMensajePush(titulo, cuerpo) {
    const database = obtenerDB();
    const ref = collection(database, NOMBRE_COLECCION);
    await addDoc(ref, {
        titulo,
        cuerpo,
        fecha: serverTimestamp()
    });
}

/**
 * Escucha en tiempo real los mensajes nuevos y muestra un toast +
 * notificación nativa (si hay permiso) a TODOS los navegadores con
 * la página abierta.
 * Debe llamarse una sola vez al iniciar la app (index.html y admin.html).
 */
export function escucharMensajesPush() {
    if (yaEscuchando) return;
    yaEscuchando = true;

    try {
        const database = obtenerDB();
        const ref = collection(database, NOMBRE_COLECCION);
        const q = query(ref, orderBy("fecha", "desc"), limit(1));

        onSnapshot(q, (snapshot) => {
            // Ignorar la carga inicial (mensajes ya existentes al abrir la página)
            if (primeraCarga) {
                primeraCarga = false;
                return;
            }

            snapshot.docChanges().forEach((cambio) => {
                if (cambio.type === "added") {
                    const data = cambio.doc.data();
                    const titulo = data.titulo || "🔔 Notificación";
                    const cuerpo = data.cuerpo || "";

                    // Popup visual + sonido
                    mostrarToast(titulo, cuerpo, "alerta", true);

                    // Notificación nativa del sistema (si hay permiso)
                    if ("Notification" in window && Notification.permission === "granted") {
                        try {
                            new Notification(titulo, {
                                body: cuerpo,
                                icon: "https://cdn-icons-png.flaticon.com/512/1827/1827301.png",
                                tag: "antamina-mensaje-" + Date.now()
                            });
                        } catch (e) {
                            // Silencioso: el toast ya se mostró
                        }
                    }
                }
            });
        }, (error) => {
            console.error("Error escuchando mensajes:", error);
        });

    } catch (error) {
        console.error("No se pudo iniciar la escucha de mensajes:", error);
    }
}
