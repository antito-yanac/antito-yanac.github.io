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
 * Registra el Service Worker (firebase-messaging-sw.js) en la raíz del sitio.
 * Es OBLIGATORIO para que FCM pueda entregar notificaciones push y obtener
 * el token del dispositivo. Sin esto, getToken() falla y muestra el error rojo.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function registrarServiceWorker() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.warn("Este navegador no soporta Service Workers.");
            return null;
        }

        // El Service Worker debe estar en la raíz del sitio.
        // scope "./" le da alcance sobre todo el dominio.
        const registration = await navigator.serviceWorker.register(
            "./firebase-messaging-sw.js",
            { scope: "./" }
        );

        console.log("Service Worker registrado:", registration.scope);
        return registration;
    } catch (error) {
        console.error("Error registrando Service Worker:", error);
        return null;
    }
}

/**
 * Inicializa Firebase y configura FCM.
 * Registra el Service Worker, solicita permiso de notificaciones
 * y obtiene el token del dispositivo.
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

        // PASO 1: Registrar el Service Worker ANTES de solicitar el token.
        // Sin Service Worker, getToken() falla con el error rojo.
        const swRegistration = await registrarServiceWorker();

        if (!swRegistration) {
            mostrarToast(
                "Service Worker",
                "No se pudo registrar firebase-messaging-sw.js. Verifica que esté en la raíz del sitio.",
                "alerta",
                false
            );
            return null;
        }

        // PASO 2: Solicitar permiso y obtener token pasando el SW registration.
        const token = await solicitarPermisoYToken(swRegistration);
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
 * @param {ServiceWorkerRegistration} swRegistration - registro del SW
 */
async function solicitarPermisoYToken(swRegistration) {
    try {
        // Verificar soporte del navegador
        if (!("Notification" in window)) {
            console.warn("Este navegador no soporta notificaciones.");
            return null;
        }

        // Si el permiso ya fue denegado previamente, no se puede volver a pedir.
        // Mostrar instrucciones claras de cómo reactivarlo.
        if (Notification.permission === "denied") {
            console.info("Permiso de notificaciones bloqueado por el usuario.");
            mostrarToast(
                "Notificaciones bloqueadas",
                "Activar: clic en el ícono 🔒 de la barra de direcciones → Permitir notificaciones.",
                "alerta",
                false
            );
            return null;
        }

        // Solicitar permiso (solo si está en "default")
        if (Notification.permission === "default") {
            const permiso = await Notification.requestPermission();

            if (permiso !== "granted") {
                console.info("Permiso de notificaciones no concedido:", permiso);
                mostrarToast(
                    "Notificaciones",
                    "Permiso no concedido. Actívalo desde el ícono 🔒 de la barra de direcciones.",
                    "info",
                    false
                );
                return null;
            }
        }

        // Obtener token FCM pasando el Service Worker registration.
        // Esto es CRÍTICO: sin serviceWorkerRegistration, getToken() falla.
        currentToken = await getToken(messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: swRegistration
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
            mostrarToast(
                "FCM",
                "No se generó token. Revisa la configuración en Firebase Console.",
                "info",
                false
            );
        }

        return currentToken;

    } catch (error) {
        console.error("Error solicitando permiso/token FCM:", error);

        // Mensaje de error más específico según el tipo de error
        let mensaje = "Error desconocido.";

        if (error && error.code) {
            switch (error.code) {
                case "messaging/permission-blocked":
                    mensaje = "Notificaciones bloqueadas. Actívalas desde el ícono 🔒 de la barra de direcciones.";
                    break;
                case "messaging/unsupported-browser":
                    mensaje = "Este navegador no soporta FCM. Usa Chrome, Firefox o Edge.";
                    break;
                case "messaging/notifications-blocked":
                    mensaje = "Notificaciones bloqueadas por el navegador. Revisa los permisos del sitio.";
                    break;
                case "messaging/failed-service-worker-registration":
                    mensaje = "No se registró el Service Worker. Verifica firebase-messaging-sw.js en la raíz del sitio.";
                    break;
                default:
                    mensaje = Error FCM: ${error.code}. Revisa la consola (F12).;
            }
        } else if (error && error.message) {
            mensaje = Error: ${error.message};
        }

        mostrarToast("Error FCM", mensaje, "alerta", false);
        return null;
    }
}

/**
 * Devuelve el token FCM actual (si ya se obtuvo).
 */
export function obtenerToken() {
    return currentToken;
}
