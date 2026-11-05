chrome.runtime.onMessage.addListener((mensaje, sender) => {
  if (mensaje?.tipo !== "LOBO_CARGAR_MOTOR") {
    return;
  }

  if (!sender.tab?.id || sender.frameId !== 0) {
    return;
  }

  const url = sender.url || "";

  if (!/^https?:\/\/([^.]+\.)?megapersonals\.eu\//i.test(url)) {
    return;
  }

  (async () => {
    const estado = await chrome.storage.local.get({
      loboActivo: false
    });

    if (!estado.loboActivo) return;

    // CQ2_LICENCIA_OBLIGATORIA_MOTOR_V1
    const datosLicencia = await chrome.storage.local.get([
      "cqNormal1Clave",
      "cqNormal1Dispositivo"
    ]);

    if (!datosLicencia.cqNormal1Clave ||
        !datosLicencia.cqNormal1Dispositivo) {
      console.warn("LOBO PRO: falta licencia");
      return;
    }

    const consulta = await fetch(
      "https://cqcontrollicencias-production.up.railway.app/api/licencias/verificar-instalacion",
      {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          clave: datosLicencia.cqNormal1Clave,
          dispositivo: datosLicencia.cqNormal1Dispositivo,
          producto: "PANENEL2_TELEGRAM_UN_POST"
        })
      }
    );

    if (!consulta.ok) return;

    const licencia = await consulta.json();

    if (licencia.autorizada !== true) {
      console.warn("LOBO PRO: licencia rechazada");
      return;
    }

    await chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id,
        frameIds: [0]
      },
      files: [
        "html2canvas.min.js",
        "engine.js"
      ],
      world: "MAIN",
      injectImmediately: true
    });
  })().catch(error => {
    console.error("LOBO PRO: error cargando motor", error);
  });
});

chrome.runtime.onMessage.addListener((mensaje,remitente,responder)=>{
 if(!mensaje||![
  "CQ_ACTIVAR_PANEL3_1",
  "CQ_VERIFICAR_PANEL3_1"
 ].includes(mensaje.tipo))return;

 (async()=>{
  try{
   const activar=mensaje.tipo==="CQ_ACTIVAR_PANEL3_1";
   const actual=await chrome.storage.local.get([
    "cqNormal1Clave","cqNormal1Dispositivo"
   ]);

   const clave=activar
    ?String(mensaje.clave||"").trim()
    :String(actual.cqNormal1Clave||"");

   let dispositivo=actual.cqNormal1Dispositivo;
   if(!dispositivo)dispositivo=crypto.randomUUID();

   if(!clave){
    responder({autorizada:false,motivo:"sin_activar"});
    return;
   }

   const ruta=activar
    ?"/api/licencias/activar-instalacion"
    :"/api/licencias/verificar-instalacion";

   const r=await fetch("https://cqcontrollicencias-production.up.railway.app"+ruta,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     clave,
     producto:"PANENEL2_TELEGRAM_UN_POST",
     dispositivo
    })
   });

   const datos=await r.json();

   if(!r.ok||datos.autorizada!==true){
    responder({
     autorizada:false,
     motivo:datos.motivo||"no_autorizada"
    });
    return;
   }

   if(activar){
    await chrome.storage.local.set({
     cqNormal1Clave:clave,
     cqNormal1Dispositivo:dispositivo,
     cqCliente:datos.cliente
    });
   }

   responder(datos);
  }catch(e){
   console.error("ERROR ACTIVACION PANEL3:",e); responder({autorizada:false,motivo:"servidor_no_disponible: "+String(e.message||e)});
  }
 })();

 return true;
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.tipo !== "CQ_INICIAR_MOTOR") return;

  (async () => {
    const estado = await chrome.storage.local.get({
      loboActivo: false
    });

    if (!estado.loboActivo) {
      console.warn("LOBO PRO: extension apagada");
      return;
    }

    const licencia = await chrome.runtime.sendMessage({
      tipo: "CQ_VERIFICAR_PANEL3_1"
    });

    if (licencia?.autorizada !== true) {
      console.warn(
        "LOBO PRO: licencia no autorizada",
        licencia?.motivo
      );
      return;
    }

    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const tab = tabs?.[0];

    if (!tab?.id ||
        !/^https?:\/\/([^.]+\.)?megapersonals\.eu\//i.test(tab.url || "")) {
      return;
    }

    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [0]
      },
      files: ["html2canvas.min.js", "engine.js"],
      world: "MAIN",
      injectImmediately: true
    });
  })().catch(error => {
    console.error("LOBO PRO: error de autorizacion", error);
  });
});