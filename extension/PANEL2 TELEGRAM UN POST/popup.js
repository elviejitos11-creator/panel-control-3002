'use strict';

const estado = document.getElementById("status");
const conectar = document.getElementById("conectar");
const desconectar = document.getElementById("desconectar");

function actualizar(activo, mensaje) {
  estado.textContent = mensaje || (activo ? "CONECTADO" : "DESCONECTADO");
  estado.style.color = activo ? "#4ade80" : "#fb7185";
  conectar.disabled = activo;
  desconectar.disabled = !activo;
}

function verificarLicencia() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { tipo: "CQ_VERIFICAR_PANEL3_1" },
      (respuesta) => {
        if (chrome.runtime.lastError) {
          resolve({
            autorizada: false,
            motivo: chrome.runtime.lastError.message
          });
          return;
        }
        resolve(respuesta || {
          autorizada: false,
          motivo: "Sin respuesta del servidor de licencias"
        });
      }
    );
  });
}

function guardarActivo(valor) {
  return chrome.storage.local.set({ loboActivo: valor });
}

async function abrirActivacion() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("cq-activar.html")
  });
}

async function iniciar() {
  conectar.disabled = true;

  try {
    const guardado = await chrome.storage.local.get({
      loboActivo: false
    });

    if (!guardado.loboActivo) {
      actualizar(false);
      return;
    }

    const licencia = await verificarLicencia();

    if (licencia.autorizada !== true) {
      await guardarActivo(false);
      actualizar(false, "LICENCIA REQUERIDA");
      return;
    }

    actualizar(true);
  } catch (error) {
    await guardarActivo(false);
    actualizar(false, "SIN AUTORIZACION");
    console.error("LOBO PRO:", error);
  }
}

conectar.addEventListener("click", async () => {
  conectar.disabled = true;
  estado.textContent = "VERIFICANDO LICENCIA...";

  try {
    const licencia = await verificarLicencia();

    if (licencia.autorizada !== true) {
      await guardarActivo(false);
      actualizar(false, "LICENCIA REQUERIDA");
      await abrirActivacion();
      return;
    }

    await guardarActivo(true);
    actualizar(true);

    chrome.runtime.sendMessage(
      { tipo: "CQ_INICIAR_MOTOR" },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
        }
      }
    );
  } catch (error) {
    await guardarActivo(false);
    actualizar(false, "ERROR DE AUTORIZACION");
    console.error("LOBO PRO:", error);
  }
});

desconectar.addEventListener("click", async () => {
  try {
    await guardarActivo(false);
    actualizar(false);
  } catch (error) {
    console.error("LOBO PRO:", error);
    actualizar(false, "ERROR AL DESCONECTAR");
  }
});

iniciar();