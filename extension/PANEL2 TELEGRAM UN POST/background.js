// CQ2_UN_POST_CONTROL_UNICO_LICENCIA_V1
// CQ CONTROL autoriza antes de cargar el motor.
// Ninguna ruta de arranque puede omitir esta verificacion.

const CQ2_URL = "https://cqcontrollicencias-production.up.railway.app";
const CQ2_PRODUCTO = "PANENEL2_TELEGRAM_UN_POST";
const cq2Inyectados = new Set();

async function cq2Consultar(ruta, clave, dispositivo) {
  const respuesta = await fetch(CQ2_URL + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clave,
      dispositivo,
      producto: CQ2_PRODUCTO
    })
  });

  const datos = await respuesta.json();

  return {
    autorizada: respuesta.ok && datos.autorizada === true,
    motivo: datos.motivo || null,
    cliente: datos.cliente,
    vence_en: datos.vence_en
  };
}

async function cq2Verificar() {
  try {
    const guardado = await chrome.storage.local.get([
      "cqNormal1Clave",
      "cqNormal1Dispositivo"
    ]);

    if (!guardado.cqNormal1Clave ||
        !guardado.cqNormal1Dispositivo) {
      return { autorizada: false, motivo: "sin_activar" };
    }

    return await cq2Consultar(
      "/api/licencias/verificar",
      guardado.cqNormal1Clave,
      guardado.cqNormal1Dispositivo
    );
  } catch (error) {
    return {
      autorizada: false,
      motivo: "servidor_no_disponible"
    };
  }
}

async function cq2Activar(clave) {
  try {
    clave = String(clave || "").trim();

    if (!clave) {
      return { autorizada: false, motivo: "clave_vacia" };
    }

    const anterior = await chrome.storage.local.get([
      "cqNormal1Dispositivo"
    ]);

    const dispositivo =
      anterior.cqNormal1Dispositivo || crypto.randomUUID();

    const resultado = await cq2Consultar(
      "/api/licencias/activar-instalacion",
      clave,
      dispositivo
    );

    if (!resultado.autorizada) return resultado;

    await chrome.storage.local.set({
      cqNormal1Clave: clave,
      cqNormal1Dispositivo: dispositivo,
      cqCliente: resultado.cliente || null
    });

    return resultado;
  } catch (error) {
    return {
      autorizada: false,
      motivo: "servidor_no_disponible"
    };
  }
}

function cq2UrlPermitida(url) {
  return /^https:\/\/(?:[a-z0-9-]+\.)*megapersonals\.eu\//i
    .test(String(url || ""));
}

async function cq2CargarMotor(tabId, url) {
  if (!tabId || !cq2UrlPermitida(url)) {
    return { ok: false, motivo: "sitio_no_permitido" };
  }

  const estado = await chrome.storage.local.get({
    loboActivo: false
  });

  if (estado.loboActivo !== true) {
    return { ok: false, motivo: "extension_desconectada" };
  }

  // Verificacion obligatoria directamente con CQ CONTROL.
  const licencia = await cq2Verificar();

  if (!licencia.autorizada) {
    return {
      ok: false,
      autorizada: false,
      motivo: licencia.motivo
    };
  }

  if (cq2Inyectados.has(tabId)) {
    return { ok: true, autorizada: true };
  }

  cq2Inyectados.add(tabId);

  try {
    await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0]
      },
      files: ["html2canvas.min.js", "engine.js"],
      world: "MAIN",
      injectImmediately: true
    });

    return { ok: true, autorizada: true };
  } catch (error) {
    cq2Inyectados.delete(tabId);
    return { ok: false, motivo: "error_cargando_motor" };
  }
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    cq2Inyectados.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  cq2Inyectados.delete(tabId);
});

chrome.runtime.onMessage.addListener((mensaje, sender, responder) => {
  if (!mensaje || ![
    "CQ_ACTIVAR_PANEL3_1",
    "CQ_VERIFICAR_PANEL3_1",
    "LOBO_CARGAR_MOTOR",
    "CQ_INICIAR_MOTOR"
  ].includes(mensaje.tipo)) {
    return;
  }

  (async () => {
    if (mensaje.tipo === "CQ_ACTIVAR_PANEL3_1") {
      return await cq2Activar(mensaje.clave);
    }

    if (mensaje.tipo === "CQ_VERIFICAR_PANEL3_1") {
      return await cq2Verificar();
    }

    if (mensaje.tipo === "LOBO_CARGAR_MOTOR") {
      if (!sender.tab?.id || sender.frameId !== 0) {
        return { ok: false, motivo: "origen_invalido" };
      }

      return await cq2CargarMotor(
        sender.tab.id,
        sender.url || sender.tab.url
      );
    }

    if (mensaje.tipo === "CQ_INICIAR_MOTOR") {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      const tab = tabs[0];

      return await cq2CargarMotor(tab?.id, tab?.url);
    }
  })()
    .then(resultado => responder(resultado || { ok: false }))
    .catch(error => {
      console.error("CQ CONTROL: fallo de autorizacion", error);
      responder({ ok: false, autorizada: false });
    });

  return true;
});