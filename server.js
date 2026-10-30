// CQ2_PANEL_UNICO_CORREGIDO_V1
// CQ2_API_SEGURA_V1
// CQ2_MOTOR_SEGURO_V2
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

let FormData = null;

try {
  FormData = require('form-data');
} catch (e) {
  console.log('⚠️ Falta form-data. Corre: npm install form-data');
}

const app = express();
// CQ2_ID_GLOBAL_FINAL_V2
const cq2IdExiste = require('./cq2_id_unico');

// CQ2_UN_PANEL_DATOS_PRIVADOS_V1
const { AsyncLocalStorage } = require('async_hooks');
const cq2Contexto = new AsyncLocalStorage();

function cq2Archivo(nombre) {
  const sesion = cq2Contexto.getStore();
  if (!sesion) return null;

  return path.join(
    require('./clientes_store').carpetaCliente(sesion.id),
    nombre
  );
}

app.locals.cq2ConCliente = (cliente, fn) => {
  if (!cliente || !cliente.id) {
    throw new Error('Cliente no autenticado');
  }
  return cq2Contexto.run({ id: cliente.id }, fn);
};

app.locals.cq2PerfilesCliente = cliente => {
  const archivo = path.join(
    require('./clientes_store').carpetaCliente(cliente.id),
    'data.json'
  );
  return JSON.parse(fs.readFileSync(archivo, 'utf8'));
};
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// CQ2_LOGO_ORIGINAL_V3
app.use('/img', express.static(path.join(__dirname,'public','img')));

// CQ2_INTEGRACION_CLIENTES_V1

// Apariencia del portal de clientes.
require('./cq_jean_cliente_v7')(app);

// Credenciales, sesiones y perfiles privados.
require('./cliente_portal')(app);

// API de clientes, usando el Telegram de CONTROL 2.
require('./cliente_api')(app, {
  enviarTexto,
  enviarConBotonesCliente: (texto, chatId, cliente, id) =>
    apiTelegram('sendMessage', {
      chat_id: chatId,
      text: texto,
      reply_markup: require('./cliente_botones')
        .botones(cliente, id)
    })
});

// Primero el acceso; despues la administracion.
// CQ2_BLOQUEO_CRUCE_CLIENTES_V1
// Una sesion de cliente nunca debe escribir en el panel principal.
// Las rutas /cliente conservan su almacenamiento privado.
app.use((req, res, next) => {
  const obtenerCliente = app.locals.cqClienteActual;

  let cliente = null;
  try {
    cliente = typeof obtenerCliente === 'function'
      ? obtenerCliente(req)
      : null;
  } catch (error) {
    console.error('[CQ2 AISLAMIENTO]', error.message);
    return res.sendStatus(500);
  }

  if (!cliente) return next();

  const ruta = req.path;

  const principal =
    ruta === '/' ||
    ruta === '/nuevo' ||
    ruta === '/guardar-perfil' ||
    ruta === '/accion' ||
    ruta === '/accion-global' ||
    /^\/editar\/[^/]+\/?$/.test(ruta);

  const administracion =
    ruta === '/administracion' ||
    ruta.startsWith('/admin/');

  if (administracion) {
    return res.status(403).send(
      'Cierra la sesion del cliente para administrar cuentas.'
    );
  }

  if (!principal) return next();

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (ruta === '/nuevo') {
      return res.redirect('/cliente/nuevo');
    }

    if (ruta.startsWith('/editar/')) {
      return res.redirect('/cliente' + ruta);
    }

    return res.redirect('/cliente');
  }

  return res.status(403).json({
    ok: false,
    error: 'La cuenta de cliente no puede modificar datos principales'
  });
});
// CQ2_SESIONES_EXCLUSIVAS_V1
// No permitir operar el panel principal con una sesion cliente.
app.use((req,res,next) => {
  const obtener = app.locals.cqClienteActual;
  const cliente = typeof obtener === 'function'
    ? obtener(req) : null;

  if (!cliente) return next();

  const ruta = req.path;

  const principal = [
    '/', '/nuevo', '/guardar-perfil',
    '/accion', '/accion-global'
  ].includes(ruta) || /^\/editar\/[^/]+\/?$/.test(ruta);

  if (ruta === '/administracion' ||
      ruta.startsWith('/admin/')) {
    return res.sendStatus(403);
  }

  if (!principal) return next();

  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect('/cliente');
  }

  return res.status(403).json({
    ok:false,
    error:'Operacion bloqueada: cuenta de cliente'
  });
});
 // CQ2_MANIFEST_POSTBOT_V1
app.get('/manifest.webmanifest',(req,res)=>{
  res.type('application/manifest+json').sendFile(
    path.join(__dirname,'public','manifest.webmanifest')
  );
});
require('./seguridad_admin')(app);
require('./admin_api')(app);

// Pantalla de administracion protegida por la sesion.
app.get('/administracion', (req, res) => {
  if (req.admin !== true) {
    return res.sendStatus(403);
  }

  return res.sendFile(
    path.join(__dirname, 'admin_clientes.html')
  );
});


// CQ2_PANEL_ADMIN_CLIENTE_ORIGINAL_V3
app.get('/admin/panel/:id', (req, res) => {
  if (req.admin !== true) return res.sendStatus(403);

  try {
    const store = require('./clientes_store');
    const cliente = store.listar().find(
      c => c.id === req.params.id
    );

    if (!cliente) return res.sendStatus(404);

    // Usar exclusivamente los datos de este cliente.
    req.cliente = cliente;
    req.cq2AdminVista = true;

    res.setHeader('Cache-Control', 'no-store');

    const enviarOriginal = res.send.bind(res);

    res.send = function(html) {
      if (typeof html === 'string') {
        const id = encodeURIComponent(cliente.id);

              }

              // CQ2_CREACION_AISLADA_ADMIN_V1
        if (typeof html === 'string') {
          const clienteId = encodeURIComponent(cliente.id);

          // Crear perfiles exclusivamente en el cliente abierto.
          html = html.replace(
            /href="\/nuevo"/g,
            'href="/admin/cliente/' + clienteId + '/nuevo"'
          );

          // No ofrecer acciones globales sobre datos principales.
          html = html.replace(
            /<button\b[^>]*onclick="accionGlobal\([^"]*"[^>]*>[\s\S]*?<\/button>/gi,
            ''
          );
        }


        if (typeof html === 'string') {
          const cid = encodeURIComponent(cliente.id);

          html = html.replace(
            /onclick="accionPerfil\('([^']+)','borrarperfil'\)"/g,
            'onclick="cq2BorrarCliente(' + "'$1'" + ')"'
          );

          const script = '<script>' +
            'async function cq2BorrarCliente(id){' +
            'if(!confirm("¿Borrar este perfil del cliente?"))return;' +
            'if(!confirm("Confirmacion final: eliminar perfil "+id+"?"))return;' +
            'const r=await fetch("/admin/cliente/' + cid +
            '/accion",{method:"POST",' +
            'headers:{"Content-Type":"application/json"},' +
            'body:JSON.stringify({id:id,accion:"borrarperfil"})});' +
            'if(!r.ok){alert("No se pudo borrar. Estado "+r.status);return;}' +
            'location.reload();' +
            '}' +
            '</script>';

          html = html.replace(/<\/body>/i,script+'</body>');
        }
        return enviarOriginal(html);
    };

    return app.locals.cq2RenderOriginal(req, res);
  } catch (error) {
    console.error('[CQ2 ADMIN PANEL]', error.message);
    return res.status(500).send(
      'Error cargando panel del cliente'
    );
  }
});
// FIN CQ2_PANEL_ADMIN_CLIENTE_ORIGINAL_V3
// CQ2_CREACION_ADMIN_CLIENTE_V1
const cq2FormularioAdminOriginal = "\u003chtml\u003e\r\n  \u003chead\u003e\r\n    \u003cmeta charset=\"UTF-8\" /\u003e\r\n    \u003ctitle\u003eNuevo perfil\u003c/title\u003e\r\n    \u003cstyle\u003e\r\n      body { background:#0b1c2c; color:white; font-family:Arial,sans-serif; margin:0; padding:20px; }\r\n      input, textarea, select { width:100%; padding:10px; border-radius:8px; border:none; margin-top:4px; margin-bottom:12px; }\r\n      label { font-weight:bold; }\r\n      .form-box { max-width:700px; background:#132f4c; padding:20px; border-radius:14px; }\r\n      button, a { padding:10px 14px; border:none; border-radius:10px; text-decoration:none; display:inline-block; }\r\n      .success { background:#2e7d32; color:white; }\r\n      .muted { background:#455a64; color:white; }\r\n    \u003c/style\u003e\r\n  \u003c/head\u003e\r\n  \u003cbody\u003e\r\n    \u003ch1\u003e➕ Nuevo perfil\u003c/h1\u003e\r\n    \u003cdiv class=\"form-box\"\u003e\r\n      \u003cform method=\"POST\" action=\"/admin/cliente/__CID__/guardar\"\u003e\r\n        \u003clabel\u003eID del perfil\u003c/label\u003e\r\n        \u003cinput name=\"id\" required /\u003e\r\n\r\n        \u003clabel\u003eNombre\u003c/label\u003e\r\n        \u003cinput name=\"nombre\" /\u003e\r\n\r\n        \u003clabel\u003eChat ID\u003c/label\u003e\r\n        \u003cinput name=\"chat_id\" /\u003e\r\n\r\n        \u003clabel\u003eCliente token / Clave de acceso\u003c/label\u003e\r\n        \u003cinput name=\"cliente_token\" /\u003e\r\n\r\n        \u003clabel\u003eTeléfono\u003c/label\u003e\r\n        \u003cinput name=\"telefono\" /\u003e\r\n\r\n        \u003clabel\u003eCódigo\u003c/label\u003e\r\n        \u003cinput name=\"codigo\" /\u003e\r\n\r\n        \u003clabel\u003eUbicación\u003c/label\u003e\r\n        \u003cinput name=\"ubicacion\" /\u003e\r\n\r\n        \u003clabel\u003eTexto\u003c/label\u003e\r\n        \u003ctextarea name=\"texto\"\u003e\u003c/textarea\u003e\r\n\r\n        \u003clabel\u003eEstado\u003c/label\u003e\r\n        \u003cselect name=\"estado\"\u003e\r\n          \u003coption value=\"ACTIVA\"\u003eACTIVA\u003c/option\u003e\r\n          \u003coption value=\"PAUSADA\"\u003ePAUSADA\u003c/option\u003e\r\n        \u003c/select\u003e\r\n\r\n        \u003clabel\u003eFoto modelo (URL o file_id)\u003c/label\u003e\r\n        \u003cinput name=\"foto_modelo\" /\u003e\r\n\r\n        \u003clabel\u003eFoto página (URL o file_id)\u003c/label\u003e\r\n        \u003cinput name=\"foto_pagina\" /\u003e\r\n\r\n        \u003clabel\u003ePróximo post\u003c/label\u003e\r\n        \u003cinput name=\"proximo_post\" value=\"16m\" /\u003e\r\n\r\n        \u003clabel\u003eFin de plan\u003c/label\u003e\r\n        \u003cinput name=\"fin_plan\" value=\"7 días\" /\u003e\r\n\r\n        \u003cbutton class=\"success\" type=\"submit\"\u003eGuardar perfil\u003c/button\u003e\r\n        \u003ca class=\"muted\" href=\"/admin/panel/__CID__\"\u003eVolver\u003c/a\u003e\r\n      \u003c/form\u003e\r\n    \u003c/div\u003e\r\n  \u003c/body\u003e\r\n  \u003c/html\u003e";

function cq2AdminCliente(req, res, next) {
  if (req.admin !== true) return res.sendStatus(403);

  const store = require('./clientes_store');
  const cliente = store.listar().find(
    c => c.id === req.params.id
  );

  if (!cliente) return res.sendStatus(404);

  if (req.method === 'POST') {
    const origen = req.get('origin');
    const esperado =
      (req.get('x-forwarded-proto') || req.protocol) +
      '://' + req.get('host');

    if (origen && origen !== esperado) {
      return res.sendStatus(403);
    }
  }

  req.cq2ClienteAdmin = cliente;
  next();
}

app.get(
  '/admin/cliente/:id/nuevo',
  cq2AdminCliente,
  (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const id = encodeURIComponent(req.cq2ClienteAdmin.id);

    return res.type('html').send(
      cq2FormularioAdminOriginal.replaceAll('__CID__', id)
    );
  }
);

app.post(
  '/admin/cliente/:id/guardar',
  cq2AdminCliente,
  (req, res) => {
    try {
      const store = require('./clientes_store');
      const c = req.cq2ClienteAdmin;
      const archivo = path.join(
        store.carpetaCliente(c.id), 'data.json'
      );

      const datos = JSON.parse(
        fs.readFileSync(archivo, 'utf8')
      );

      if (!datos || typeof datos !== 'object' ||
          Array.isArray(datos)) {
        throw new Error('Datos de cliente invalidos');
      }

      const id = String(req.body.id || '').trim();

      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) {
        return res.status(400).send('ID invalido');
      }

      if (cq2IdExiste(id)) {
        return res.status(409).send('El perfil ya existe');
      }

      if (Object.keys(datos).length >= c.limite) {
        return res.status(403).send('Limite de perfiles alcanzado');
      }

      const campos = [
        'nombre','chat_id','cliente_token','telefono',
        'codigo','ubicacion','texto','estado',
        'foto_modelo','foto_pagina','proximo_post','fin_plan'
      ];

      const perfil = {};

      for (const campo of campos) {
        const valor = req.body[campo];

        if (valor !== undefined && typeof valor !== 'string') {
          return res.status(400).send('Campo invalido');
        }

        const maximo = campo === 'texto' ? 5000 : 500;

        if (String(valor || '').length > maximo) {
          return res.status(400).send('Campo demasiado largo');
        }

        perfil[campo] = String(valor || '').trim();
      }

      if (!perfil.nombre) perfil.nombre = 'Perfil ' + id;

      if (perfil.chat_id &&
          !/^-?[0-9]{5,20}$/.test(perfil.chat_id)) {
        return res.status(400).send('Chat ID invalido');
      }

      if (!['ACTIVA','PAUSADA'].includes(perfil.estado)) {
        return res.status(400).send('Estado invalido');
      }

      perfil.ultima_hora = new Date().toISOString();
      perfil.ultima_accion = 'Perfil creado desde administracion';
      perfil.ultimaAccion = perfil.ultima_accion;
      perfil.bump_hoy = 0;
      perfil.bump_total = 0;
      perfil.historial_fotos = [];

      datos[id] = perfil;

      const temporal = archivo + '.tmp';
      fs.writeFileSync(
        temporal,
        JSON.stringify(datos, null, 2),
        'utf8'
      );
      fs.renameSync(temporal, archivo);

      return res.redirect(
        '/admin/panel/' + encodeURIComponent(c.id)
      );

    } catch (error) {
      console.error('[CQ2 CREAR ADMIN]', error.message);
      return res.status(500).send(
        'No se pudo guardar el perfil'
      );
    }
  }
);
// FIN CQ2_CREACION_ADMIN_CLIENTE_V1

// CQ2_ACCIONES_ADMIN_SEGURAS_V1
app.post('/admin/cliente/:id/accion', (req,res) => {
  if (req.admin !== true) return res.sendStatus(403);

  const origen = req.get('origin');
  const esperado = (req.get('x-forwarded-proto') || req.protocol) +
    '://' + req.get('host');

  if (origen && origen !== esperado) return res.sendStatus(403);

  const store = require('./clientes_store');
  const cliente = store.listar().find(c => c.id === req.params.id);
  if (!cliente) return res.sendStatus(404);

  const id = String(req.body.id || '');
  const accion = String(req.body.accion || '');

  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) {
    return res.sendStatus(400);
  }

  if (!['pausar','reanudar','reiniciar','borrarperfil'].includes(accion)) {
    return res.status(400).json({
      ok:false,
      error:'Accion no habilitada'
    });
  }

  try {
    const archivo = path.join(
      store.carpetaCliente(cliente.id), 'data.json'
    );

    const datos = JSON.parse(fs.readFileSync(archivo,'utf8'));
    if (!datos || typeof datos !== 'object' ||
        Array.isArray(datos) ||
        !Object.prototype.hasOwnProperty.call(datos,id)) {
      return res.sendStatus(404);
    }


    if (accion === 'borrarperfil') {
      const respaldo = archivo + '.admin-delete-' +
        Date.now() + '.bak';

      fs.copyFileSync(archivo, respaldo);

      delete datos[id];

      const temporal = archivo + '.tmp';
      fs.writeFileSync(
        temporal,
        JSON.stringify(datos,null,2),
        'utf8'
      );
      fs.renameSync(temporal,archivo);

      return res.json({ok:true,borrado:id});
    }

    datos[id].estado = accion === 'pausar' ? 'PAUSADA' : 'ACTIVA';
    datos[id].ultima_hora = new Date().toISOString();
    datos[id].ultima_accion =
      accion === 'pausar' ? 'Pausado desde administracion' :
      accion === 'reanudar' ? 'Reanudado desde administracion' :
      'Reiniciado desde administracion';

    const temporal = archivo + '.tmp';
    fs.writeFileSync(
      temporal,JSON.stringify(datos,null,2),'utf8'
    );
    fs.renameSync(temporal,archivo);

    return res.json({ok:true,estado:datos[id].estado});
  } catch(e) {
    console.error('[CQ2 ADMIN ACCION]',e.message);
    return res.sendStatus(500);
  }
});
// FIN CQ2_ACCIONES_ADMIN_SEGURAS_V1
// FIN CQ2_INTEGRACION_CLIENTES_V1

// CQ2_CORS_SEGURO_V1
// No habilitar acceso universal desde otros sitios.
app.use((req, res, next) => {
  res.setHeader('Vary', 'Origin');
  next();
});

const PORT = Number(process.env.PORT || 3002);

// CAMBIA ESTAS 4 COSAS
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID = '';
const SUPPORT_URL = 'https://t.me/tu_soporte';
const RULES_TEXT = `📜 Reglas del sistema

1. Usa el panel para controlar estados.
2. Verifica tus perfiles antes de trabajar.
3. Las fotos pueden no ser en vivo.
4. Si necesitas ayuda, usa el botón Contactar.`;

// archivos locales
const CQ2_DATA_DIR = process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  __dirname;

fs.mkdirSync(CQ2_DATA_DIR, { recursive: true });

const DATA_FILE = path.join(CQ2_DATA_DIR, 'data.json');
const STATE_FILE = path.join(CQ2_DATA_DIR, 'bot_state.json');
const DATA_BACKUP_FILE = path.join(CQ2_DATA_DIR, 'data.backup.json');
const STATE_BACKUP_FILE = path.join(CQ2_DATA_DIR, 'bot_state.backup.json');

// =========================
// BLOQUEOS DE CICLO
// =========================
let telegramEnProceso = false;
let cicloEnProceso = false;

// =========================
// COLA DE REANUDACIÓN
// =========================
let colaReanudacion = null;
let colaTimeout = null;
let colaVersion = 0;

function cancelarColaReanudacion() {
  if (colaTimeout) {
    clearTimeout(colaTimeout);
    colaTimeout = null;
  }

  colaReanudacion = null;
  colaVersion += 1;
}

// =========================
// UTILIDADES SEGURAS JSON
// =========================
function existeArchivoSeguro(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function copiarArchivoSiExiste(origen, destino) {
  try {
    if (existeArchivoSeguro(origen)) {
      fs.copyFileSync(origen, destino);
      return true;
    }
  } catch (e) {
    console.log(`No se pudo crear backup de ${origen}:`, e.message);
  }
  return false;
}

function guardarJSONSeguro(file, backupFile, data) {
  const tempFile = `${file}.tmp`;

  try {
    if (existeArchivoSeguro(file)) {
      copiarArchivoSiExiste(file, backupFile);
    }

    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, file);
    return true;
  } catch (e) {
    console.log(`Error guardando ${file}:`, e.message);

    try {
      if (existeArchivoSeguro(tempFile)) fs.unlinkSync(tempFile);
    } catch {}

    return false;
  }
}

function leerJSONSeguro(file, backupFile, fallback, opciones = {}) {
  const { protegerContraVacio = false } = opciones;

  if (!existeArchivoSeguro(file)) {
    guardarJSONSeguro(file, backupFile, fallback);
    return fallback;
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');

    if (protegerContraVacio && (!raw || !raw.trim())) {
      throw new Error('Archivo vacío');
    }

    const parsed = JSON.parse(raw);

    if (
      protegerContraVacio &&
      (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      )
    ) {
      throw new Error('JSON inválido para objeto principal');
    }

    return parsed;
  } catch (e) {
    console.log(`Error leyendo ${file}:`, e.message);
  }

  if (existeArchivoSeguro(backupFile)) {
    try {
      const rawBackup = fs.readFileSync(backupFile, 'utf8');

      if (protegerContraVacio && (!rawBackup || !rawBackup.trim())) {
        throw new Error('Backup vacío');
      }

      const parsedBackup = JSON.parse(rawBackup);

      if (
        protegerContraVacio &&
        (
          parsedBackup === null ||
          typeof parsedBackup !== 'object' ||
          Array.isArray(parsedBackup)
        )
      ) {
        throw new Error('Backup inválido');
      }

      console.log(`Recuperado desde backup: ${backupFile}`);
      guardarJSONSeguro(file, backupFile, parsedBackup);
      return parsedBackup;
    } catch (e) {
      console.log(`Error leyendo backup ${backupFile}:`, e.message);
    }
  }

  return fallback;
}

function leerData() {
  const f = cq2Archivo('data.json');
  return leerJSONSeguro(f || DATA_FILE, f ? f + '.backup' : DATA_BACKUP_FILE, {}, { protegerContraVacio: true });
}

function leerState() {
  const f = cq2Archivo('bot_state.json');
  return leerJSONSeguro(
    f || STATE_FILE,
    f ? f + '.backup' : STATE_BACKUP_FILE,
    { offset: 0, schedules: [], esperandoFoto: null },
    { protegerContraVacio: false }
  );
}

function guardarData(data) {
  const f = cq2Archivo('data.json');
  return guardarJSONSeguro(f || DATA_FILE, f ? f + '.backup' : DATA_BACKUP_FILE, data);
}

function guardarState(state) {
  const f = cq2Archivo('bot_state.json');
  return guardarJSONSeguro(f || STATE_FILE, f ? f + '.backup' : STATE_BACKUP_FILE, state);
}

function horaActual() {
  return new Date().toLocaleString();
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function generarTokenAcceso() {
  const parte1 = Math.floor(1000 + Math.random() * 9000);
  const parte2 = Math.random().toString(36).slice(2, 6).toUpperCase();
  const parte3 = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${parte1}-${parte2}-${parte3}`;
}

function asegurarPerfil(data, id) {
  if (!data[id]) {
    data[id] = {
      nombre: `Perfil ${id}`,
      chat_id: '',
      cliente_token: '',
      telefono: '',
      codigo: '',
      ubicacion: '',
      texto: '',
      estado: 'ACTIVA',
      foto_modelo: 'https://picsum.photos/400/260',
      foto_pagina: 'https://picsum.photos/420/280',
      foto_bump: '',
      historial_fotos: [],
      ultima_hora: 'N/A',
      proximo_post: '16m',
      proximo_post_ts: null,
      fin_plan: '7 días',
      ultima_accion: 'Creado',
      ultimo_evento: null,
      bump_hoy: 0,
      bump_total: 0,
      bump_fecha: ''
    };
  } else {
    if (typeof data[id].bump_hoy !== 'number') data[id].bump_hoy = 0;
    if (typeof data[id].bump_total !== 'number') data[id].bump_total = 0;
    if (typeof data[id].bump_fecha !== 'string') data[id].bump_fecha = '';
    if (!('proximo_post_ts' in data[id])) data[id].proximo_post_ts = null;
    if (!Array.isArray(data[id].historial_fotos)) data[id].historial_fotos = [];
    if (!data[id].estado) data[id].estado = 'ACTIVA';
    if (!('cliente_token' in data[id])) data[id].cliente_token = '';
    if (!('foto_bump' in data[id])) data[id].foto_bump = '';
    if (!('foto_modelo' in data[id])) data[id].foto_modelo = 'https://picsum.photos/400/260';
    if (!('foto_pagina' in data[id])) data[id].foto_pagina = 'https://picsum.photos/420/280';
  }
}

function resetBumpSiCambioDia(perfil) {
  const hoy = fechaHoy();
  if (perfil.bump_fecha !== hoy) {
    perfil.bump_fecha = hoy;
    perfil.bump_hoy = 0;
  }
}

function tiempoRestante(ts) {
  if (!ts) return 'N/A';
  const faltan = Math.max(0, ts - Date.now());
  const totalSeg = Math.floor(faltan / 1000);
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${m}m ${s}s`;
}

function tiempoProximoPost(perfil) {
  return perfil.proximo_post_ts
    ? tiempoRestante(perfil.proximo_post_ts)
    : (perfil.proximo_post || 'N/A');
}

function tiempoRestantePlan(fechaFin) {
  if (!fechaFin) return 'N/A';

  const ahora = new Date();
  const fin = new Date(fechaFin);

  if (isNaN(fin.getTime())) return fechaFin;

  const diff = fin - ahora;

  if (diff <= 0) return '❌ Vencido';

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);
  const segundos = Math.floor((diff / 1000) % 60);

  return `${dias} días, ${horas}h ${minutos}m ${segundos}s`;
}

function planVencido(perfil) {
  if (!perfil || !perfil.fin_plan) return false;

  const fin = new Date(perfil.fin_plan);

  if (isNaN(fin.getTime())) return false;

  return fin <= new Date();
}

function puedeContarBump(perfil) {
  if (!perfil) return false;
  if (perfil.estado === 'PAUSADA') return false;
  if (planVencido(perfil)) return false;
  return true;
}

function convertirFinPlan(valor) {
  if (!valor) return '';

  const texto = String(valor).trim().toLowerCase();

  if (/^\d{4}-\d{2}-\d{2}(t\d{2}:\d{2}:\d{2})?$/.test(texto)) {
    return valor;
  }

  const m = texto.match(/^(\d+)\s*d[ií]a?s?$/);
  if (m) {
    const dias = Number(m[1]);
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    fecha.setHours(23, 59, 59, 0);
    return fecha.toISOString().slice(0, 19);
  }

  return valor;
}

function tokenDesdeRequest(req) {
  return String(
    req.query?.token ||
    req.body?.token ||
    req.headers['x-cliente-token'] ||
    ''
  ).trim();
}

function tokenValidoParaPerfil(req, perfil) {
  const token = tokenDesdeRequest(req);

  if (!perfil.cliente_token) return false;

  return token === String(perfil.cliente_token).trim();
}

// =========================
// TELEGRAM
// =========================
function tecladoTelegram(id) {
  return {
    inline_keyboard: [
      [
        { text: '⏸ Pausar', callback_data: `pausar_${id}` },
        { text: '▶️ Reanudar', callback_data: `reanudar_${id}` }
      ],
      [
        { text: '⏸ Pausar todas', callback_data: 'pausar_todas' },
        { text: '▶️ Reanudar todas', callback_data: 'reanudar_todas' }
      ],
      [
        { text: '⏰ Programar pausa', callback_data: `progpausa_${id}` },
        { text: '⏰ Programar reanudar', callback_data: `progreanudar_${id}` }
      ],
      [
        { text: '🕒 Último bump', callback_data: `ultima_${id}` }
      ],
      [
        { text: '🔄 Reiniciar bot', callback_data: `reiniciar_${id}` }
      ],
      [
        { text: '📞 Contactar', url: SUPPORT_URL },
        { text: '📜 Ver reglas', callback_data: 'reglas' }
      ],
      [
        { text: '📸 Ver una foto', callback_data: `foto_${id}` }
      ],
      [
        { text: '🗂 Ver álbum completo', callback_data: `album_${id}` }
      ]
    ]
  };
}

async function apiTelegram(method, payload) {
  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      payload,
      { timeout: 30000 }
    );
    return res.data;
  } catch (error) {
    const msg = error.response?.data || error.message || '';

    if (
      String(msg).includes('ECONNRESET') ||
      String(msg).includes('ETIMEDOUT') ||
      String(msg).includes('socket hang up')
    ) {
      return null;
    }

    console.log(`Error Telegram ${method}:`);
    console.log(msg);
    return null;
  }
}

async function apiTelegramForm(method, form) {
  try {
    const headers = form.getHeaders ? form.getHeaders() : {};

    const res = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      form,
      {
        headers,
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    return res.data;
  } catch (error) {
    console.log(`Error Telegram FORM ${method}:`);
    console.log(error.response?.data || error.message || error);
    return null;
  }
}

async function responderCallback(callbackQueryId, text = 'OK') {
  await apiTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
}

async function enviarTexto(texto, chatId = CHAT_ID, idTeclado = null) {
  await apiTelegram('sendMessage', {
    chat_id: chatId,
    text: texto,
    reply_markup: idTeclado ? tecladoTelegram(idTeclado) : undefined
  });
}

async function enviarFoto(photo, caption, id) {
  const data = leerData();
  const perfil = data[id];
  const destino = perfil?.chat_id || CHAT_ID;

  const res = await apiTelegram('sendPhoto', {
    chat_id: destino,
    photo,
    caption,
    reply_markup: tecladoTelegram(id)
  });

  if (!res || !res.ok) {
    await apiTelegram('sendMessage', {
      chat_id: destino,
      text: caption,
      reply_markup: tecladoTelegram(id)
    });
  }

  return !!(res && res.ok);
}

function esImagenBase64(valor) {
  return typeof valor === 'string' && valor.startsWith('data:image/');
}

function bufferDesdeBase64(valor) {
  const limpio = String(valor || '').replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(limpio, 'base64');
}

async function enviarBufferComoFoto(buffer, caption, id, filename = 'ultimo_bump.jpg') {
  const data = leerData();
  const perfil = data[id];
  const destino = perfil?.chat_id || CHAT_ID;

  if (!FormData) {
    await enviarTexto('⚠️ Falta form-data. Corre: npm install form-data', destino, id);
    return false;
  }

  const form = new FormData();
  form.append('chat_id', String(destino));
  form.append('caption', caption);
  form.append('reply_markup', JSON.stringify(tecladoTelegram(id)));
  form.append('photo', buffer, {
    filename,
    contentType: 'image/jpeg'
  });

  const res = await apiTelegramForm('sendPhoto', form);

  if (res && res.ok) return true;

  await apiTelegram('sendMessage', {
    chat_id: destino,
    text: caption,
    reply_markup: tecladoTelegram(id)
  });

  return false;
}

async function enviarFotoFlexible(photo, caption, id) {
  if (esImagenBase64(photo)) {
    try {
      const buffer = bufferDesdeBase64(photo);
      return await enviarBufferComoFoto(buffer, caption, id, `ultimo_bump_${id}.jpg`);
    } catch (e) {
      console.log('No se pudo enviar foto base64:', e.message);
      return false;
    }
  }

  return await enviarFoto(photo, caption, id);
}

// =========================
// ESTADOS
// =========================
function cambiarEstadoPerfil(id, estado) {
  const data = leerData();
  if (!data[id]) return false;

  asegurarPerfil(data, id);

  if (estado === 'PAUSADA' && Array.isArray(colaReanudacion)) {
    colaReanudacion = colaReanudacion.filter(x => String(x) !== String(id));
  }

  data[id].estado = estado;
  data[id].ultima_hora = horaActual();
  data[id].ultima_accion = estado === 'ACTIVA' ? 'Reanudado' : 'Pausado';

  return guardarData(data);
}

function cambiarEstadoTodos(estado) {
  if (estado === 'PAUSADA') {
    cancelarColaReanudacion();
  }

  const data = leerData();

  for (const id of Object.keys(data)) {
    asegurarPerfil(data, id);
    data[id].estado = estado;
    data[id].ultima_hora = horaActual();
    data[id].ultima_accion =
      estado === 'ACTIVA' ? 'Reanudado globalmente' : 'Pausado globalmente';
  }

  guardarData(data);
}

function resetearAccesoPerfil(id) {
  const data = leerData();
  if (!data[id]) return null;

  asegurarPerfil(data, id);

  const nuevoToken = generarTokenAcceso();

  data[id].cliente_token = nuevoToken;
  data[id].estado = 'PAUSADA';

  // LIMPIEZA COMPLETA PARA CLIENTE NUEVO
  data[id].telefono = '';
  data[id].codigo = '';
  data[id].ubicacion = '';
  data[id].texto = '';

  // BORRAR FOTOS VIEJAS
  data[id].foto_modelo = 'https://picsum.photos/400/260';
  data[id].foto_pagina = 'https://picsum.photos/420/280';
  data[id].foto_bump = '';
  data[id].historial_fotos = [];

  // RESETEAR CONTADORES
  data[id].bump_hoy = 0;
  data[id].bump_total = 0;
  data[id].bump_fecha = '';
  data[id].proximo_post = '16m';
  data[id].proximo_post_ts = null;

  // LIMPIAR EVENTOS
  data[id].ultimo_evento = null;
  data[id].ultima_hora = horaActual();
  data[id].ultima_accion = `Acceso reseteado y perfil limpiado. Nueva clave: ${nuevoToken}`;

  const ok = guardarData(data);

  if (!ok) return null;

  return nuevoToken;
}

function limpiarProgramacionesPerfil(id) {
  const state = leerState();

  if (!Array.isArray(state.schedules)) {
    state.schedules = [];
  }

  const antes = state.schedules.length;

  state.schedules = state.schedules.filter(item => {
    return String(item.id) !== String(id);
  });

  const borradas = antes - state.schedules.length;

  if (borradas > 0) {
    guardarState(state);
  }

  return borradas;
}

function borrarPerfil(id) {
  const data = leerData();

  if (!data[id]) return false;

  // Quitar de la cola de reanudación si estaba pendiente
  if (Array.isArray(colaReanudacion)) {
    colaReanudacion = colaReanudacion.filter(x => String(x) !== String(id));

    if (colaReanudacion.length === 0) {
      cancelarColaReanudacion();
    }
  }

  // Borrar programaciones pendientes de ese perfil
  limpiarProgramacionesPerfil(id);

  // Borrar perfil completo del data.json
  delete data[id];

  return guardarData(data);
}

function programarAccion(id, accion, minutos = 30) {
  const state = leerState();
  state.schedules.push({
    id,
    accion,
    ejecutarEn: Date.now() + minutos * 60 * 1000
  });
  guardarState(state);
}

// =========================
// MENSAJES
// =========================
async function enviarEstadoPerfil(id) {
  const data = leerData();
  const perfil = data[id];
  if (!perfil) return;

  const caption = `🔥 jean calos BOT 🔥

Perfil: ${perfil.nombre}
📞 Teléfono: ${perfil.telefono}
🆔 Código: ${perfil.codigo}
📍 Ubicación: ${perfil.ubicacion}
🟢 Estado: ${perfil.estado}
🕒 Hora: ${perfil.ultima_hora}
⏱ Próximo bump: ${tiempoProximoPost(perfil)}
📅 Tiempo para acabar plan: ${tiempoRestantePlan(perfil.fin_plan)}
📊 Bump hoy: ${perfil.bump_hoy || 0}
📈 Bump total: ${perfil.bump_total || 0}`;

  await enviarFoto(perfil.foto_modelo, caption, id);
}

async function enviarUltimaActualizacion(id) {
  const data = leerData();
  const perfil = data[id];
  if (!perfil) return;

  const caption = `🔥 ÚLTIMO BUMP
🐺 Los lobos del sistema te desean mucho éxito
💰 Que esta publicación te genere mucho dinero
🚀 Y que la próxima te deje aún más ganancias
📄 Información:

📞 Número: ${perfil.telefono}
🆔 Código: ${perfil.codigo}
📍 Ubicación: ${perfil.ubicacion}
📝 Texto: ${perfil.texto || 'N/A'}
🟢 Estado: ${perfil.estado}
🕒 Hora del bump: ${perfil.ultima_hora}
⏱ Tiempo para próximo bump: ${tiempoProximoPost(perfil)}
📅 Tiempo para acabar plan: ${tiempoRestantePlan(perfil.fin_plan)}

📊 Bump hoy: ${perfil.bump_hoy || 0}
📈 Bump total: ${perfil.bump_total || 0}`;

  if (perfil.foto_bump) {
    const ok = await enviarFotoFlexible(perfil.foto_bump, caption, id);
    if (ok) return;
  }

  await enviarFoto(perfil.foto_modelo, caption, id);
}

async function enviarFotoPagina(id) {
  const data = leerData();
  const perfil = data[id];
  if (!perfil) return;

  const caption = `📸 Foto guardada

📞 Número: ${perfil.telefono}
🆔 Código: ${perfil.codigo}`;

  await enviarFoto(perfil.foto_pagina, caption, id);
}

async function enviarUltimasFotos(id, cantidad) {
  const data = leerData();
  const perfil = data[id];
  if (!perfil) return;

  const fotos = Array.isArray(perfil.historial_fotos) ? perfil.historial_fotos : [];

  if (fotos.length === 0) {
    await enviarTexto(`⚠️ No hay fotos guardadas para el perfil ${id}`);
    return;
  }

  const lista = fotos.slice(0, cantidad);

  for (let i = 0; i < lista.length; i++) {
    await enviarFoto(lista[i], `📂 Foto ${i + 1} de ${lista.length}`, id);
  }
}

async function enviarAlbumCompleto(id) {
  const data = leerData();
  const perfil = data[id];
  if (!perfil) return;

  const destino = perfil?.chat_id || CHAT_ID;
  const fotos = Array.isArray(perfil.historial_fotos) ? perfil.historial_fotos : [];

  if (fotos.length === 0) {
    await enviarTexto(`⚠️ No hay fotos guardadas para el perfil ${id}`, destino, id);
    return;
  }

  const lista = fotos.filter(Boolean).slice(0, 10);

  if (lista.length === 1) {
    await enviarFoto(lista[0], `🗂 Álbum completo\nFoto 1 de 1`, id);
    return;
  }

  const media = lista.map((foto, index) => ({
    type: 'photo',
    media: foto,
    caption: index === 0 ? `🗂 Álbum completo\n${lista.length} fotos guardadas` : undefined
  }));

  const res = await apiTelegram('sendMediaGroup', {
    chat_id: destino,
    media
  });

  if (!res || !res.ok) {
    await enviarUltimasFotos(id, 10);
    return;
  }

  await enviarTexto('🗂 Álbum completo enviado.', destino, id);
}

async function enviarReglas(chatId = CHAT_ID) {
  await enviarTexto(RULES_TEXT, chatId);
}

// =========================
// API LOCAL
// =========================
app.get('/api/licencia/:id', (req, res) => {
  try {
    const id = req.params.id;
    const token = req.query.token || '';

    const data = leerData();
    const perfil = data[id];

    if (!perfil) {
      return res.json({
        ok: false,
        estado: 'NO_EXISTE',
        motivo: 'Perfil no existe'
      });
    }

    if (perfil.cliente_token && token !== perfil.cliente_token) {
      return res.json({
        ok: false,
        estado: 'TOKEN_INVALIDO',
        motivo: 'Token inválido'
      });
    }

    if (perfil.estado === 'PAUSADA') {
      return res.json({
        ok: false,
        estado: 'PAUSADA',
        motivo: 'Cliente pausado desde el panel'
      });
    }

    if (planVencido(perfil)) {
      return res.json({
        ok: false,
        estado: 'VENCIDA',
        motivo: 'Plan vencido'
      });
    }

    return res.json({
      ok: true,
      estado: 'ACTIVA',
      motivo: 'Licencia activa'
    });
  } catch (error) {
    console.log('Error en /api/licencia/:id =>', error?.message || error);

    return res.json({
      ok: false,
      estado: 'ERROR',
      motivo: 'Error verificando licencia'
    });
  }
});

app.get('/api/estado/:id', (req, res) => {
  try {
    const data = leerData();
    const perfil = data[req.params.id];

    if (!perfil) {
      return res.json({
        estado: 'NO_EXISTE',
        motivo: 'Perfil no existe'
      });
    }

    if (perfil.estado === 'PAUSADA') {
      return res.json({
        estado: 'PAUSADA',
        motivo: 'Pausada por orden explícita del panel'
      });
    }

    return res.json({
      estado: 'ACTIVA',
      motivo: 'Modo seguro: solo se pausa por orden explícita'
    });
  } catch (error) {
    console.log('Error en /api/estado/:id =>', error?.message || error);

    return res.json({
      estado: 'ERROR',
      motivo: 'Fallo del panel/lectura'
    });
  }
});

app.post('/registrar-evento', async (req, res) => {
  const {
    id,
    tipo = 'silencioso',
    telefono,
    codigo,
    ubicacion,
    texto,
    foto_modelo,
    foto_pagina,
    foto_bump,
    foto_bump_base64,
    fotos_pagina,
    fin_plan,
    ultima_accion,
    ultima_hora,
    minutos_siguientes = 16
  } = req.body;

  if (!id) {
    return res.status(400).json({ ok: false, error: 'Falta id' });
  }

  const tipoNormal = String(tipo || 'silencioso').trim().toLowerCase();

  const data = leerData();

  if (!Object.prototype.hasOwnProperty.call(data, id)) {
    return res.status(404).json({
      ok: false,
      error: 'Perfil no registrado'
    });
  }

  const perfil = data[id];

  if (!tokenValidoParaPerfil(req, perfil)) {
    return res.status(403).json({
      ok: false,
      estado: 'TOKEN_INVALIDO',
      error: 'Token inválido para registrar evento'
    });
  }

  if (telefono) perfil.telefono = telefono;
  if (codigo) perfil.codigo = codigo;
  if (ubicacion) perfil.ubicacion = ubicacion;
  if (typeof texto === 'string') perfil.texto = texto;

  // IMPORTANTE:
  // /registrar-evento NO puede cambiar estado.
  // Solo el panel/botones pueden poner ACTIVA o PAUSADA.

  if (foto_modelo) perfil.foto_modelo = foto_modelo;
  if (foto_pagina) perfil.foto_pagina = foto_pagina;

  const pruebaBump = foto_bump_base64 || foto_bump;
  if (pruebaBump && typeof pruebaBump === 'string') {
    perfil.foto_bump = pruebaBump;
  }

  if (Array.isArray(fotos_pagina)) {
    const fotosLimpias = fotos_pagina
      .filter(foto => foto && typeof foto === 'string')
      .slice(0, 10);

    if (fotosLimpias.length >= 3) {
      perfil.historial_fotos = fotosLimpias;
      perfil.foto_pagina = fotosLimpias[0] || perfil.foto_pagina;
      perfil.foto_modelo = fotosLimpias[0] || perfil.foto_modelo;
    } else if (
      fotosLimpias.length === 1 &&
      (!Array.isArray(perfil.historial_fotos) || perfil.historial_fotos.length === 0)
    ) {
      perfil.historial_fotos = fotosLimpias;
      perfil.foto_pagina = fotosLimpias[0];
      perfil.foto_modelo = fotosLimpias[0];
    }
  }

  if (fin_plan) perfil.fin_plan = convertirFinPlan(fin_plan);

  perfil.ultima_hora = ultima_hora || horaActual();
  perfil.ultima_accion = ultima_accion || tipoNormal;
  perfil.ultimo_evento = { tipo: tipoNormal, hora: perfil.ultima_hora };

  let contarBump = false;

  if (tipoNormal === 'publicado') {
    if (puedeContarBump(perfil)) {
      contarBump = true;

      resetBumpSiCambioDia(perfil);
      perfil.bump_hoy = (perfil.bump_hoy || 0) + 1;
      perfil.bump_total = (perfil.bump_total || 0) + 1;
      perfil.bump_fecha = fechaHoy();
      perfil.proximo_post_ts = Date.now() + Number(minutos_siguientes) * 60 * 1000;
      perfil.proximo_post = tiempoProximoPost(perfil);
      perfil.ultima_accion = ultima_accion || 'Publicado con éxito';
    } else {
      perfil.ultima_accion = `Publicado ignorado: perfil ${perfil.estado}${planVencido(perfil) ? ' / vencido' : ''}`;
      perfil.ultimo_evento = {
        tipo: 'publicado_ignorado',
        hora: perfil.ultima_hora,
        motivo: perfil.estado === 'PAUSADA' ? 'PAUSADA' : (planVencido(perfil) ? 'VENCIDA' : 'BLOQUEADO')
      };
    }
  }

  const ok = guardarData(data);

  if (!ok) {
    return res.status(500).json({ ok: false, error: 'No se pudo guardar data.json' });
  }

  if (contarBump) {
    await enviarUltimaActualizacion(id);
  }

  res.json({
    ok: true,
    tipo: tipoNormal,
    bump_contado: contarBump,
    perfil: data[id]
  });
});

// =========================
// TELEGRAM CALLBACKS
// =========================
async function procesarCallback(q) {
  const data = q.data || '';
  const callbackId = q.id;
  const chatId = q.message?.chat?.id || CHAT_ID;

  if (data === 'pausar_todas') {
    cancelarColaReanudacion();
    cambiarEstadoTodos('PAUSADA');
    await responderCallback(callbackId, 'Todas pausadas');
    await enviarTexto('⏸ Todas las páginas quedaron en PAUSADA. Cola cancelada.', chatId);
    return;
  }

  if (data === 'reanudar_todas') {
    reanudarTodasEnCola();
    await responderCallback(callbackId, 'Reanudando en cola');
    await enviarTexto('▶️ Reanudando todas en cola cada 45 segundos.', chatId);
    return;
  }

  if (data === 'reglas') {
    await responderCallback(callbackId, 'Reglas');
    await enviarReglas(chatId);
    return;
  }

  const [accion, id] = data.split('_');
  if (!id) {
    await responderCallback(callbackId, 'Acción inválida');
    return;
  }

  if (accion === 'pausar') {
    cambiarEstadoPerfil(id, 'PAUSADA');
    await responderCallback(callbackId, 'Perfil pausado');
    await enviarEstadoPerfil(id);
    return;
  }

  if (accion === 'reanudar') {
    cambiarEstadoPerfil(id, 'ACTIVA');
    await responderCallback(callbackId, 'Perfil reanudado');
    await enviarEstadoPerfil(id);
    return;
  }

  if (accion === 'progpausa') {
    programarAccion(id, 'PAUSADA', 30);
    await responderCallback(callbackId, 'Pausa programada');
    await enviarTexto(`⏰ Se programó una pausa para el perfil ${id} en 30 minutos.`, chatId);
    return;
  }

  if (accion === 'progreanudar') {
    programarAccion(id, 'ACTIVA', 30);
    await responderCallback(callbackId, 'Reanudación programada');
    await enviarTexto(`⏰ Se programó una reanudación para el perfil ${id} en 30 minutos.`, chatId);
    return;
  }

  if (accion === 'ultima') {
    await responderCallback(callbackId, 'Último bump');
    await enviarUltimaActualizacion(id);
    return;
  }

  if (accion === 'foto') {
    await responderCallback(callbackId, 'Foto enviada');
    await enviarFotoPagina(id);
    return;
  }

  if (accion === 'album') {
    await responderCallback(callbackId, 'Enviando álbum completo...');
    await enviarAlbumCompleto(id);
    return;
  }

  if (accion === 'reiniciar') {
    const ok = cambiarEstadoPerfil(id, 'ACTIVA');
    await responderCallback(callbackId, ok ? 'Bot reiniciado' : 'No encontrado');
    if (ok) {
      await enviarTexto(`🔄 Perfil ${id} reiniciado y puesto en ACTIVA.`, chatId);
      await enviarEstadoPerfil(id);
    }
    return;
  }

  await responderCallback(callbackId, 'No manejado');
}

async function revisarTelegram() {
  if (telegramEnProceso) return;
  telegramEnProceso = true;

  try {
    const state = leerState();

    const updates = await apiTelegram('getUpdates', {
      offset: state.offset + 1,
      timeout: 10
    });

    if (!updates || !updates.ok || !Array.isArray(updates.result)) {
      return;
    }

    for (const u of updates.result) {
      state.offset = u.update_id;

      if (u.callback_query) {
        await procesarCallback(u.callback_query);
      }

      if (u.message) {
        const msg = u.message;
        const chatId = msg.chat?.id || CHAT_ID;

        if (msg.text) {
          const texto = msg.text.trim().toUpperCase();

          if (/^P\d+$/.test(texto)) {
            const id = texto.replace('P', '');
            const data = leerData();
            asegurarPerfil(data, id);
            guardarData(data);

            state.esperandoFoto = id;
            guardarState(state);

            await enviarTexto(`📸 Ahora envía la foto para el perfil ${id}`, chatId);
          }
        }

        if (msg.photo) {
          const id = state.esperandoFoto;

          if (!id) {
            await enviarTexto('⚠️ Primero escribe P + número. Ejemplo: P15', chatId);
            continue;
          }

          const data = leerData();
          asegurarPerfil(data, id);

          const fileId = msg.photo[msg.photo.length - 1].file_id;

          data[id].foto_modelo = fileId;
          data[id].foto_pagina = fileId;

          if (!Array.isArray(data[id].historial_fotos)) {
            data[id].historial_fotos = [];
          }

          data[id].historial_fotos.unshift(fileId);
          data[id].historial_fotos = data[id].historial_fotos.slice(0, 10);

          data[id].ultima_hora = horaActual();
          data[id].ultima_accion = 'Foto guardada desde Telegram';

          guardarData(data);

          state.esperandoFoto = null;
          guardarState(state);

          await enviarTexto(`✅ Foto guardada para perfil ${id}`, chatId);
          await enviarFotoPagina(id);
        }
      }
    }

    guardarState(state);
  } catch (error) {
    console.log('Error en revisarTelegram:', error?.message || error);
  } finally {
    telegramEnProceso = false;
  }
}

async function ejecutarProgramaciones() {
  const state = leerState();

  if (!state || typeof state !== 'object') {
    console.error('[CQ2] Estado de programaciones invalido');
    return;
  }

  if (!Array.isArray(state.schedules)) {
    console.error('[CQ2] Programaciones invalidas. No se modificaron los datos.');
    return;
  }
  const pendientes = [];
  let cambio = false;

  for (const item of state.schedules) {
    if (Date.now() >= item.ejecutarEn) {
      cambio = true;
      cambiarEstadoPerfil(item.id, item.accion);
      await enviarTexto(
        `⏰ Programación ejecutada\nPerfil: ${item.id}\nNuevo estado: ${item.accion}`
      );
      await enviarEstadoPerfil(item.id);
    } else {
      pendientes.push(item);
    }
  }

  if (cambio) {
    state.schedules = pendientes;
    guardarState(state);
  }
}

// =========================
// PANEL WEB
// =========================

// CQ2_RUTAS_ADMIN_PROTEGIDAS_V1

// El panel original pertenece exclusivamente al administrador.
// Las rutas publicas del script y el portal del cliente
// mantienen sus propios controles de acceso.

const cq2RutasPrivadas = new Set([
  '/',
  '/nuevo',
  '/guardar-perfil',
  '/accion',
  '/accion-global'
]);

function cq2EsRutaPrivada(req) {
  const ruta = req.path;

  return cq2RutasPrivadas.has(ruta) ||
    /^\/editar\/[^/]+\/?$/.test(ruta);
}

app.use((req, res, next) => {
  if (!cq2EsRutaPrivada(req)) {
    return next();
  }

  // No aceptar una cuenta de cliente como administrador.
  if (req.admin !== true) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect('/login');
    }

    return res.status(403).json({
      ok: false,
      error: 'Acceso exclusivo del administrador'
    });
  }

  // Los cambios deben proceder del propio sitio.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origen = req.get('origin');

    const esperado =
      (req.get('x-forwarded-proto') || req.protocol) +
      '://' + req.get('host');

    if (origen && origen !== esperado) {
      return res.status(403).json({
        ok: false,
        error: 'Origen no permitido'
      });
    }
  }

  next();
});

// FIN CQ2_RUTAS_ADMIN_PROTEGIDAS_V1
const cq2RenderOriginal = (req, res) => {
  const data = req.cliente
    ? JSON.parse(fs.readFileSync(
        path.join(
          require('./clientes_store').carpetaCliente(req.cliente.id),
          'data.json'
        ), 'utf8'))
    : leerData();
  let html = `
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>PANEL PRO</title>
    <style>
      body { background:#0b1c2c; color:white; font-family:Arial,sans-serif; margin:0; padding:20px; }
      h1, h2 { margin-top:0; }
      .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }
      .card { background:#132f4c; padding:20px; border-radius:14px; }
      .row { margin:6px 0; }
      .estado { font-weight:bold; }
      button, .btn {
        margin:6px 6px 0 0; padding:10px 14px; border:none; border-radius:10px;
        cursor:pointer; font-weight:bold; text-decoration:none; display:inline-block;
      }
      .danger { background:#c62828; color:white; }
      .success { background:#2e7d32; color:white; }
      .info { background:#1565c0; color:white; }
      .muted { background:#455a64; color:white; }
      .warning { background:#ef6c00; color:white; }
      .small { font-size:12px; opacity:.9; }
      input, textarea, select {
        width:100%; padding:10px; border-radius:8px; border:none; margin-top:4px; margin-bottom:12px;
      }
      label { font-weight:bold; }
      .form-box { max-width:700px; background:#132f4c; padding:20px; border-radius:14px; }
    </style>
  </head>
  <body>
    <h1>🐺 PANEL PRO 🐺</h1>
    <div style="margin-bottom:16px;">
      <button class="danger" onclick="accionGlobal('pausar_todas')">⏸ Pausar todas</button>
      <button class="success" onclick="accionGlobal('reanudar_todas')">▶️ Reanudar todas</button>
      <a class="btn warning" href="/nuevo">➕ Nuevo perfil</a>
       <a class="btn" href="/administracion" style="background:#7c3aed;color:white;">⚙️ Administración de clientes</a>
    </div>
    <div class="grid">
  `;

  for (const id of Object.keys(data)) {
    const p = data[id];
    const totalFotos = Array.isArray(p.historial_fotos) ? p.historial_fotos.length : 0;

    html += `
      <div class="card">
        <div class="row"><strong>${p.nombre}</strong></div>
        <div class="row">🆔 Perfil: ${id}</div>
        <div class="row">💬 Chat ID: ${p.chat_id || 'N/A'}</div>
        <div class="row">🔑 Cliente token: ${p.cliente_token || 'SIN CLAVE'}</div>
        <div class="row">📞 ${p.telefono || 'N/A'}</div>
        <div class="row">🆔 Código: ${p.codigo || 'N/A'}</div>
        <div class="row">📍 ${p.ubicacion || 'N/A'}</div>
        <div class="row estado">🟢 ${p.estado}</div>
        <div class="row">🕒 ${p.ultima_hora}</div>
        <div class="row">⏱ Próximo bump: ${p.proximo_post_ts ? tiempoRestante(p.proximo_post_ts) : (p.proximo_post || 'N/A')}</div>
        <div class="row">📅 ${tiempoRestantePlan(p.fin_plan)}</div>
        <div class="row">📊 Bump hoy: ${p.bump_hoy || 0}</div>
        <div class="row">📈 Bump total: ${p.bump_total || 0}</div>
        <div class="row">🖼 Historial fotos: ${totalFotos}</div>
        <div class="row small">Última acción: ${p.ultima_accion || 'N/A'}</div>

        <button class="danger" onclick="accionPerfil('${id}','pausar')">⏸ Pausar</button>
        <button class="success" onclick="accionPerfil('${id}','reanudar')">▶️ Reanudar</button>
        <button class="warning" onclick="accionPerfil('${id}','resetacceso')">🔐 Resetear acceso</button>
        <button class="muted" onclick="accionPerfil('${id}','progpausa')">⏰ Programar pausa</button>
        <button class="muted" onclick="accionPerfil('${id}','progreanudar')">⏰ Programar reanudar</button>
        <button class="info" onclick="accionPerfil('${id}','ultima')">🕒 Último bump</button>
        <button class="info" onclick="accionPerfil('${id}','foto')">📸 Ver foto</button>
        <button class="muted" onclick="accionPerfil('${id}','reiniciar')">🔄 Reiniciar bot</button>
        <a class="btn warning" href="/editar/${id}">✏️ Editar</a>
        <button class="danger" onclick="accionPerfil('${id}','borrarperfil')">🗑️ Borrar perfil</button>
      </div>
    `;
  }

  html += `
    </div>
    <script>
      setInterval(() => {
        location.reload();
      }, 10000);

      async function accionPerfil(id, accion) {
        if (accion === 'resetacceso') {
          const ok = confirm('¿Seguro que quieres resetear este perfil? Se borrarán fotos, datos viejos, contadores y la clave vieja dejará de funcionar.');
          if (!ok) return;
        }

        if (accion === 'borrarperfil') {
          const ok = confirm('¿Seguro que quieres BORRAR este perfil completo? Esta acción no se puede deshacer.');
          if (!ok) return;

          const ok2 = confirm('Última confirmación: se borrará el perfil, fotos, datos, token y programaciones pendientes.');
          if (!ok2) return;
        }

        await fetch('/accion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, accion })
        });
        location.reload();
      }

      async function accionGlobal(accion) {
        await fetch('/accion-global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion })
        });
        location.reload();
      }
    </script>
  </body>
  </html>
  `;

    // CQ2_UN_PANEL_RENDER_PRIVADO_V1
  if (req.cliente) {
    const csrf = String(req.csrfCliente || '');

    html = html.replace(
      /<a[^>]*href="\/administracion"[^>]*>[\s\S]*?<\/a>/gi,
      ''
    );

    if (!req.cq2AdminVista) {
      html = html.replace(
        /href="\/nuevo"/g,
        'href="/cliente/nuevo"'
      );

      html = html.replace(
        /href="\/editar\/([^"]+)"/g,
        'href="/cliente/editar/$1"'
      );

      html = html.replace(
        /fetch\('\/accion'/g,
        "fetch('/cliente/accion'"
      );

      html = html.replace(
        /fetch\('\/accion-global'/g,
        "fetch('/cliente/accion-global'"
      );

      html = html.replace(
        'JSON.stringify({ id, accion })',
        'JSON.stringify({ id, accion, _csrf: ' +
        JSON.stringify(csrf) + ' })'
      );

      html = html.replace(
        'JSON.stringify({ accion })',
        'JSON.stringify({ accion, _csrf: ' +
        JSON.stringify(csrf) + ' })'
      );

      html = html.replace(
        /<\/body>/i,
        '<div style="position:fixed;right:14px;top:14px;z-index:9999"><a href="/cliente/salir" ' +
        'style="background:#b91c1c;color:white;padding:12px;' +
        'border-radius:8px;text-decoration:none">' +
        'Cerrar sesión</a></div></body>'
      );
    }
  }  res.send(html);
};

// Reutilizar el mismo motor de renderizado.
app.locals.cq2RenderOriginal = cq2RenderOriginal;
app.get('/', cq2RenderOriginal);
// FORM NUEVO PERFIL
app.get('/nuevo', (req, res) => {
  res.send(`
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Nuevo perfil</title>
    <style>
      body { background:#0b1c2c; color:white; font-family:Arial,sans-serif; margin:0; padding:20px; }
      input, textarea, select { width:100%; padding:10px; border-radius:8px; border:none; margin-top:4px; margin-bottom:12px; }
      label { font-weight:bold; }
      .form-box { max-width:700px; background:#132f4c; padding:20px; border-radius:14px; }
      button, a { padding:10px 14px; border:none; border-radius:10px; text-decoration:none; display:inline-block; }
      .success { background:#2e7d32; color:white; }
      .muted { background:#455a64; color:white; }
    </style>
  </head>
  <body>
    <h1>➕ Nuevo perfil</h1>
    <div class="form-box">
      <form method="POST" action="/guardar-perfil"><input type="hidden" name="_cq2_crear" value="1">
        <label>ID del perfil</label>
        <input name="id" required />

        <label>Nombre</label>
        <input name="nombre" />

        <label>Chat ID</label>
        <input name="chat_id" />

        <label>Cliente token / Clave de acceso</label>
        <input name="cliente_token" />

        <label>Teléfono</label>
        <input name="telefono" />

        <label>Código</label>
        <input name="codigo" />

        <label>Ubicación</label>
        <input name="ubicacion" />

        <label>Texto</label>
        <textarea name="texto"></textarea>

        <label>Estado</label>
        <select name="estado">
          <option value="ACTIVA">ACTIVA</option>
          <option value="PAUSADA">PAUSADA</option>
        </select>

        <label>Foto modelo (URL o file_id)</label>
        <input name="foto_modelo" />

        <label>Foto página (URL o file_id)</label>
        <input name="foto_pagina" />

        <label>Próximo post</label>
        <input name="proximo_post" value="16m" />

        <label>Fin de plan</label>
        <input name="fin_plan" value="7 días" />

        <button class="success" type="submit">Guardar perfil</button>
        <a class="muted" href="/">Volver</a>
      </form>
    </div>
  </body>
  </html>
  `);
});

// FORM EDITAR PERFIL
app.get('/editar/:id', (req, res) => {
  const data = leerData();
  const id = req.params.id;

  if (!data[id]) {
    return res.status(404).send('Perfil no encontrado');
  }

  const p = data[id];

  res.send(`
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Editar perfil ${id}</title>
    <style>
      body { background:#0b1c2c; color:white; font-family:Arial,sans-serif; margin:0; padding:20px; }
      input, textarea, select { width:100%; padding:10px; border-radius:8px; border:none; margin-top:4px; margin-bottom:12px; }
      label { font-weight:bold; }
      .form-box { max-width:700px; background:#132f4c; padding:20px; border-radius:14px; }
      button, a { padding:10px 14px; border:none; border-radius:10px; text-decoration:none; display:inline-block; }
      .success { background:#2e7d32; color:white; }
      .muted { background:#455a64; color:white; }
    </style>
  </head>
  <body>
    <h1>✏️ Editar perfil ${id}</h1>
    <div class="form-box">
      <form method="POST" action="/guardar-perfil">
        <input type="hidden" name="id" value="${id}" />

        <label>Nombre</label>
        <input name="nombre" value="${p.nombre || ''}" />

        <label>Chat ID</label>
        <input name="chat_id" value="${p.chat_id || ''}" />

        <label>Cliente token / Clave de acceso</label>
        <input name="cliente_token" value="${p.cliente_token || ''}" />

        <label>Teléfono</label>
        <input name="telefono" value="${p.telefono || ''}" />

        <label>Código</label>
        <input name="codigo" value="${p.codigo || ''}" />

        <label>Ubicación</label>
        <input name="ubicacion" value="${p.ubicacion || ''}" />

        <label>Texto</label>
        <textarea name="texto">${p.texto || ''}</textarea>

        <label>Estado</label>
        <select name="estado">
          <option value="ACTIVA" ${p.estado === 'ACTIVA' ? 'selected' : ''}>ACTIVA</option>
          <option value="PAUSADA" ${p.estado === 'PAUSADA' ? 'selected' : ''}>PAUSADA</option>
        </select>

        <label>Foto modelo (URL o file_id)</label>
        <input name="foto_modelo" value="${p.foto_modelo || ''}" />

        <label>Foto página (URL o file_id)</label>
        <input name="foto_pagina" value="${p.foto_pagina || ''}" />

        <label>Próximo post</label>
        <input name="proximo_post" value="${p.proximo_post || ''}" />

        <label>Fin de plan</label>
        <input name="fin_plan" value="${p.fin_plan || ''}" />

        <button class="success" type="submit">Guardar cambios</button>
        <a class="muted" href="/">Volver</a>
      </form>
    </div>
  </body>
  </html>
  `);
});

// GUARDAR PERFIL
app.post('/guardar-perfil', (req, res) => {
  const {
    id,
    nombre,
    chat_id,
    cliente_token,
    telefono,
    codigo,
    ubicacion,
    texto,
    estado,
    foto_modelo,
    foto_pagina,
    proximo_post,
    fin_plan
  } = req.body;

  if (!id) {
    return res.status(400).send('Falta ID');
  }

  const data = leerData();
  const propio = Object.prototype.hasOwnProperty.call(data,String(id));
  if ((req.body._cq2_crear === '1' || !propio) &&
      cq2IdExiste(String(id))) {
    return res.status(409).send('Este ID ya existe');
  }
  asegurarPerfil(data,id);

  data[id].nombre = nombre || `Perfil ${id}`;
  data[id].chat_id = chat_id || '';
  data[id].cliente_token = cliente_token || '';
  data[id].telefono = telefono || '';
  data[id].codigo = codigo || '';
  data[id].ubicacion = ubicacion || '';
  data[id].texto = texto || '';
  data[id].estado = estado || 'ACTIVA';
  data[id].foto_modelo = foto_modelo || data[id].foto_modelo || 'https://picsum.photos/400/260';
  data[id].foto_pagina = foto_pagina || data[id].foto_pagina || 'https://picsum.photos/420/280';
  data[id].proximo_post = proximo_post || '16m';
  data[id].fin_plan = convertirFinPlan(fin_plan || '7 días');
  data[id].ultima_hora = horaActual();
  data[id].ultimaAccion = 'Perfil editado desde panel';
  data[id].ultima_accion = 'Perfil editado desde panel';

  const ok = guardarData(data);

  if (!ok) {
    return res.status(500).send('No se pudo guardar el perfil');
  }

  res.redirect('/');
});

// =========================
// ACCIONES PANEL
// =========================
app.post('/accion', async (req, res) => {
  const { id, accion } = req.body;
  const data = leerData();

  if (!data[id]) {
    return res.status(404).send('Perfil no encontrado');
  }

  if (accion === 'pausar') {
    cambiarEstadoPerfil(id, 'PAUSADA');
    await enviarEstadoPerfil(id);
  } else if (accion === 'reanudar') {
    cambiarEstadoPerfil(id, 'ACTIVA');
    await enviarEstadoPerfil(id);
  } else if (accion === 'resetacceso') {
    const nuevoToken = resetearAccesoPerfil(id);

    if (nuevoToken) {
      await enviarTexto(`🔐 Acceso reseteado y perfil limpiado\nPerfil: ${id}\nNueva clave: ${nuevoToken}\nEstado: PAUSADA`);
    }
  } else if (accion === 'borrarperfil') {
    const ok = borrarPerfil(id);

    if (ok) {
      await enviarTexto(`🗑️ Perfil borrado correctamente\nPerfil eliminado: ${id}`);
    } else {
      await enviarTexto(`⚠️ No se pudo borrar el perfil ${id}`);
    }
  } else if (accion === 'progpausa') {
    programarAccion(id, 'PAUSADA', 30);
    await enviarTexto(`⏰ Se programó una pausa para ${data[id].nombre} en 30 minutos.`);
  } else if (accion === 'progreanudar') {
    programarAccion(id, 'ACTIVA', 30);
    await enviarTexto(`⏰ Se programó una reanudación para ${data[id].nombre} en 30 minutos.`);
  } else if (accion === 'ultima') {
    await enviarUltimaActualizacion(id);
  } else if (accion === 'foto') {
    await enviarFotoPagina(id);
  } else if (accion === 'reiniciar') {
    cambiarEstadoPerfil(id, 'ACTIVA');
    await enviarTexto(`🔄 ${data[id].nombre} reiniciado.`);
    await enviarEstadoPerfil(id);
  }

  res.redirect('/');
});

app.post('/accion-global', async (req, res) => {
  const { accion } = req.body;

  if (accion === 'pausar_todas') {
    cancelarColaReanudacion();
    cambiarEstadoTodos('PAUSADA');
    await enviarTexto('⏸ Todas las páginas quedaron en PAUSADA. Cola cancelada.');
  } else if (accion === 'reanudar_todas') {
    reanudarTodasEnCola();
    await enviarTexto('▶️ Reanudando todas en cola cada 45 segundos.');
  }

  res.redirect('/');
});

// =========================
// CICLO SEGURO
// =========================
async function procesarColaReanudacion(versionActiva) {
  if (versionActiva !== colaVersion) return;

  if (!colaReanudacion || colaReanudacion.length === 0) {
    cancelarColaReanudacion();
    return;
  }

  const id = colaReanudacion.shift();

  if (versionActiva !== colaVersion) return;

  cambiarEstadoPerfil(id, 'ACTIVA');
  await enviarTexto(`▶️ Perfil ${id} reanudado automáticamente en cola.`);
  await enviarEstadoPerfil(id);

  if (versionActiva !== colaVersion) return;

  if (colaReanudacion && colaReanudacion.length > 0) {
    colaTimeout = setTimeout(() => {
      procesarColaReanudacion(versionActiva);
    }, 45000);
  } else {
    cancelarColaReanudacion();
  }
}

function reanudarTodasEnCola() {
  cancelarColaReanudacion();

  const data = leerData();
  colaReanudacion = Object.keys(data);

  const versionActiva = colaVersion;

  if (colaReanudacion.length > 0) {
    procesarColaReanudacion(versionActiva);
  }
}

async function cicloPrincipal() {
  if (cicloEnProceso) {
    setTimeout(cicloPrincipal, 3002);
    return;
  }

  cicloEnProceso = true;

  try {
    await revisarTelegram();
    await ejecutarProgramaciones();
  } catch (error) {
    console.log('Error en cicloPrincipal:', error?.message || error);
  } finally {
    cicloEnProceso = false;
    setTimeout(cicloPrincipal, 3002);
  }
}

// =========================
// START
// =========================
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);

  if (!existeArchivoSeguro(DATA_FILE)) {
    guardarData({});
  }

  if (!existeArchivoSeguro(STATE_FILE)) {
    guardarState({
      offset: 0,
      schedules: [],
      esperandoFoto: null
    });
  }

  await apiTelegram('deleteWebhook', {});
  cicloPrincipal();
});
