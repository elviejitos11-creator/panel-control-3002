
/*
 * LOBO PRO - 1 POST - PANEL 2
 * Version 6.9.2 - Dolphin Anty
 *
 * ID independiente para Panel 2.
 * Cambio de ID y clave desde el lobito.
 * ON/OFF confirmado por Railway.
 * Motor original de 16 minutos.
 * Requiere html2canvas.min.js.
 */

(function () {
  'use strict';

  if (window.__CQ_LOBO_PANEL2_692) return;
  window.__CQ_LOBO_PANEL2_692 = true;

  const PANEL_LOCAL = 'http://localhost:3002';
  const PANEL_NUBE =
    'https://panel-control-3002-production.up.railway.app';

  const KEY_PERFIL_GLOBAL =
    'CQ_PANEL2_LOBO_PERFIL_ID_V692';

  const CICLO_MINUTOS = 16;
  const DELAY_CONFIRMACION = 15;
  const DELAY_SEGUNDO_TOQUE = 10;

  const MAX_FALLOS_BOTON = 60;
  const MAX_ESPERA_SWEET_MS = 120000;
  const MAX_FALLOS_FASE2 = 45;
  const ALERTA_COOLDOWN_MS = 10 * 60 * 1000;

  let cq2IdNuevo = false;
  function obtenerPerfilId() {
    let id = localStorage.getItem(KEY_PERFIL_GLOBAL);

    if (!id || !String(id).trim()) {
      id = prompt(
        'PANEL 2 - Escribe el ID exacto del perfil:'
      );

      if (!id || !String(id).trim()) {
        alert('Falta el ID. El lobito no iniciará.');
        return '';
      }

      id = String(id).trim();
      localStorage.setItem(KEY_PERFIL_GLOBAL, id);
      cq2IdNuevo = true;
    }

    return String(id).trim();
  }

  const PERFIL_ID = obtenerPerfilId();
  if (!PERFIL_ID) return;

  const KEY_TOKEN_GLOBAL =
     `cq2_token_reconexion_v4_${PERFIL_ID}`;

  function obtenerClienteToken() {
    let token = localStorage.getItem(KEY_TOKEN_GLOBAL);

    if (cq2IdNuevo || !token || !String(token).trim()) {
      token = prompt(
        `PANEL 2 - Escribe la clave de conexión del perfil ${PERFIL_ID}:`
      );

      if (cq2IdNuevo || !token || !String(token).trim()) {
        alert('Falta la clave de conexión.');
        return '';
      }

      token = String(token).trim();
      localStorage.setItem(KEY_TOKEN_GLOBAL, token);
    }

    return String(token).trim();
  }

  let CLIENTE_TOKEN = obtenerClienteToken();
  if (!CLIENTE_TOKEN) return;

  const KEY_ESTADO = `cq2_estado_${PERFIL_ID}`;
  const KEY_FASE = `cq2_fase_${PERFIL_ID}`;
  const KEY_NEXT = `cq2_next_${PERFIL_ID}`;
  const KEY_DATOS = `cq2_datos_mega_${PERFIL_ID}`;
  const KEY_ULTIMO_REPORTE =
    `cq2_ultimo_reporte_${PERFIL_ID}`;
  const KEY_ALERTA_BLOQUEADA =
    `cq2_alerta_bloqueada_${PERFIL_ID}`;
  const KEY_ULTIMA_ALERTA_TS =
    `cq2_ultima_alerta_${PERFIL_ID}`;
  const KEY_FALLOS_BOTON =
    `cq2_fallos_boton_${PERFIL_ID}`;
  const KEY_FASE1_INICIO =
    `cq2_fase1_inicio_${PERFIL_ID}`;
  const KEY_FASE2_FALLOS =
    `cq2_fase2_fallos_${PERFIL_ID}`;

  let estadoLocal =
    localStorage.getItem(KEY_ESTADO) || 'PAUSADA';

  let lockoutReporte = false;
  let lockoutDatos = false;
  let avisoTokenInvalido = false;
  let lockoutAlerta = false;
  let motorOcupado = false;

  let fase = parseInt(localStorage.getItem(KEY_FASE), 10);
  let nextTime = parseInt(localStorage.getItem(KEY_NEXT), 10);

  if (Number.isNaN(fase)) fase = 0;

  if (!nextTime || Number.isNaN(nextTime)) {
    nextTime = Date.now() + CICLO_MINUTOS * 60000;
    guardarMemoria(fase, nextTime);
  }

  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function guardarEstado(estado) {
    if (!['ACTIVA', 'PAUSADA'].includes(estado)) return;
    estadoLocal = estado;
    localStorage.setItem(KEY_ESTADO, estado);
  }

  function guardarMemoria(f, t) {
    fase = f;
    nextTime = t;
    localStorage.setItem(KEY_FASE, String(f));
    localStorage.setItem(KEY_NEXT, String(t));
  }

  function limpiarContadoresGuardia() {
    localStorage.removeItem(KEY_FALLOS_BOTON);
    localStorage.removeItem(KEY_FASE1_INICIO);
    localStorage.removeItem(KEY_FASE2_FALLOS);
  }

  function limpiarBloqueoAlertaLocal() {
    localStorage.removeItem(KEY_ALERTA_BLOQUEADA);
    localStorage.removeItem(KEY_ULTIMA_ALERTA_TS);
    limpiarContadoresGuardia();
  }

  function limpiarMemoriaAcceso() {
    localStorage.removeItem(KEY_PERFIL_GLOBAL);
    localStorage.removeItem(KEY_TOKEN_GLOBAL);
    localStorage.removeItem(KEY_ESTADO);
    localStorage.removeItem(KEY_FASE);
    localStorage.removeItem(KEY_NEXT);
    localStorage.removeItem(KEY_DATOS);
    localStorage.removeItem(KEY_ULTIMO_REPORTE);
    limpiarBloqueoAlertaLocal();
  }

  function cambiarConfiguracion() {
    const confirmar = confirm(
      '¿Quieres cambiar el ID y la clave del lobito del Panel 2?\n\n' +
      'No se eliminará ningún perfil del servidor.'
    );

    if (!confirmar) return;

    limpiarMemoriaAcceso();
    window.location.reload();
  }

  function bloquearPorClave(motivo) {
    if (avisoTokenInvalido) return;

    avisoTokenInvalido = true;
    guardarEstado('PAUSADA');

    alert(
      `${motivo || 'Acceso no autorizado'}.\n\n` +
      'Verifica el ID y la clave del Panel 2.\n' +
      'Puedes cambiarlos haciendo clic derecho en el lobito.'
    );
  }

  async function fetchJSONBase(base, ruta, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      6000
    );

    try {
      const res = await fetch(`${base}${ruta}`, {
        ...options,
        headers: { ...(options.headers || {}), 'X-Cliente-Token': CLIENTE_TOKEN },
        cache: 'no-store',
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function consultarFuente(base, id) {
    const resultado = {
      base,
      estadoPanel: '',
      estadoLicencia: '',
      licenciaOk: false,
      motivoLicencia: ''
    };

    try {
      const d = await fetchJSONBase(
        base,
        `/api/estado/${encodeURIComponent(id)}?t=${Date.now()}`
      );

      resultado.estadoPanel =
        String(d?.estado || '').toUpperCase();
    } catch (e) {
      console.log(
        'Estado no disponible:',
        base,
        e.message
      );
    }

    try {
      const tokenSeguro = encodeURIComponent(CLIENTE_TOKEN);

      const d = await fetchJSONBase(
        base,
        `/api/licencia/${encodeURIComponent(id)}` +
        `?token=${tokenSeguro}&t=${Date.now()}`
      );

      resultado.estadoLicencia =
        String(d?.estado || '').toUpperCase();

      resultado.licenciaOk = d?.ok === true;
      resultado.motivoLicencia =
        String(d?.motivo || '');
    } catch (e) {
      console.log(
        'Licencia no disponible:',
        base,
        e.message
      );
    }

    return resultado;
  }

  function limpiarTexto(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function sacarLinea(texto, etiqueta) {
    const regex = new RegExp(
      `${etiqueta}\\s*:\\s*([^\\n\\r]+)`,
      'i'
    );

    const match = texto.match(regex);
    return match ? limpiarTexto(match[1]) : '';
  }

  function normalizarUrlImagen(src) {
    try {
      if (!src || src.startsWith('data:')) return '';
      return new URL(src, window.location.href).href;
    } catch {
      return '';
    }
  }

  function detectarFotosMega() {
    const fotos = [];

    for (const img of document.querySelectorAll('img')) {
      const src = normalizarUrlImagen(
        img.currentSrc ||
        img.getAttribute('data-original') ||
        ''
      );

      if (!src) continue;

      const rect = img.getBoundingClientRect();
      const ancho = rect.width || img.naturalWidth || 0;
      const alto = rect.height || img.naturalHeight || 0;

      if (ancho < 250 || alto < 250) continue;

      const proporcion = ancho / alto;

      if (proporcion > 1.7 || proporcion < 0.5) {
        continue;
      }

      const area = ancho * alto;
      if (area < 90000) continue;

      fotos.push({
        src,
        y: rect.top + window.scrollY,
        area
      });
    }

    fotos.sort((a, b) =>
      a.y !== b.y ? b.y - a.y : b.area - a.area
    );

    return [...new Set(fotos.map(f => f.src))]
      .slice(0, 10);
  }

  function leerDatosMega() {
    const textoPagina = document.body?.innerText || '';

    const telefono = sacarLinea(textoPagina, 'Phone');
    const city = sacarLinea(textoPagina, 'City');
    const location = sacarLinea(textoPagina, 'Location');
    const fotos = detectarFotosMega();

    let textoPost = '';

    const lineas = textoPagina
      .split('\n')
      .map(limpiarTexto)
      .filter(Boolean);

    const idxLocation = lineas.findIndex(
      l => /^Location\s*:/i.test(l)
    );

    if (idxLocation >= 0) {
      textoPost = lineas
        .slice(idxLocation + 1, idxLocation + 10)
        .filter(l =>
          !/^Age\s*:/i.test(l) &&
          !/^Tokens/i.test(l) &&
          !/^CURRENT POST/i.test(l)
        )
        .join(' ')
        .slice(0, 1000);
    }

    return {
      telefono,
      ubicacion: limpiarTexto(
        [city, location].filter(Boolean).join(' - ')
      ),
      texto: limpiarTexto(textoPost),
      foto_pagina: fotos[0] || '',
      fotos_pagina: fotos
    };
  }

  async function registrarEventoEnPanel(payload) {
    const cuerpo = {
      ...payload,
      token: CLIENTE_TOKEN
    };

    const opciones = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cliente-Token': CLIENTE_TOKEN
      },
      body: JSON.stringify(cuerpo),
      cache: 'no-store'
    };

    for (const [base, nombre] of [
      [PANEL_LOCAL, 'local'],
      [PANEL_NUBE, 'nube']
    ]) {
      try {
        const res = await fetch(
          `${base}/registrar-evento`,
          opciones
        );

        if (res.status === 403) {
          console.warn(
            `Evento rechazado en ${nombre}: HTTP 403`
          );
        }
      } catch (e) {
        console.log(
          `No se pudo registrar evento en ${nombre}:`,
          e.message
        );
      }
    }
  }

  async function registrarAlertaEnPanel(payload) {
    const cuerpo = {
      ...payload,
      token: CLIENTE_TOKEN
    };

    let enviado = false;

    for (const [base, nombre] of [
      [PANEL_LOCAL, 'local'],
      [PANEL_NUBE, 'nube']
    ]) {
      try {
        const res = await fetch(
          `${base}/registrar-alerta`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Cliente-Token': CLIENTE_TOKEN
            },
            body: JSON.stringify(cuerpo),
            cache: 'no-store'
          }
        );

        if (res.ok) enviado = true;
      } catch (e) {
        console.log(
          `No se pudo enviar alerta a ${nombre}:`,
          e.message
        );
      }
    }

    return enviado;
  }

  async function sincronizarDatosMega() {
    if (lockoutDatos || !document.body) return;
    if (detectarExito()) return;

    const datos = leerDatosMega();

    if (
      !datos.telefono &&
      !datos.ubicacion &&
      !datos.texto &&
      !datos.foto_pagina &&
      (!datos.fotos_pagina ||
       datos.fotos_pagina.length === 0)
    ) {
      return;
    }

    const firma = JSON.stringify(datos);
    const anterior = localStorage.getItem(KEY_DATOS);

    if (firma === anterior) return;

    lockoutDatos = true;

    localStorage.setItem(KEY_DATOS, firma);

    await registrarEventoEnPanel({
      id: PERFIL_ID,
      tipo: 'silencioso',
      telefono: datos.telefono,
      ubicacion: datos.ubicacion,
      texto: datos.texto,
      foto_pagina: datos.foto_pagina,
      foto_modelo: datos.foto_pagina,
      fotos_pagina: datos.fotos_pagina,
      ultima_accion:
        'Datos y fotos actualizados desde Mega',
      ultima_hora: new Date().toLocaleString()
    });

    setTimeout(() => {
      lockoutDatos = false;
    }, 30000);
  }

  async function consultarEstadoPerfil(id) {
    try {
      const fuente = await consultarFuente(PANEL_NUBE, id);

      if (fuente.estadoLicencia === 'TOKEN_INVALIDO') {
        bloquearPorClave('Clave de perfil inválida');
        return 'PAUSADA';
      }

      if (
        fuente.estadoLicencia === 'NO_EXISTE' ||
        fuente.estadoPanel === 'NO_EXISTE'
      ) {
        bloquearPorClave(
          'El ID del perfil no existe en la API consultada'
        );
        return 'PAUSADA';
      }

      if (
        fuente.estadoPanel === 'PAUSADA' ||
        fuente.estadoLicencia === 'PAUSADA' ||
        fuente.estadoLicencia === 'VENCIDA'
      ) {
        guardarEstado('PAUSADA');
        return 'PAUSADA';
      }

      if (
        fuente.estadoPanel === 'ACTIVA' &&
        fuente.licenciaOk === true &&
        fuente.estadoLicencia === 'ACTIVA'
      ) {
        guardarEstado('ACTIVA');
        return 'ACTIVA';
      }

      return estadoLocal;
    } catch (e) {
      console.log(
        'No se pudo consultar el panel:',
        e.message
      );
      return estadoLocal;
    }
  }

  async function cambiarEstadoEnPanel(id, accion, reintento = false) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      10000
    );

    try {
      const respuesta = await fetch(
        `${PANEL_NUBE}/accion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cliente-Token': CLIENTE_TOKEN
          },
          body: JSON.stringify({
            id,
            accion,
            token: CLIENTE_TOKEN
          }),
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (
        respuesta.redirected ||
        new URL(respuesta.url).pathname === '/login'
      ) {
        throw new Error(
          'El servidor redirigió la orden al login'
        );
      }

      if (!respuesta.ok) {
        if (respuesta.status === 403 && !reintento) {
          localStorage.removeItem(KEY_TOKEN_GLOBAL);

          const nuevaClave = prompt(
            `PANEL 2 - Clave rechazada para el perfil ${id}.\n` +
            'Introduce la clave de conexion correcta:'
          );

          if (nuevaClave && nuevaClave.trim()) {
            CLIENTE_TOKEN = nuevaClave.trim();
            localStorage.setItem(KEY_TOKEN_GLOBAL, CLIENTE_TOKEN);

            return await cambiarEstadoEnPanel(id, accion, true);
          }
        }
        let detalle = '';

        try {
          const d = await respuesta.json();
          detalle = String(
            d.estado || d.error || ''
          );
        } catch {}

        if (respuesta.status === 404) {
          throw new Error(
            `HTTP 404: El ID ${id} no se encontró ` +
            'en el almacenamiento de esta ruta. ' +
            'Haz clic derecho en el lobito para cambiarlo.'
          );
        }

        throw new Error(
          `HTTP ${respuesta.status}` +
          (detalle ? ` - ${detalle}` : '')
        );
      }

      const resultado = await respuesta.json();

      const esperado =
        accion === 'pausar' ? 'PAUSADA' : 'ACTIVA';

      if (
        resultado.ok !== true ||
        String(resultado.estado || '').toUpperCase()
          !== esperado
      ) {
        throw new Error(
          'Railway no confirmó el cambio de estado'
        );
      }

      return esperado;
    } finally {
      clearTimeout(timer);
    }
  }

  function renderBoton() {
    const idUI = `cq2-motor-panel-${PERFIL_ID}`;

    const faltan = Math.max(
      0,
      Math.round((nextTime - Date.now()) / 1000)
    );

    const m = Math.floor(faltan / 60);
    const s = faltan % 60;

    let box = document.getElementById(idUI);

    if (!box) {
      box = document.createElement('div');
      box.id = idUI;

      box.style = `
        position:fixed;
        bottom:70px;
        right:15px;
        width:140px;
        height:44px;
        border-radius:22px;
        border:1px solid #777;
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:space-around;
        cursor:pointer;
        font-family:monospace;
        font-weight:bold;
        background:rgba(0,0,0,0.92);
        box-shadow:0 2px 10px rgba(0,0,0,.35);
      `;

      box.innerHTML = `
        <span style="
          font-size:28px;
          line-height:1;
          transform:translateY(1px);
        ">🐺</span>

        <div id="cq2-led-${PERFIL_ID}" style="
          width:12px;
          height:12px;
          border-radius:50%;
        "></div>

        <span id="cq2-time-${PERFIL_ID}" style="
          color:#fff;
          font-size:16px;
          min-width:48px;
          text-align:center;
        ">OFF</span>
      `;

      // CLIC DERECHO: cambiar ID y clave.
      box.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        cambiarConfiguracion();
      });

      // CLIC NORMAL: activar o pausar.
      box.onpointerdown = async e => {
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        if (box.dataset.enviando === '1') return;

        box.dataset.enviando = '1';

        try {
          const accion = estadoLocal === 'ACTIVA'
            ? 'pausar'
            : 'reanudar';

          const nuevoEstado = await cambiarEstadoEnPanel(
            PERFIL_ID,
            accion
          );

          if (nuevoEstado === 'ACTIVA') {
            limpiarBloqueoAlertaLocal();
          }

          guardarEstado(nuevoEstado);
          renderBoton();

          console.log(
            'PANEL 2 ON/OFF CONFIRMADO:',
            nuevoEstado
          );
        } catch (error) {
          console.error(
            'PANEL 2 ERROR ON/OFF:',
            error
          );

          alert(
            'No se pudo cambiar el estado:\n' +
            error.message
          );
        } finally {
          box.dataset.enviando = '0';
        }
      };

      document.body.appendChild(box);
    }

    const led = document.getElementById(
      `cq2-led-${PERFIL_ID}`
    );

    const time = document.getElementById(
      `cq2-time-${PERFIL_ID}`
    );

    if (!led || !time) return;

    const activa = estadoLocal === 'ACTIVA';

    const alertaBloqueada =
      localStorage.getItem(KEY_ALERTA_BLOQUEADA) === '1';

    led.style.background = alertaBloqueada
      ? '#ff0'
      : activa ? '#0f0' : '#f00';

    led.style.boxShadow = alertaBloqueada
      ? '0 0 8px #ff0'
      : activa ? '0 0 8px #0f0' : '0 0 8px #f00';

    time.textContent = alertaBloqueada
      ? 'ALRT'
      : activa
        ? `${m}:${s < 10 ? '0' : ''}${s}`
        : 'OFF';
  }

  function detectarExito() {
    const txt = (
      document.body?.innerText || ''
    ).toLowerCase();

    const url = window.location.href.toLowerCase();

    return (
      url.includes('success_publish') ||
      txt.includes('sweet!') ||
      txt.includes('your post has been published')
    );
  }

  async function capturarPantallaCompleta() {
    try {
      if (!document.body) return '';

      await esperar(800);

      if (typeof window.html2canvas !== 'function') {
        console.log('html2canvas no disponible');
        return '';
      }

      const html = document.documentElement;
      const body = document.body;

      const ancho = Math.max(
        html.scrollWidth || 0,
        body.scrollWidth || 0,
        html.clientWidth || 0,
        window.innerWidth || 0
      );

      const alto = Math.max(
        html.scrollHeight || 0,
        body.scrollHeight || 0,
        html.clientHeight || 0,
        window.innerHeight || 0
      );

      const canvas = await window.html2canvas(html, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: 1,
        width: ancho,
        height: alto,
        windowWidth: ancho,
        windowHeight: alto,
        scrollX: 0,
        scrollY: 0
      });

      return canvas.toDataURL('image/jpeg', 0.78);
    } catch (e) {
      console.log('No se pudo capturar pantalla:', e);
      return '';
    }
  }

  async function capturarPruebaBumpCompleta() {
    if (!detectarExito() || !document.body) return '';
    return capturarPantallaCompleta();
  }

  function paginaTextoLower() {
    return String(
      document.body?.innerText || ''
    ).toLowerCase();
  }

  function hayInputPasswordVisible() {
    try {
      return Array.from(
        document.querySelectorAll('input[type="password"]')
      ).some(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    } catch {
      return false;
    }
  }

  function detectarProblemaPagina() {
    if (!document.body || detectarExito()) return null;

    const txt = paginaTextoLower();
    const url = window.location.href.toLowerCase();

    const reglas = [
      {
        tipo: 'CAPTCHA',
        motivo: 'La página solicita CAPTCHA.',
        patrones: [
          'captcha',
          'robot',
          'not a robot',
          'verify you are human',
          'human verification',
          'cloudflare'
        ]
      },
      {
        tipo: 'VERIFICACION',
        motivo: 'La cuenta solicita verificación.',
        patrones: [
          'verification required',
          'verify your account',
          'verify account',
          'phone verification',
          'email verification',
          'verification code',
          'enter code',
          'confirm your account'
        ]
      },
      {
        tipo: 'BLOQUEO',
        motivo: 'La cuenta parece bloqueada.',
        patrones: [
          'account locked',
          'account suspended',
          'account disabled',
          'your account has been blocked',
          'account blocked',
          'suspended',
          'disabled',
          'banned'
        ]
      },
      {
        tipo: 'LOGIN',
        motivo: 'La página solicita iniciar sesión.',
        patrones: [
          'login',
          'log in',
          'sign in',
          'password',
          'session expired',
          'please login',
          'please log in'
        ]
      },
      {
        tipo: 'ERROR_PUBLICACION',
        motivo: 'La página muestra error de publicación.',
        patrones: [
          'error publishing',
          'unable to publish',
          'post was not published',
          'try again later',
          'too many attempts',
          'something went wrong',
          'temporarily unavailable'
        ]
      },
      {
        tipo: 'POST_REMOVIDO',
        motivo: 'La publicación parece removida.',
        patrones: [
          'post removed',
          'ad removed',
          'post rejected',
          'ad rejected',
          'not approved',
          'removed for'
        ]
      }
    ];

    if (
      hayInputPasswordVisible() &&
      (
        url.includes('login') ||
        txt.includes('password') ||
        txt.includes('sign in') ||
        txt.includes('log in')
      )
    ) {
      return {
        tipo: 'LOGIN',
        motivo: 'Campo de contraseña visible.',
        detalle: url
      };
    }

    for (const regla of reglas) {
      const encontrado = regla.patrones.find(p =>
        txt.includes(p) ||
        url.includes(p.replace(/\s+/g, '-'))
      );

      if (encontrado) {
        return {
          tipo: regla.tipo,
          motivo: regla.motivo,
          detalle: `Patrón detectado: ${encontrado}`
        };
      }
    }

    return null;
  }

  async function dispararAlerta(tipo, motivo, detalle = '') {
    if (lockoutAlerta) return true;

    if (
      localStorage.getItem(KEY_ALERTA_BLOQUEADA) === '1'
    ) {
      return true;
    }

    const ultima = Number(
      localStorage.getItem(KEY_ULTIMA_ALERTA_TS) || 0
    );

    if (Date.now() - ultima < ALERTA_COOLDOWN_MS) {
      return true;
    }

    lockoutAlerta = true;

    localStorage.setItem(KEY_ALERTA_BLOQUEADA, '1');
    localStorage.setItem(
      KEY_ULTIMA_ALERTA_TS,
      String(Date.now())
    );

    guardarEstado('PAUSADA');

    guardarMemoria(
      0,
      Date.now() + CICLO_MINUTOS * 60000
    );

    limpiarContadoresGuardia();
    renderBoton();

    const foto = await capturarPantallaCompleta();

    await registrarAlertaEnPanel({
      id: PERFIL_ID,
      tipo,
      motivo,
      detalle,
      foto_alerta: foto,
      ultima_hora: new Date().toLocaleString()
    });

    lockoutAlerta = false;
    return true;
  }

  async function evaluarModoGuardia() {
    if (!document.body) return false;

    if (
      localStorage.getItem(KEY_ALERTA_BLOQUEADA) === '1'
    ) {
      guardarEstado('PAUSADA');
      renderBoton();
      return true;
    }

    const problema = detectarProblemaPagina();

    if (problema) {
      await dispararAlerta(
        problema.tipo,
        problema.motivo,
        problema.detalle || ''
      );
      return true;
    }

    return false;
  }

  function ejecutarPasoPrincipal() {
    const btn = document.querySelector(
      '#managePublishAd'
    );

    if (btn) {
      localStorage.removeItem(KEY_FALLOS_BOTON);
      btn.click();
      console.log('BUMP CLICK REAL');
      return true;
    }

    return false;
  }

  function buscarBotonMyPosts() {
    const botones = Array.from(
      document.querySelectorAll(
        'a, button, input[type="button"], input[type="submit"]'
      )
    );

    for (const el of botones) {
      const texto = (
        el.innerText ||
        el.value ||
        el.textContent ||
        ''
      ).trim().toLowerCase();

      if (texto.includes('my posts')) {
        return el;
      }
    }

    return null;
  }

  function ejecutarPasoConfirmacion() {
    if (!detectarExito()) return false;

    const btnMyPosts = buscarBotonMyPosts();

    if (btnMyPosts) {
      btnMyPosts.click();
      return true;
    }

    if (window.history.length > 1) {
      try {
        window.history.back();
        return true;
      } catch {}
    }

    return false;
  }

  async function motor() {
    const guardia = await evaluarModoGuardia();
    if (guardia) return;

    await sincronizarDatosMega();

    const estado = await consultarEstadoPerfil(PERFIL_ID);

    if (estado !== 'ACTIVA') {
      guardarMemoria(
        0,
        Date.now() + CICLO_MINUTOS * 60000
      );
      renderBoton();
      return;
    }

    const ahora = Date.now();

    if (detectarExito() && !lockoutReporte) {
      lockoutReporte = true;

      const fotoBumpBase64 =
        await capturarPruebaBumpCompleta();

      await registrarEventoEnPanel({
        id: PERFIL_ID,
        tipo: 'publicado',
        foto_bump_base64: fotoBumpBase64,
        ultima_accion: 'Publicado con éxito',
        ultima_hora: new Date().toLocaleString()
      });

      setTimeout(() => {
        lockoutReporte = false;
      }, 40000);
    }

    if (ahora < nextTime) {
      renderBoton();
      return;
    }

    if (fase === 0) {
      const ok = ejecutarPasoPrincipal();

      if (ok) {
        localStorage.setItem(
          KEY_FASE1_INICIO,
          String(Date.now())
        );

        localStorage.removeItem(KEY_FALLOS_BOTON);

        guardarMemoria(
          1,
          Date.now() + DELAY_CONFIRMACION * 1000
        );
      } else {
        const fallos = Number(
          localStorage.getItem(KEY_FALLOS_BOTON) || 0
        ) + 1;

        localStorage.setItem(
          KEY_FALLOS_BOTON,
          String(fallos)
        );

        if (fallos >= MAX_FALLOS_BOTON) {
          await dispararAlerta(
            'BOTON_NO_APARECE',
            'No aparece el botón de bump.',
            `Fallos: ${fallos}. URL: ${window.location.href}`
          );
          return;
        }

        guardarMemoria(0, Date.now() + 1000);
      }

      renderBoton();
      return;
    }

    if (fase === 1) {
      if (detectarExito()) {
        localStorage.removeItem(KEY_FASE1_INICIO);

        guardarMemoria(
          2,
          Date.now() + DELAY_SEGUNDO_TOQUE * 1000
        );
      } else {
        const inicio = Number(
          localStorage.getItem(KEY_FASE1_INICIO) ||
          Date.now()
        );

        localStorage.setItem(
          KEY_FASE1_INICIO,
          String(inicio)
        );

        if (
          Date.now() - inicio >= MAX_ESPERA_SWEET_MS
        ) {
          await dispararAlerta(
            'NO_LLEGA_SWEET',
            'No llegó la pantalla de éxito.',
            `Espera: ${Math.round(
              (Date.now() - inicio) / 1000
            )} segundos.`
          );
          return;
        }

        guardarMemoria(1, Date.now() + 1000);
      }

      renderBoton();
      return;
    }

    if (fase === 2) {
      const ok = ejecutarPasoConfirmacion();

      if (ok) {
        localStorage.removeItem(KEY_FASE2_FALLOS);

        guardarMemoria(
          0,
          Date.now() + CICLO_MINUTOS * 60000
        );
      } else {
        const fallos = Number(
          localStorage.getItem(KEY_FASE2_FALLOS) || 0
        ) + 1;

        localStorage.setItem(
          KEY_FASE2_FALLOS,
          String(fallos)
        );

        if (fallos >= MAX_FALLOS_FASE2) {
          await dispararAlerta(
            'NO_VUELVE_MY_POSTS',
            'No pudo volver a My Posts.',
            `Fallos: ${fallos}`
          );
          return;
        }

        guardarMemoria(2, Date.now() + 1000);
      }

      renderBoton();
    }
  }

  // Evita ciclos simultáneos.
  setInterval(async () => {
    if (!document.body || motorOcupado) return;

    motorOcupado = true;

    try {
      renderBoton();
      await motor();
    } catch (e) {
      console.error('Error motor Panel 2:', e);
    } finally {
      motorOcupado = false;
    }
  }, 1000);

})();
