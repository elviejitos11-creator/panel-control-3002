// CQ2_LICENCIA_OBLIGATORIA_MOTOR_V1
(async () => {
  async function verificar() {
    let autorizada = false;

    try {
      const estado = await chrome.storage.local.get({
        loboActivo: false
      });

      if (estado.loboActivo === true) {
        const respuesta = await chrome.runtime.sendMessage({
          tipo: "CQ_VERIFICAR_PANEL3_1"
        });

        autorizada = respuesta?.autorizada === true;
      }
    } catch (error) {
      console.warn("CQ CONTROL: licencia no confirmada", error);
    }

    window.postMessage({
      tipo: "CQ2_LICENCIA_ESTADO_V1",
      autorizada
    }, window.location.origin);

    return autorizada;
  }

  const autorizada = await verificar();

  if (autorizada) {
    try {
      await chrome.runtime.sendMessage({
        tipo: "LOBO_CARGAR_MOTOR"
      });
    } catch (error) {
      console.error("Error cargando LOBO PRO:", error);
    }
  }

  setInterval(verificar, 5000);
})();