
/*
 * LOBO PRO - 1 POST - PANEL3 TELEGRAM CLIENTE
 * Version 6.9 - Dolphin Anty
 * Requiere html2canvas.min.js precargado
 */

(function () {
  'use strict';

  const KEY_PERFIL_GLOBAL = 'CQ2_PERFIL_AUTORIZADO_V3';

  function obtenerPerfilId() {
    let id = localStorage.getItem(KEY_PERFIL_GLOBAL);

    if (!id || !String(id).trim()) {
      id = prompt('Escribe el ID del perfil del panel:');

      if (!id || !String(id).trim()) {
        alert('Falta ID del perfil. El motor no va a trabajar.');
        return '';
      }

      id = String(id).trim();
      localStorage.setItem(KEY_PERFIL_GLOBAL, id);
    }

    return String(id).trim();
  }

  const PERFIL_ID = obtenerPerfilId();
  if (!PERFIL_ID) return;

  const KEY_TOKEN_GLOBAL = `CQ2_TOKEN_AUTORIZADO_V3_${PERFIL_ID}`;

  function obtenerClienteToken() {
    let token = localStorage.getItem(KEY_TOKEN_GLOBAL);

    if (!token || !String(token).trim()) {
      token = prompt(
        `Escribe la clave de acceso del perfil ${PERFIL_ID}:`
      );

      if (!token || !String(token).trim()) {
        alert('Falta clave de acceso. El motor no va a trabajar.');
        return '';
      }

      token = String(token).trim();
      localStorage.setItem(KEY_TOKEN_GLOBAL, token);
    }

    return String(token).trim();
  }

  let CLIENTE_TOKEN = obtenerClienteToken();
  if (!CLIENTE_TOKEN) return;

  // PANEL3 - TELEGRAM CLIENTE
  const PANEL_LOCAL = 'http://localhost:3002';
  const PANEL_NUBE = 'https://panel-control-3002-production.up.railway.app';

  const CICLO_MINUTOS = 16;
  const DELAY_CONFIRMACION = 15;
  const DELAY_SEGUNDO_TOQUE = 10;

  const MAX_FALLOS_BOTON = 60;
  const MAX_ESPERA_SWEET_MS = 120000;
  const MAX_FALLOS_FASE2 = 45;
  const ALERTA_COOLDOWN_MS = 10 * 60 * 1000;

  const KEY_ESTADO = `estado_${PERFIL_ID}`;
  const KEY_FASE = `fase_${PERFIL_ID}`;
  const KEY_NEXT = `next_${PERFIL_ID}`;
  const KEY_DATOS = `datos_mega_${PERFIL_ID}`;
  const KEY_ULTIMO_REPORTE = `ultimo_reporte_publicado_${PERFIL_ID}`;
  const KEY_ALERTA_BLOQUEADA = `alerta_bloqueada_${PERFIL_ID}`;
  const KEY_ULTIMA_ALERTA_TS = `ultima_alerta_ts_${PERFIL_ID}`;
  const KEY_FALLOS_BOTON = `fallos_boton_${PERFIL_ID}`;
  const KEY_FASE1_INICIO = `fase1_inicio_${PERFIL_ID}`;
  const KEY_FASE2_FALLOS = `fase2_fallos_${PERFIL_ID}`;

  let estadoLocal = localStorage.getItem(KEY_ESTADO) || 'PAUSADA';
  let lockoutReporte = false;
  let lockoutDatos = false;
  let avisoTokenInvalido = false;
  let lockoutAlerta = false;

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

  function bloquearPorClave(motivo) {
    if (avisoTokenInvalido) return;

    avisoTokenInvalido = true;
    guardarEstado('PAUSADA');
    limpiarMemoriaAcceso();

    alert(
      `${motivo || 'Acceso inválido'}. Se borró el acceso viejo. El script pedirá ID y clave otra vez.`
    );

    setTimeout(() => {
      try {
        window.location.reload();
      } catch (e) {}
    }, 1000);
  }

  async function fetchJSONBase(base, path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
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
      const dataEstado = await fetchJSONBase(
        base,
        `/api/estado/${id}?t=${Date.now()}`
      );

      resultado.estadoPanel =
        String(dataEstado?.estado || '').toUpperCase();

    } catch (e) {
      console.log('No se pudo consultar estado en:', base, e.message);
    }

    try {
      const tokenSeguro = encodeURIComponent(CLIENTE_TOKEN);

      const dataLicencia = await fetchJSONBase(
        base,
        `/api/licencia/${id}?token=${tokenSeguro}&t=${Date.now()}`
      );

      resultado.estadoLicencia =
        String(dataLicencia?.estado || '').toUpperCase();

      resultado.licenciaOk = dataLicencia?.ok === true;
      resultado.motivoLicencia =
        String(dataLicencia?.motivo || '');

    } catch (e) {
      console.log('No se pudo consultar licencia en:', base, e.message);
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
    } catch (e) {
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

      if (proporcion > 1.7 || proporcion < 0.5) continue;

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

    return [...new Set(fotos.map(f => f.src))].slice(0, 10);
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
    const payloadSeguro = {
      ...payload,
      token: CLIENTE_TOKEN
    };

    const opciones = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cliente-Token': CLIENTE_TOKEN
      },
      body: JSON.stringify(payloadSeguro),
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
          bloquearPorClave('Clave inválida o acceso reseteado');
          return;
        }
      } catch (e) {
        console.log(
          `No se pudo mandar al panel ${nombre}:`,
          e
        );
      }
    }
  }

  async function registrarAlertaEnPanel(payload) {
    const payloadSeguro = {
      ...payload,
      token: CLIENTE_TOKEN
    };

    const opciones = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cliente-Token': CLIENTE_TOKEN
      },
      body: JSON.stringify(payloadSeguro),
      cache: 'no-store'
    };

    let enviado = false;

    for (const [base, nombre] of [
      [PANEL_LOCAL, 'local'],
      [PANEL_NUBE, 'nube']
    ]) {
      try {
        const res = await fetch(
          `${base}/registrar-alerta`,
          opciones
        );

        if (res.status === 403) {
          bloquearPorClave('Clave inválida o acceso reseteado');
          return;
        }

        if (res.ok) enviado = true;
      } catch (e) {
        console.log(
          `No se pudo mandar alerta al panel ${nombre}:`,
          e
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
      (!datos.fotos_pagina || datos.fotos_pagina.length === 0)
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
        'Datos y fotos actualizados automáticamente desde Mega',
      ultima_hora: new Date().toLocaleString()
    });

    setTimeout(() => {
      lockoutDatos = false;
    }, 30000);
  }

  async function consultarEstadoPerfil(id) {
    try {
      const fuentes = [await consultarFuente(PANEL_NUBE, id)];

      if (fuentes.some(
        f => f.estadoLicencia === 'TOKEN_INVALIDO'
      )) {
        bloquearPorClave(
          'Clave de acceso incorrecta o acceso reseteado'
        );
        return 'PAUSADA';
      }

      if (fuentes.some(f =>
        f.estadoLicencia === 'NO_EXISTE' ||
        f.estadoPanel === 'NO_EXISTE'
      )) {
        bloquearPorClave(
          'El perfil ya no existe o fue cambiado'
        );
        return 'PAUSADA';
      }

      if (fuentes.some(f =>
        f.estadoPanel === 'PAUSADA' ||
        f.estadoLicencia === 'PAUSADA' ||
        f.estadoLicencia === 'VENCIDA'
      )) {
        guardarEstado('PAUSADA');
        return 'PAUSADA';
      }

      const autorizacion = fuentes[0];
      if (
        autorizacion &&
        autorizacion.estadoPanel === 'ACTIVA' &&
        autorizacion.licenciaOK === true &&
        autorizacion.estadoLicencia === 'ACTIVA'
      ) {
        guardarEstado('ACTIVA');
        return 'ACTIVA';
      }

      console.log(
        'Sin confirmación clara. Mantiene estado actual:',
        estadoLocal
      );

      return 'PAUSADA';

    } catch (e) {
      console.log(
        'Error consultando panel/licencia. Mantiene estado:',
        estadoLocal
      );

      return 'PAUSADA';
    }
  }

  // CQ2_ONOFF_TOKEN_NUBE_V1
  async function cambiarEstadoEnPanel(id, accion) {
    const token = String(CLIENTE_TOKEN || '').trim();

    if (!token) {
      console.error('CQ2: falta token de acceso');
      alert('Falta la clave de acceso del perfil.');
      return false;
    }

    try {
      const respuesta = await fetch(
        `${PANEL_NUBE}/accion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cliente-Token': token
          },
          body: JSON.stringify({
            id: String(id),
            accion: String(accion),
            token
          }),
          cache: 'no-store'
        }
      );

      let resultado = {};

      try {
        resultado = await respuesta.json();
      } catch (_) {}

      if (!respuesta.ok || resultado.ok !== true) {
        const motivo =
          resultado.error ||
          resultado.motivo ||
          resultado.estado ||
          `HTTP ${respuesta.status}`;

        console.error(
          'CQ2: orden rechazada por Railway:',
          respuesta.status,
          motivo
        );

        alert(
          `Panel 2 no acepto la orden: ${motivo}`
        );

        return false;
      }

      console.log(
        'CQ2: orden confirmada por Railway:',
        resultado.estado
      );

      return true;

    } catch (error) {
      console.error(
        'CQ2: error de comunicacion con Railway:',
        error
      );

      alert(
        'No se pudo conectar con el Panel 2.'
      );

      return false;
    }
  }

  function renderBoton() {
    const idUI = `motor-panel-${PERFIL_ID}`;

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

        <div id="led-${PERFIL_ID}" style="
          width:12px;
          height:12px;
          border-radius:50%;
        "></div>

        <span id="time-${PERFIL_ID}" style="
          color:#fff;
          font-size:16px;
          min-width:48px;
          text-align:center;
        ">0:00</span>
      `;

      box.onpointerdown = async e => {
        e.preventDefault();
        e.stopPropagation();

        const accion = estadoLocal === 'ACTIVA'
          ? 'pausar'
          : 'reanudar';

        await cambiarEstadoEnPanel(PERFIL_ID, accion);

        if (accion === 'reanudar') {
          limpiarBloqueoAlertaLocal();
        }

        guardarEstado(
          accion === 'pausar' ? 'PAUSADA' : 'ACTIVA'
        );

        renderBoton();
      };

      document.body.appendChild(box);
    }

    const led = document.getElementById(`led-${PERFIL_ID}`);
    const time = document.getElementById(`time-${PERFIL_ID}`);

    const activa = estadoLocal === 'ACTIVA';

    const alertaBloqueada =
      localStorage.getItem(KEY_ALERTA_BLOQUEADA) === '1';

    led.style.background = alertaBloqueada
      ? '#ff0'
      : activa ? '#0f0' : '#f00';

    led.style.boxShadow = alertaBloqueada
      ? '0 0 8px #ff0'
      : activa ? '0 0 8px #0f0'
      : '0 0 8px #f00';

    time.textContent = alertaBloqueada
      ? 'ALRT'
      : activa
        ? `${m}:${s < 10 ? '0' : ''}${s}`
        : 'OFF';
  }

  function detectarExito() {
    const txt = (document.body?.innerText || '').toLowerCase();
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
        console.log('html2canvas no está disponible');
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
    try {
      if (!detectarExito() || !document.body) return '';
      return await capturarPantallaCompleta();
    } catch (e) {
      console.log('No se pudo capturar prueba completa:', e);
      return '';
    }
  }

  function paginaTextoLower() {
    return String(document.body?.innerText || '').toLowerCase();
  }

  function hayInputPasswordVisible() {
    try {
      return Array.from(
        document.querySelectorAll('input[type="password"]')
      ).some(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    } catch (e) {
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
        motivo:
          'La página parece estar pidiendo captcha o verificación de robot.',
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
        motivo:
          'La cuenta parece estar pidiendo verificación.',
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
        motivo:
          'La cuenta parece estar bloqueada, suspendida o deshabilitada.',
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
        motivo:
          'La sesión parece cerrada o está pidiendo login otra vez.',
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
        motivo:
          'La página está mostrando un error de publicación.',
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
        motivo:
          'La publicación parece estar removida o rechazada.',
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
        motivo:
          'La página muestra un campo de contraseña/login visible.',
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

    console.log(
      'MODO GUARDIA: perfil pausado por alerta',
      tipo,
      motivo,
      detalle
    );

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
    const btn = document.querySelector('#managePublishAd');

    console.log('btn existe:', !!btn);

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

    console.log('FASE 2 intentando segundo toque real');

    const btnMyPosts = buscarBotonMyPosts();

    if (btnMyPosts) {
      btnMyPosts.click();
      console.log('Segundo toque en MY POSTS');
      return true;
    }

    if (window.history.length > 1) {
      try {
        window.history.back();
        console.log('Segundo toque usando history.back()');
        return true;
      } catch (e) {
        console.log('Falló history.back()');
      }
    }

    console.log('No se pudo hacer segundo toque');
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
      console.log('FASE 0 intentando BUMP');

      const ok = ejecutarPasoPrincipal();

      if (ok) {
        console.log('BUMP OK pasa a 15s');

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
        const fallos =
          Number(localStorage.getItem(KEY_FALLOS_BOTON) || 0) + 1;

        localStorage.setItem(
          KEY_FALLOS_BOTON,
          String(fallos)
        );

        if (fallos >= MAX_FALLOS_BOTON) {
          await dispararAlerta(
            'BOTON_NO_APARECE',
            'No aparece el botón de bump después de varios intentos.',
            `Fallos seguidos: ${fallos}. URL: ${window.location.href}`
          );

          return;
        }

        console.log('FALLÓ reintento 1s');
        guardarMemoria(0, Date.now() + 1000);
      }

      renderBoton();
      return;
    }

    if (fase === 1) {
      if (detectarExito()) {
        console.log(
          `Pantalla rosada detectada esperando ${DELAY_SEGUNDO_TOQUE}s`
        );

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
            'Después de intentar publicar, no llegó la pantalla Sweet/éxito.',
            `Esperó ${Math.round((Date.now() - inicio) / 1000)} segundos. URL: ${window.location.href}`
          );

          return;
        }

        guardarMemoria(
          1,
          Date.now() + 1000
        );
      }

      renderBoton();
      return;
    }

    if (fase === 2) {
      const ok = ejecutarPasoConfirmacion();

      if (ok) {
        console.log('SEGUNDO TOQUE OK vuelve a 16 min');

        localStorage.removeItem(KEY_FASE2_FALLOS);

        guardarMemoria(
          0,
          Date.now() + CICLO_MINUTOS * 60000
        );

      } else {
        const fallosFase2 =
          Number(localStorage.getItem(KEY_FASE2_FALLOS) || 0) + 1;

        localStorage.setItem(
          KEY_FASE2_FALLOS,
          String(fallosFase2)
        );

        if (fallosFase2 >= MAX_FALLOS_FASE2) {
          await dispararAlerta(
            'NO_VUELVE_MY_POSTS',
            'La pantalla de éxito salió, pero no pudo volver a My Posts después de varios intentos.',
            `Fallos fase 2: ${fallosFase2}. URL: ${window.location.href}`
          );

          return;
        }

        console.log(
          'FASE 2 no pudo hacer segundo toque, reintenta en 1s'
        );

        guardarMemoria(2, Date.now() + 1000);
      }

      renderBoton();
    }
  }

  setInterval(() => {
    try {
      if (document.body) {
        renderBoton();
        motor();
      }
    } catch (e) {
      console.log('Error:', e);
    }
  }, 1000);

})();
