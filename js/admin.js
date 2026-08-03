// js/admin.js
//
// Panel de Administración de Mensajes.
// Permite enviar notificaciones push a los dispositivos registrados
// mediante Firebase Cloud Messaging (FCM).
//
// Usa modales personalizados (no confirm() nativo) para una mejor UX.

import { inicializarFirebase } from "./notifications.js";
import { enviarMensajePush, escucharMensajesPush } from "./mensajes.js";
import { mostrarToast } from "./notifications.js";
import { iniciarSesion, cerrarSesion, observarSesion, traducirErrorAuth } from "./auth.js";

// ======================================================
// Referencias al DOM: login
// ======================================================
const loginContainer = document.getElementById("login-container");
const panelContainer = document.getElementById("panel-container");
const formLogin = document.getElementById("form-login");
const inputEmail = document.getElementById("login-email");
const inputPassword = document.getElementById("login-password");
const btnLogin = document.getElementById("btn-login");
const loginStatus = document.getElementById("login-status");
const btnLogout = document.getElementById("btn-logout");

// ======================================================
// Referencias al DOM: panel de mensajes
// ======================================================
const form = document.getElementById("form-mensaje");
const inputTitulo = document.getElementById("titulo");
const inputCuerpo = document.getElementById("cuerpo");
const charCounter = document.getElementById("char-counter");
const btnEnviar = document.getElementById("btn-enviar");
const btnCancelar = document.getElementById("btn-cancelar");
const statusBar = document.getElementById("status-bar");

// Modal de confirmación
const modalConfirm = document.getElementById("modal-confirm");
const modalTitulo = document.getElementById("modal-titulo");
const modalMensaje = document.getElementById("modal-mensaje");
const btnModalAceptar = document.getElementById("modal-btn-aceptar");
const btnModalCancelarModal = document.getElementById("modal-btn-cancelar");

// Callback del modal
let modalCallback = null;

// ======================================================
// Autenticación: mostrar panel solo si hay sesión iniciada
// ======================================================
let panelYaInicializado = false;

observarSesion((user) => {
    if (user) {
        // Sesión activa: mostrar panel, ocultar login
        loginContainer.style.display = "none";
        panelContainer.style.display = "";
        if (!panelYaInicializado) {
            panelYaInicializado = true;
            initFirebase();
        }
    } else {
        // Sin sesión: mostrar login, ocultar panel
        loginContainer.style.display = "";
        panelContainer.style.display = "none";
    }
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    if (!email || !password) return;

    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span> Ingresando...';
    loginStatus.textContent = "";
    loginStatus.className = "status-bar";

    try {
        await iniciarSesion(email, password);
        inputPassword.value = "";
        loginStatus.textContent = "";
    } catch (error) {
        console.error("Error de autenticación:", error);
        loginStatus.textContent = traducirErrorAuth(error.code);
        loginStatus.className = "status-bar error";
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = "🔓 Ingresar";
    }
});

btnLogout.addEventListener("click", async () => {
    try {
        await cerrarSesion();
        mostrarEstado("Sesión cerrada.", "");
    } catch (error) {
        console.error("Error cerrando sesión:", error);
    }
});

// ======================================================
// Inicializar Firebase al cargar la página
// ======================================================
async function initFirebase() {
    try {
        // Habilitar Firebase Messaging (permiso + Service Worker) de
        // forma silenciosa, igual que en la página principal.
        await inicializarFirebase();

        // También escuchar mensajes en tiempo real desde este mismo
        // panel (por si el propio admin tiene la app abierta también).
        escucharMensajesPush();

        mostrarEstado("Panel listo. Escribe tu mensaje y presiona Enviar.", "");
    } catch (error) {
        console.error("Error iniciando Firebase:", error);
        mostrarEstado("Panel listo. Escribe tu mensaje y presiona Enviar.", "");
    }
}

// ======================================================
// Modal de confirmación personalizado
// ======================================================
function mostrarModalConfirmacion(titulo, mensaje, callback) {
    modalTitulo.textContent = titulo;
    modalMensaje.textContent = mensaje;
    modalCallback = callback;
    modalConfirm.classList.add("modal-visible");
}

function cerrarModal() {
    modalConfirm.classList.remove("modal-visible");
    modalCallback = null;
}

btnModalAceptar.addEventListener("click", () => {
    const cb = modalCallback;
    cerrarModal();
    if (cb) cb(true);
});

btnModalCancelarModal.addEventListener("click", () => {
    cerrarModal();
});

// Cerrar modal al hacer clic en el overlay
modalConfirm.addEventListener("click", (e) => {
    if (e.target === modalConfirm) {
        cerrarModal();
    }
});

// Cerrar modal con tecla Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalConfirm.classList.contains("modal-visible")) {
        cerrarModal();
    }
});

// ======================================================
// Contador de caracteres del textarea
// ======================================================
inputCuerpo.addEventListener("input", () => {
    const len = inputCuerpo.value.length;
    const max = 500;
    charCounter.textContent = `${len} / ${max}`;

    charCounter.classList.remove("warn", "danger");
    if (len > max * 0.8) charCounter.classList.add("warn");
    if (len > max * 0.95) charCounter.classList.add("danger");
});

// ======================================================
// Botón Cancelar: limpia el formulario
// ======================================================
btnCancelar.addEventListener("click", () => {
    const tieneContenido = inputTitulo.value.trim() || inputCuerpo.value.trim();

    if (!tieneContenido) {
        // Si no hay contenido, simplemente limpiar y salir
        limpiarFormulario();
        mostrarEstado("Mensaje cancelado.", "");
        return;
    }

    // Confirmar antes de cancelar usando el modal personalizado
    mostrarModalConfirmacion(
        "¿Cancelar mensaje?",
        "Se borrará el contenido del formulario. ¿Deseas continuar?",
        (aceptar) => {
            if (aceptar) {
                limpiarFormulario();
                mostrarToast("🚫 Cancelado", "El mensaje ha sido borrado.", "info", false);
                mostrarEstado("Mensaje cancelado.", "");
            }
        }
    );
});

// ======================================================
// Botón Enviar (submit del formulario)
// ======================================================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titulo = inputTitulo.value.trim();
    const cuerpo = inputCuerpo.value.trim();

    // Validar campos
    if (!titulo) {
        mostrarToast("⚠️ Falta el título", "Escribe un título para el mensaje.", "alerta", true);
        inputTitulo.focus();
        return;
    }

    if (!cuerpo) {
        mostrarToast("⚠️ Falta el mensaje", "Escribe el contenido del mensaje.", "alerta", true);
        inputCuerpo.focus();
        return;
    }

    // Confirmar antes de enviar usando el modal personalizado
    mostrarModalConfirmacion(
        "Confirmar envío",
        `¿Enviar este mensaje?\n\n📋 ${titulo}\n💬 ${cuerpo}`,
        (aceptar) => {
            if (aceptar) {
                enviarMensaje(titulo, cuerpo);
            }
        }
    );
});

// ======================================================
// Enviar el mensaje push (REAL, a todos los navegadores conectados)
// ======================================================
async function enviarMensaje(titulo, cuerpo) {
    btnEnviar.disabled = true;
    btnCancelar.disabled = true;
    btnEnviar.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
        // Guardar mensaje en localStorage como respaldo/historial local
        guardarMensajeLocal({
            id: Date.now(),
            titulo,
            cuerpo,
            fecha: new Date().toISOString()
        });

        // Enviar a Firestore: todos los navegadores con la página
        // abierta (index.html o admin.html) que estén escuchando
        // recibirán este mensaje en tiempo real.
        await enviarMensajePush(titulo, cuerpo);

        mostrarToast("✅ Mensaje enviado", "El mensaje fue enviado a todos los navegadores conectados.", "exito", true);
        mostrarEstado("✓ Mensaje enviado correctamente.", "success");
        limpiarFormulario();

    } catch (error) {
        console.error("Error enviando mensaje:", error);
        mostrarToast("❌ Error", "No se pudo enviar el mensaje. Revisa la consola (F12).", "alerta", true);
        mostrarEstado("✗ Error al enviar el mensaje: " + error.message, "error");
    } finally {
        btnEnviar.disabled = false;
        btnCancelar.disabled = false;
        btnEnviar.innerHTML = "✅ Enviar";
    }
}

// ======================================================
// Guardar mensajes en localStorage
// ======================================================
function guardarMensajeLocal(mensaje) {
    try {
        const lista = JSON.parse(localStorage.getItem("antamina_mensajes") || "[]");
        lista.unshift(mensaje);
        if (lista.length > 50) lista.length = 50;
        localStorage.setItem("antamina_mensajes", JSON.stringify(lista));
    } catch (e) {
        console.warn("No se pudo guardar en localStorage:", e);
    }
}

// ======================================================
// Mostrar estado en la barra
// ======================================================
function mostrarEstado(texto, tipo) {
    statusBar.textContent = texto;
    statusBar.className = "status-bar" + (tipo ? " " + tipo : "");
}

// ======================================================
// Limpiar formulario
// ======================================================
function limpiarFormulario() {
    form.reset();
    charCounter.textContent = "0 / 500";
    charCounter.classList.remove("warn", "danger");
    inputTitulo.focus();
}

// ======================================================
// Iniciar: la inicialización de Firebase Messaging/Firestore
// ahora ocurre dentro de observarSesion(), una vez que el
// usuario haya iniciado sesión correctamente.
// ======================================================
