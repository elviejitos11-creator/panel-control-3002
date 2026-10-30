/* CQ_REPARACION_CLIENTES_SEGURA_V3 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./clientes_store');
const cq2IdExiste = require('./cq2_id_unico');

const sesiones = new Map();

function esc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function pagina(titulo, contenido) {
  return `<!doctype html><html lang="es"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(titulo)}</title>
  <style>
  *{box-sizing:border-box}
  body{background:#0b1c2c;color:white;font-family:Arial,sans-serif;
  padding:20px;margin:0}
  main{max-width:850px;margin:auto}
  .card{background:#132f4c;padding:20px;border-radius:14px;margin:15px 0}
  input,select{display:block;width:100%;max-width:450px;
  padding:12px;margin:8px 0 15px;border-radius:8px;border:0}
  button,.btn{display:inline-block;border:0;border-radius:9px;
  background:#1565c0;color:white;padding:12px 17px;
  text-decoration:none;font-weight:bold;cursor:pointer;margin:4px}
  .danger{background:#b71c1c}
  .success{background:#2e7d32}
  small{color:#b8cee7}
  </style></head><body><main>${contenido}</main></body></html>`;
}

function archivoCliente(id) {
  return path.join(store.carpetaCliente(id),'data.json');
}

function leerPerfiles(id) {
  const archivo = archivoCliente(id);
  const datos = JSON.parse(fs.readFileSync(archivo,'utf8'));
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw Error('Datos invalidos');
  }
  return datos;
}

function guardarPerfiles(id, datos) {
  const archivo = archivoCliente(id);
  const temporal = archivo + '.tmp';
  fs.writeFileSync(temporal,JSON.stringify(datos,null,2),'utf8');
  fs.renameSync(temporal,archivo);
}

function cookie(req) {
  const entrada = String(req.headers.cookie || '')
    .split(';').find(x=>x.trim().startsWith('cq_cliente='));
  return entrada ? entrada.trim().slice(11) : '';
}

function clienteActual(req) {
  const token = cookie(req);
  const s = sesiones.get(token);
  if (!s || s.hasta <= Date.now()) return null;

  const c = store.listar().find(x=>x.id===s.id);
  if (!c || !c.activo || Date.parse(c.vencimiento)<=Date.now() || !s.claveHash || s.claveHash !== c.claveHash) {
    sesiones.delete(token);
    return null;
  }
  return c;
}

function exigirSesion(req,res,next) {
  const c = clienteActual(req);
  if (!c) return res.redirect('/login');

  if (req.method === 'POST') {
    const origen = req.headers.origin;
    const esperado = (req.get('x-forwarded-proto') || req.protocol)+'://'+req.get('host');
    if (origen && origen !== esperado) return res.sendStatus(403);
    if (req.body._csrf !== sesiones.get(cookie(req)).csrf) {
      return res.sendStatus(403);
    }
  }
  req.cliente = c;
  req.csrfCliente = sesiones.get(cookie(req)).csrf;
  next();
}

function campoCsrf(req) {
  return `<input type="hidden" name="_csrf" value="${esc(req.csrfCliente)}">`;
}


/* CQ_TELEGRAM_CLIENTES_V1 - INICIO */
async function cqNotificarClienteTelegram(perfil, cliente, accion) {
  const datos = leerPerfiles(cliente.id);
  const encontrado = Object.entries(datos).find(([id,p]) =>
    p.cliente_token === perfil.cliente_token
  );
  if (!encontrado) return false;
  return require('./jean_bot_cliente').enviar(
    cliente, encontrado[0], perfil, accion
  );
}
/* CQ_TELEGRAM_CLIENTES_V1 - FIN */

module.exports = function(app) {
  app.locals.cqClienteActual = clienteActual;
  app.get('/cliente/login',(req,res)=>{
    res.send(pagina('Acceso clientes',`
      <div class="card">
      <h1>🔥 PANEL PRO</h1>
      <h2>Acceso de clientes</h2>
      <form method="POST" action="/cliente/login">
      <label>Usuario<input name="usuario" required></label>
      <label>Contraseña<input type="password" name="clave" required></label>
      <button>Entrar</button>
      </form></div>`));
  });

  // CQ_LOGIN_UNICO_CLIENTES_V1
  function iniciarSesionCliente(req,res,c) {
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');

    const actual = store.listar().find(x => x.id === c.id);
    if (!actual || !actual.activo ||
        Date.parse(actual.vencimiento) <= Date.now()) {
      return res.status(401).redirect('/login');
    }

    sesiones.set(token,{
      id:c.id,
      csrf,
      claveHash:actual.claveHash,
      hasta:Date.now()+8*3600000
    });

    res.clearCookie('cq_admin',{path:'/'});
    res.cookie('cq_cliente',token,{
      httpOnly:true,
      sameSite:'strict',
      secure:req.secure || req.get('x-forwarded-proto')==='https',
      path:'/',
      maxAge:8*3600000
    });

    return res.redirect('/cliente');
  }
  // El mismo formulario admite usuarios de clientes.
  // Si no es cliente, conserva el login original del administrador.
  app.post('/cliente/login-compat',(req,res,next)=>{
    let c=null;
    try {
      c=store.autenticar(
        req.body.usuario,
        req.body.clave
      );
    } catch(e) {
      console.error('[CQ LOGIN CLIENTE]',e.message);
      return res.status(500).send('Error verificando cuenta');
    }

    if (!c) return next();

    return iniciarSesionCliente(req,res,c);
  });
  // CQ2_LOGIN_CLIENTES_EN_PANEL_PRINCIPAL_V1
  // Misma pantalla /login para administrador y clientes.
  // Si las credenciales son de un cliente, entra en su espacio.
  // Si no, continua con el login original del administrador.

  app.post('/login', (req, res, next) => {
    const usuario = String(req.body?.usuario || '');
    const clave = String(req.body?.clave || '');

    if (!usuario || !clave) {
      return next();
    }

    let cliente = null;

    try {
      cliente = store.autenticar(usuario, clave);
    } catch (error) {
      console.error('[CQ2 LOGIN CLIENTE]', error.message);
      return res.status(500).send(
        'Error verificando el acceso'
      );
    }

    if (!cliente) {
      return next();
    }

    return iniciarSesionCliente(req, res, cliente);
  });
  const fallos = new Map();

  app.post('/cliente/login',(req,res)=>{
    const ip = req.ip || 'local';
    const previo = fallos.get(ip) || {n:0,hasta:0};
    if (previo.hasta > Date.now()) {
      return res.status(429).send('Demasiados intentos. Intenta mas tarde.');
    }

    let c = null;
    try {
      c = store.autenticar(req.body.usuario,req.body.clave);
    } catch(e) {
      return res.sendStatus(500);
    }

    if (!c) {
      previo.n++;
      if (previo.n>=5) {
        previo.n=0;
        previo.hasta=Date.now()+15*60*1000;
      }
      fallos.set(ip,previo);
      return res.status(401).send(
        pagina('Acceso denegado',
          '<h2>Usuario o contraseña incorrectos</h2><a class="btn" href="/cliente/login">Volver</a>')
      );
    }

    fallos.delete(ip);
    return iniciarSesionCliente(req,res,c);
  });

  app.use('/cliente',exigirSesion);


  // CQ2_BORRADO_CLIENTE_FINAL_V1
  app.post('/cliente/cq-borrar-seguro',(req,res)=>{
    try {
      const id = String(req.body.id || '');
      const c = req.cliente;

      if (!c || !/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
          req.body.accion !== 'borrarperfil') {
        return res.sendStatus(400);
      }

      const archivo = archivoCliente(c.id);
      const datos = leerPerfiles(c.id);

      if (!Object.prototype.hasOwnProperty.call(datos,id)) {
        return res.sendStatus(404);
      }

      // Respaldo del cliente ANTES del borrado.
      const respaldo = archivo + '.before-delete-' +
        Date.now() + '.bak';

      fs.copyFileSync(archivo,respaldo);
      delete datos[id];
      guardarPerfiles(c.id,datos);

      return res.json({ok:true,borrado:id});
    } catch(error) {
      console.error('[CQ2 BORRADO CLIENTE]',error.message);
      return res.sendStatus(500);
    }
  });

  // CQ2_UN_PANEL_RUTAS_ORIGINALES_V1
  app.use('/cliente', (req,res,next) => {
    const ruta = req.path;
    const metodo = req.method.toLowerCase();

    let original = null;
    let parametro = null;

    if (metodo === 'get' && ruta === '/') {
      original = '/';
    } else if (metodo === 'get' && ruta === '/nuevo') {
      original = '/nuevo';
    } else if (metodo === 'get' &&
               /^\/editar\/[A-Za-z0-9_-]{1,40}$/.test(ruta)) {
      original = '/editar/:id';
      parametro = ruta.split('/')[2];
    } else if (metodo === 'post' &&
               ['/guardar-perfil','/accion','/accion-global']
                 .includes(ruta)) {
      original = ruta;
    } else {
      return next();
    }

    try {
      if (metodo === 'post') {
        const token = sesiones.get(cookie(req));
        if (!token ||
            !req.body ||
            req.body._csrf !== token.csrf) {
          return res.sendStatus(403);
        }

        if (original === '/guardar-perfil') {
          const id = String(req.body.id || '');

          if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
            return res.status(400).send('ID invalido');
          }

          const datos = leerPerfiles(req.cliente.id);
          const propio = Object.prototype.hasOwnProperty.call(datos,id);
          if ((req.body._cq2_crear === '1' || !propio) &&
              cq2IdExiste(id)) {
            return res.status(409).send('Este ID ya existe');
          }

          if (!Object.prototype.hasOwnProperty.call(datos,id) &&
              Object.keys(datos).length >= Number(req.cliente.limite)) {
            return res.status(403).send(
              'Limite de perfiles alcanzado'
            );
          }
        }

        if (original === '/accion') {
          const id = String(req.body.id || '');
          const accion = String(req.body.accion || '');

          if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
              ![
                'pausar','reanudar','resetacceso',
                'progpausa','progreanudar',
                'ultima','foto','reiniciar','borrarperfil'
              ].includes(accion)) {
            return res.sendStatus(400);
          }

          if (!Object.prototype.hasOwnProperty.call(
            leerPerfiles(req.cliente.id),id
          )) return res.sendStatus(404);
        }

        if (original === '/accion-global' &&
            !['pausar_todas','reanudar_todas']
              .includes(String(req.body.accion || ''))) {
          return res.sendStatus(400);
        }
      }

      const layer = app.router.stack.find(l =>
        l.route &&
        l.route.path === original &&
        l.route.methods[metodo]
      );

      if (!layer) {
        return res.status(500).send(
          'Ruta original no disponible'
        );
      }

      const ejecutar = layer.route.stack[0].handle;

      if (parametro) req.params = {id:parametro};

      const enviar = res.send.bind(res);
      const redirigir = res.redirect.bind(res);

      res.redirect = function(destino) {
        return redirigir(
          destino === '/' ? '/cliente' : destino
        );
      };

      res.send = function(html) {
        if (typeof html === 'string' &&
            /<form\b/i.test(html)) {
          html = html.replace(
            /action="\/guardar-perfil"/g,
            'action="/cliente/guardar-perfil"'
          );

          html = html.replace(
            /href="\/"/g,
            'href="/cliente"'
          );

          const csrfInput =
            '<input type="hidden" name="_csrf" value="' +
            String(req.csrfCliente) + '">';

          html = html.replace(
            /(<form\b[^>]*>)/gi,
            '$1' + csrfInput
          );
        }
        if (original === '/nuevo' && typeof html === 'string') {
          html = html.replace(
            /(<form[^>]*action="\/cliente\/guardar-perfil"[^>]*>)/i,
            '$1<input type="hidden" name="_cq2_crear" value="1">'
          );
        }
        return enviar(html);
      };

      return app.locals.cq2ConCliente(
        req.cliente,
        () => ejecutar(req,res,next)
      );

    } catch(e) {
      console.error('[CQ2 PANEL UNICO]',e.message);
      return res.status(500).send(
        'Error procesando el perfil'
      );
    }
  });
  // CQ_CONTROL_SESIONES_CLIENTES_V1
  app.get('/cliente/session-check',(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true});
  });

  app.get('/cliente/salir',(req,res)=>{
    const token = cookie(req);
    if(token) sesiones.delete(token);

    res.clearCookie('cq_cliente',{path:'/'});
    res.clearCookie('cq_cliente',{path:'/cliente'});
    return res.redirect('/login');
  });

  // Boton de salida y comprobacion automatica en vistas privadas.
  app.use('/cliente',(req,res,next)=>{
    if(req.method !== 'GET') return next();

    const enviar = res.send.bind(res);

    res.send = function(html) {
      if(typeof html !== 'string' ||
         !/<\/body>/i.test(html) ||
         html.includes('id="cq-cerrar-sesion-v1"')) {
        return enviar(html);
      }

      const controles = `
      <div id="cq-cerrar-sesion-v1"
           style="padding:12px;text-align:right">
        <a href="/cliente/salir"
           style="display:inline-block;background:#b91c1c;
                  color:white;padding:12px 18px;
                  border-radius:9px;text-decoration:none;
                  font:bold 15px Arial">
          Cerrar sesión
        </a>
      </div>
      <script>
      (function(){
        if(window.__cqSesionActivaV1)return;
        window.__cqSesionActivaV1=true;

        async function verificarSesion(){
          try{
            const r=await fetch('/cliente/session-check',{
              credentials:'same-origin',
              cache:'no-store',
              redirect:'follow'
            });
            const tipo=r.headers.get('content-type')||'';

            if(!r.ok || r.redirected ||
               !tipo.includes('application/json')){
              window.location.replace('/login');
              return;
            }

            const d=await r.json();
            if(!d.ok)window.location.replace('/login');
          }catch(e){
            // Un fallo temporal de red no elimina la sesion.
          }
        }

        verificarSesion();
        setInterval(verificarSesion,10000);
      })();
      </script>`;

      return enviar(html.replace(/<body([^>]*)>/i,
        function(m){return m+controles;}));
    };

    next();
  });


// CQ_AGENDA_V12_CORREGIDA

app.get('/cliente/agenda-datos', (req,res) => {
  const cqRutaEstadoAgenda12 = path.join(
    store.carpetaCliente(req.cliente.id),
    'bot_state.json'
  );
  try {
    const datos = JSON.parse(
      fs.readFileSync(cqRutaEstadoAgenda12, 'utf8')
    );
    const agenda = (Array.isArray(datos.schedules)
      ? datos.schedules : [])
      .filter(t =>
        t &&
        t.cliente_id === req.cliente.id &&
        Number.isFinite(Number(t.ejecutar)) &&
        Number(t.ejecutar) > Date.now()
      )
      .map(t => ({
        perfil:String(t.perfil_id || ''),
        todos:t.todos === true,
        estado:String(t.estado || ''),
        ejecutar:Number(t.ejecutar)
      }))
      .sort((a,b)=>a.ejecutar-b.ejecutar);
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,agenda});
  } catch(e) {
    console.error('[CQ AGENDA]',e.message);
    res.status(500).json({ok:false,error:"Error de agenda"});
  }
});

app.use('/cliente', (req,res,next) => {
  if(req.method !== 'GET' || req.path !== '/') return next();
  const enviar = res.send.bind(res);
  res.send = function(html) {
    if(typeof html !== 'string' || !/<\/body>/i.test(html))
      return enviar(html);
    if(html.includes('id="cq-agenda-v12"')) return enviar(html);
    const bloque = "<style>#cq-agenda-v12{background:#132f4d;color:#fff;padding:16px;border-radius:13px;margin:16px 0;border:1px solid #32618c}#cq-agenda-v12 h2{color:white;margin:0 0 12px}.cq-agenda-tarea{background:#1c4163;padding:12px;margin:8px 0;border-radius:9px}.cq-agenda-tarea small{display:block;color:#bddbf2}</style><section id=\"cq-agenda-v12\"><h2>? Programaciones activas</h2><div id=\"cq-agenda-lista\">Consultando...</div></section><script>(function(){\nif(window.__cqAgenda12)return;\nwindow.__cqAgenda12=true;\nconst lista=document.getElementById(\"cq-agenda-lista\");\nif(!lista)return;\nasync function actualizar(){\ntry{\nconst r=await fetch(\"/cliente/agenda-datos\",{\ncredentials:\"same-origin\",cache:\"no-store\"\n});\nif(!r.ok)throw Error(\"Consulta fallida\");\nconst d=await r.json();\nif(!d.ok)throw Error(\"Sin datos\");\nlista.replaceChildren();\nif(!d.agenda.length){\nlista.textContent=\"No hay programaciones pendientes.\";\nreturn;\n}\nfor(const t of d.agenda){\nconst caja=document.createElement(\"div\");\ncaja.className=\"cq-agenda-tarea\";\nconst titulo=document.createElement(\"strong\");\ntitulo.textContent=\n(t.estado===\"PAUSADA\"?\"? Pausar\":\"?? Reanudar\")\n+(t.todos?\" todas\":\" ? Perfil \"+t.perfil);\nconst fecha=document.createElement(\"div\");\nfecha.textContent=new Date(t.ejecutar).toLocaleString(\n\"es-DO\",{timeZone:\"America/Santo_Domingo\",\ndateStyle:\"medium\",timeStyle:\"short\"});\nconst tiempo=document.createElement(\"small\");\nconst minutos=Math.max(0,Math.ceil(\n(t.ejecutar-Date.now())/60000));\ntiempo.textContent=\"Faltan \"+minutos+\" minutos\";\ncaja.append(titulo,fecha,tiempo);\nlista.append(caja);\n}\n}catch(e){\nlista.textContent=\"No se pudo consultar la agenda.\";\n}\n}\nactualizar();\nsetInterval(actualizar,10000);\n})();</script>";
    return enviar(html.replace(/<\/body>/i,bloque+'</body>'));
  };
  next();
});


  
  // CQ_CLIENTE_ENSAMBLADO_V2
  app.get('/cliente', (req, res) => {
    try {
      if (typeof app.locals.cq2RenderOriginal !== 'function') {
        throw new Error('Motor original no disponible');
      }

      // La sesion ya fue validada por exigirSesion.
      // El motor original recibe el cliente autenticado.
      return app.locals.cq2RenderOriginal(req, res);
    } catch (error) {
      console.error('[CQ2 PANEL ORIGINAL]', error.message);
      return res.status(500).send('Error cargando panel del cliente');
    }
  });

  app.get('/cliente/cq-nuevo', (req, res) => {
    res.redirect('/cliente/formulario-original');
  });

  app.post('/cliente/cq-accion', (req, res) => {
    try {
      const c = req.cliente;
      const id = String(req.body.id || '');
      const accion = String(req.body.accion || '');
      const datos = leerPerfiles(c.id);

      if (!Object.prototype.hasOwnProperty.call(datos, id)) {
        return res.sendStatus(404);
      }

      if (accion === 'pausar' || accion === 'reanudar') {
        datos[id].estado =
          accion === 'pausar' ? 'PAUSADA' : 'ACTIVA';

        datos[id].ultima_hora = new Date().toISOString();
        datos[id].ultima_accion =
          accion === 'pausar' ? 'Pausado' : 'Reanudado';

        guardarPerfiles(c.id, datos);

        void cqNotificarClienteTelegram(
          datos[id], c, datos[id].ultima_accion
        );

        return res.redirect('/cliente');
      }

      return res.status(501).send(
        'Esta accion todavia requiere conectar su funcion original.'
      );
    } catch (e) {
      console.error('[CQ ACCION]', e.message);
      return res.sendStatus(500);
    }
  });


  app.get('/cliente/formulario-original',(req,res)=>{
    const c=req.cliente;
    const datos=leerPerfiles(c.id);
    const ids=Object.keys(datos);

    let contenido=`
      <h1>🔥 PANEL PRO — ${esc(c.nombre)}</h1>
      <p>Tu espacio privado</p>
      <p>Perfiles: ${ids.length} / ${c.limite}</p>
      <p>Licencia hasta: ${esc(c.vencimiento)}</p>
      <a class="btn" href="/cliente/salir">Cerrar sesión</a>
      <div class="card">
      <h2>➕ Nuevo perfil</h2>
      <form method="POST" action="/cliente/crear">
        ${campoCsrf(req)}
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
        <a class="muted" href="/cliente">Volver</a>
      </form></div>`;

    for(const id of ids) {
      const p=datos[id];
      contenido+=`
        <div class="card">
        <h2>${esc(p.nombre)}</h2>
        <p>ID: ${esc(id)}</p><p>Cliente ID: ${esc(c.id)}</p><p>Token del perfil: ${esc(p.cliente_token || "SIN TOKEN")}</p>
        <form method="POST" action="/cliente/estado">
        ${campoCsrf(req)}
        <input type="hidden" name="id" value="${esc(id)}">
        <select name="estado">
        <option value="ACTIVA" ${p.estado==='ACTIVA'?'selected':''}>ACTIVA</option>
        <option value="PAUSADA" ${p.estado==='PAUSADA'?'selected':''}>PAUSADA</option>
        </select>
        <button>Guardar estado</button>
        </form>
        <a href="/cliente/editar?id=${encodeURIComponent(id)}" style="display:inline-block;background:#f97316;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;margin:6px 4px">✏️ Editar</a>
<form method="POST" action="/cliente/borrar"
          onsubmit="return confirm('¿Eliminar este perfil?')">
        ${campoCsrf(req)}
        <input type="hidden" name="id" value="${esc(id)}">
        <button class="danger">Borrar perfil</button>
        </form></div>`;
    }

    res.send(pagina('Mis perfiles',contenido));
  });

  app.post('/cliente/crear',(req,res)=>{
    const c=req.cliente;
    const id=String(req.body.id||'').trim();
    const nombre=String(req.body.nombre||'').trim();

    if(!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || !nombre || nombre.length>100) {
      return res.status(400).send('Datos invalidos');
    }

    const datos=leerPerfiles(c.id);

    if (cq2IdExiste(id)) {
      return res.status(409).send('Perfil existente');
    }

    if(Object.keys(datos).length>=c.limite) {
      return res.status(403).send('Limite de perfiles alcanzado');
    }

        // CQ2_FORM_ORIGINAL_RESTAURADO_V1
    const campos = [
      'chat_id','cliente_token','telefono','codigo','ubicacion',
      'texto','estado','foto_modelo','foto_pagina',
      'proximo_post','fin_plan'
    ];
    const nuevo = {nombre};

    for (const campo of campos) {
      const valor = req.body[campo];
      if (valor !== undefined && typeof valor !== 'string') {
        return res.status(400).send('Dato invalido: ' + campo);
      }
      const maximo = campo === 'texto' ? 5000 : 500;
      if (String(valor || '').length > maximo) {
        return res.status(400).send('Campo demasiado largo: ' + campo);
      }
      nuevo[campo] = String(valor || '').trim();
    }

    if (nuevo.chat_id &&
        !/^-?[0-9]{5,20}$/.test(nuevo.chat_id)) {
      return res.status(400).send('Chat ID invalido');
    }

    if (!['ACTIVA','PAUSADA'].includes(nuevo.estado)) {
      return res.status(400).send('Estado invalido');
    }

    if (!nuevo.cliente_token) {
      nuevo.cliente_token = crypto.randomBytes(32).toString('hex');
    }

    nuevo.ultima_accion = 'Perfil creado';
    nuevo.ultima_hora = new Date().toISOString();
    nuevo.historial_fotos = [];
    nuevo.bump_hoy = 0;
    nuevo.bump_total = 0;

    datos[id] = nuevo;
    guardarPerfiles(c.id,datos);
    void cqNotificarClienteTelegram(
      datos[id],
      c,
      'PERFIL CREADO'
    );
    res.redirect('/cliente');
  });

  
/* CQ_EDICION_CLIENTES_V1 */

function cqEscapar(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/cliente/editar', (req, res) => {
  if (!req.cliente || !req.cliente.id) {
    return res.status(403).send('Acceso no autorizado');
  }

  const id = String(req.query.id || '');
  const datos = leerPerfiles(req.cliente.id);

  if (!Object.prototype.hasOwnProperty.call(datos, id)) {
    return res.status(404).send('Perfil no encontrado');
  }

  const p = datos[id];

  const campo = (titulo, nombre, valor) =>
    '<label style="display:block;margin-top:14px">' +
      '<b>' + cqEscapar(titulo) + '</b>' +
      '<input style="display:block;width:100%;box-sizing:border-box;' +
      'padding:12px;margin-top:6px" name="' +
      cqEscapar(nombre) + '" value="' +
      cqEscapar(valor) + '" />' +
    '</label>';

  const contenido =
    '<div class="card">' +
    '<h2>✏️ Editar perfil ' + cqEscapar(id) + '</h2>' +
    '<form method="POST" action="/cliente/guardar-edicion">' +
    campoCsrf(req) +
    '<input type="hidden" name="id" value="' +
      cqEscapar(id) + '">' +

    campo('Nombre', 'nombre', p.nombre) +
    campo('Chat ID', 'chat_id', p.chat_id) +
    campo('Telefono', 'telefono', p.telefono) +
    campo('Codigo', 'codigo', p.codigo) +
    campo('Ubicacion', 'ubicacion', p.ubicacion) +

    '<label style="display:block;margin-top:14px">' +
    '<b>Texto</b>' +
    '<textarea name="texto" rows="5" ' +
      'style="display:block;width:100%;box-sizing:border-box;' +
      'padding:12px;margin-top:6px">' +
    cqEscapar(p.texto) +
    '</textarea></label>' +

    '<p>El token del perfil se conserva sin cambios.</p>' +

    '<div style="margin-top:20px">' +
    '<button type="submit">Guardar cambios</button> ' +
    '<a href="/cliente">Volver</a>' +
    '</div></form></div>';

  return res.send(pagina('Editar perfil', contenido));
});

app.post('/cliente/guardar-edicion', (req, res) => {
  if (!req.cliente || !req.cliente.id) {
    return res.status(403).send('Acceso no autorizado');
  }

  const id = String(req.body.id || '');
  const datos = leerPerfiles(req.cliente.id);

  if (!Object.prototype.hasOwnProperty.call(datos, id)) {
    return res.status(404).send('Perfil no encontrado');
  }

  const campos = [
    'nombre',
    'chat_id',
    'telefono',
    'codigo',
    'ubicacion',
    'texto'
  ];

  const nuevos = {};

  for (const campo of campos) {
    if (typeof req.body[campo] !== 'string') {
      return res.status(400).send('Dato invalido: ' + campo);
    }

    nuevos[campo] = req.body[campo].trim();

    if (nuevos[campo].length > 5000) {
      return res.status(400).send('Campo demasiado largo');
    }
  }

  if (!nuevos.nombre || nuevos.nombre.length > 100) {
    return res.status(400).send('Nombre invalido');
  }

  if (!/^-?[0-9]{5,20}$/.test(nuevos.chat_id)) {
    return res.status(400).send('Chat ID invalido');
  }

  if (
    nuevos.telefono.length > 100 ||
    nuevos.codigo.length > 100 ||
    nuevos.ubicacion.length > 200
  ) {
    return res.status(400).send('Datos demasiado largos');
  }

  // Actualizar el perfil existente.
  // No cambiar token, ID, estadisticas ni fotos.
  Object.assign(datos[id], nuevos);

  guardarPerfiles(req.cliente.id, datos);

  return res.redirect('/cliente');
});

/* FIN CQ_EDICION_CLIENTES_V1 */

app.post('/cliente/estado',(req,res)=>{
    const datos=leerPerfiles(req.cliente.id);
    const id=String(req.body.id||'');
    const estado=String(req.body.estado||'');

    if(!Object.prototype.hasOwnProperty.call(datos,id) ||
       !['ACTIVA','PAUSADA'].includes(estado)) {
      return res.sendStatus(400);
    }

    datos[id].estado=estado;
    guardarPerfiles(req.cliente.id,datos);
    void cqNotificarClienteTelegram(
      datos[id],
      req.cliente,
      estado === 'ACTIVA' ? 'REANUDADO' : 'PAUSADO'
    );
    res.redirect('/cliente');
  });

  app.post('/cliente/borrar',(req,res)=>{
    const datos=leerPerfiles(req.cliente.id);
    const id=String(req.body.id||'');

    if(!Object.prototype.hasOwnProperty.call(datos,id)) {
      return res.sendStatus(404);
    }

    delete datos[id];
    guardarPerfiles(req.cliente.id,datos);
    res.redirect('/cliente');
  });

  app.get('/cliente/salir',(req,res)=>{
    sesiones.delete(cookie(req));
    res.clearCookie('cq_cliente',{path:'/cliente'});
    res.redirect('/cliente/login');
  });
};
