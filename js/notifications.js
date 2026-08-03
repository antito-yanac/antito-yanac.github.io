// js/notifications.js
//
// Sistema de notificaciones: Firebase Cloud Messaging (push reales),
// popups/toasts visuales y sonido.
//
// No rompe la lógica existente de la app. Se inicializa desde app.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging.js";

import { firebaseConfig, vapidKey } from "./firebase-config.js";

// ======================================================
// Estado interno
// ======================================================
let messaging = null;
let currentToken = null;
let audioCtx = null;

// ======================================================
// Sonido (Web Audio API + archivo WAV de respaldo)
// ======================================================

/**
 * Reproduce el sonido de notificación.
 * Usa Web Audio API (oscilador) como método principal para máxima
 * compatibilidad, y carga el archivo sounds/notificacion.wav como
 * alternativa si el navegador lo permite.
 */
export function reproducirSonido() {
    try {
        // Método 1: Web Audio API (beep sintético, no requiere archivos)
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }

        if (audioCtx) {
            // Reanudar contexto si fue suspendido (política de autoplay)
            if (audioCtx.state === "suspended") {
                audioCtx.resume();
            }

            // Doble beep ascendente: 880Hz -> 1175Hz
            const ahora = audioCtx.currentTime;

            // Primer tono
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = "sine";
            osc1.frequency.value = 880;
            gain1.gain.setValueAtTime(0, ahora);
            gain1.gain.linearRampToValueAtTime(0.3, ahora + 0.01);
            gain1.gain.linearRampToValueAtTime(0, ahora + 0.22);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(ahora);
            osc1.stop(ahora + 0.25);

            // Segundo tono (más agudo)
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = "sine";
            osc2.frequency.value = 1175;
            gain2.gain.setValueAtTime(0, ahora + 0.27);
            gain2.gain.linearRampToValueAtTime(0.3, ahora + 0.28);
            gain2.gain.linearRampToValueAtTime(0, ahora + 0.55);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(ahora + 0.27);
            osc2.stop(ahora + 0.6);
        }

        // Método 2 (respaldo): intentar reproducir el archivo WAV
        try {
            const audio = new Audio("./sounds/notificacion.wav");
            audio.volume = 0.4;
            audio.play().catch(() => {
                // Silencioso: el método Web Audio ya sonó
            });
        } catch (e) {
            // Silencioso
        }
    } catch (e) {
        console.warn("No se pudo reproducir sonido:", e);
    }
}

// ======================================================
// Popups / Toasts visuales
// ======================================================

/**
 * Muestra un toast (popup) en pantalla.
 * @param {string} titulo  - Título en negrita
 * @param {string} mensaje - Texto del cuerpo
 * @param {string} tipo    - "info" | "exito" | "alerta"
 * @param {boolean} conSonido - si true, reproduce sonido
 */
export function mostrarToast(titulo, mensaje, tipo = "info", conSonido = false) {
    if (conSonido) reproducirSonido();

    // Crear contenedor si no existe
    let contenedor = document.getElementById("toast-container");
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "toast-container";
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement("div");
    toast.className = toast toast-${tipo};

    const iconos = {
        info: "ℹ️",
        exito: "✅",
        alerta: "🔔"
    };

    toast.innerHTML = `
        <div class="toast-icono">${iconos[tipo] || "ℹ️"}</div>
        <div class="toast-cuerpo">
            <div class="toast-titulo">${titulo}</div>
            <div class="toast-mensaje">${mensaje}</div>
        </div>
        <div class="toast-cerrar">&times;</div>
    `;

    contenedor.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.add("toast-visible");
    });

    // Cerrar al hacer clic en la X
    toast.querySelector(".toast-cerrar").addEventListener("click", () => {
        cerrarToast(toast);
    });

    // Auto-cerrar después de 5 segundos
    const timeoutId = setTimeout(() => cerrarToast(toast), 5000);
    toast.dataset.timeout = timeoutId;
}

function cerrarToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(Number(toast.dataset.timeout));
    toast.classList.remove("toast-visible");
    toast.classList.add("toast-saliendo");
    setTimeout(() => toast.remove(), 300);
}

// ======================================================
// Firebase Cloud Messaging (Push reales)
// ======================================================

/**
 * Inicializa Firebase y configura FCM.
 * Solicita permiso de notificaciones y obtiene el token del dispositivo.
 * @returns {Promise<string|null>} token FCM o null si falla
 */
export async function inicializarFirebase() {
    try {
        // Inicializar app
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        // Escuchar mensajes cuando la app está en primer plano (abierta)
        onMessage(messaging, (payload) => {
            console.log("Mensaje FCM recibido:", payload);

            const titulo = payload.notification?.title || "Notificación";
            const cuerpo = payload.notification?.body || "Tienes un nuevo mensaje";

            // Mostrar toast visual + sonido
            mostrarToast(titulo, cuerpo, "alerta", true);

            // También mostrar notificación nativa del navegador si hay permiso
            if (Notification.permission === "granted") {
                try {
                    new Notification(titulo, {
                        body: cuerpo,
                        icon: "https://cdn-icons-png.flaticon.com/512/1827/1827301.png",
                        tag: "antamina-fcm"
                    });
                } catch (e) {
                    // Silencioso: el toast ya se mostró
                }
            }
        });

        // Solicitar permiso y obtener token
        const token = await solicitarPermisoYToken();
        return token;

    } catch (error) {
        console.error("Error inicializando Firebase:", error);
        mostrarToast(
            "Firebase",
            "No se pudo inicializar notificaciones push. Revisa js/firebase-config.js",
            "alerta",
            false
        );
        return null;
    }
}

/**
 * Solicita permiso de notificaciones al usuario y obtiene el token FCM.
 */
async function solicitarPermisoYToken() {
    try {
        // Verificar soporte del navegador
        if (!("Notification" in window)) {
            console.warn("Este navegador no soporta notificaciones.");
            return null;
        }

        // Solicitar permiso
        const permiso = await Notification.requestPermission();

        if (permiso !== "granted") {
            console.info("Permiso de notificaciones denegado por el usuario.");
            mostrarToast(
                "Notificaciones",
                "Permiso denegado. Actívalo para recibir alertas push.",
                "info",
                false
            );
            return null;
        }

        // Obtener token FCM
        currentToken = await getToken(messaging, {
            vapidKey: vapidKey
        });

        if (currentToken) {
            console.log("Token FCM obtenido:", currentToken);
            mostrarToast(
                "Notificaciones activadas ✅",
                "Ya puedes recibir alertas push. Token copiado a consola (F12).",
                "exito",
                true
            );

            // Copiar token al portapapeles para que lo uses en Firebase Console
            try {
                await navigator.clipboard.writeText(currentToken);
                console.log("Token copiado al portapapeles.");
            } catch (e) {
                // Silencioso
            }
        } else {
            console.warn("No se obtuvo token FCM.");
        }

        return currentToken;

    } catch (error) {
        console.error("Error solicitando permiso/token FCM:", error);
        mostrarToast(
            "Error FCM",
            "Verifica el appId web en js/firebase-config.js y el Service Worker (firebase-messaging-sw.js)",
            "alerta",
            false
        );
        return null;
    }
}

/**
 * Devuelve el token FCM actual (si ya se obtuvo).
 */
export function obtenerToken() {
    return currentToken;
}
