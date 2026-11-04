'use strict';
// CQ2_MULTICLIENTE_ONOFF_V3
// Control autenticado para perfiles de clientes.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./clientes_store');

function comparar(a, b) {
  if (!/^[a-f0-9]{64}$/.test(a) ||
      !/^[a-f0-9]{64}$/.test(b)) return false;

  return crypto.timingSafeEqual(
    Buffer.from(a, 'hex'),
    Buffer.from(b, 'hex')
  );
}

function identificar(id, token) {
  let encontrado = null;

  for (const cliente of store.listar()) {
    if (cliente.activo !== true ||
        Date.parse(cliente.vencimiento) <= Date.now()) continue;

    const archivo = path.join(
      store.carpetaCliente(cliente.id),
      'data.json'
    );

    if (!fs.existsSync(archivo)) continue;

    const datos = JSON.parse(
      fs.readFileSync(archivo, 'utf8')
    );

    if (!Object.prototype.hasOwnProperty.call(datos, id)) continue;

    const perfil = datos[id];

    if (!perfil || !comparar(
      token,
      String(perfil.cliente_token || '')
    )) continue;

    if (encontrado) return null;

    encontrado = { cliente, archivo, datos, perfil };
  }

  // CQ2_ADMIN_CLIENTE_UNIFICADO_V4
  // Buscar el perfil administrativo si no pertenece
  // a ningun cliente autenticado.
  if (!encontrado) {
    const raiz =
      process.env.DATA_DIR ||
      process.env.RAILWAY_VOLUME_MOUNT_PATH ||
      __dirname;

    const archivo = path.join(raiz, 'data.json');

    if (fs.existsSync(archivo)) {
      const datos = JSON.parse(
        fs.readFileSync(archivo, 'utf8')
      );

      if (
        datos &&
        typeof datos === 'object' &&
        !Array.isArray(datos) &&
        Object.prototype.hasOwnProperty.call(datos, id)
      ) {
        const perfil = datos[id];

        const tokenPerfil = String(
          perfil?.cliente_token || ''
        ).trim();

        const claveRemota = String(
          process.env.CQ2_EXTENSION_KEY || ''
        ).trim();

        const esperado = tokenPerfil || claveRemota;

        if (esperado.length >= 12 && token) {
          const a = crypto.createHash('sha256')
            .update(String(token)).digest();

          const b = crypto.createHash('sha256')
            .update(esperado).digest();

          if (crypto.timingSafeEqual(a, b)) {
            encontrado = {
              admin: true,
              cliente: null,
              archivo,
              datos,
              perfil
            };
          }
        }
      }
    }
  }

  return encontrado;
}

module.exports = function(app) {
  app.use('/cq-lobo', (req, res) => {
    const origin = String(req.get('origin') || '');

    if (!/^https:\/\/(?:[a-z0-9-]+\.)*megapersonals\.eu$/i.test(origin)) {
      return res.status(403).json({
        ok:false,
        error:'ORIGEN_NO_PERMITIDO'
      });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Cliente-Token'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS'
    );

    if (req.method === 'OPTIONS') return res.sendStatus(204);

    let id = '';
    let accion = '';

    if (req.method === 'GET') {
      const m = /^\/(estado|licencia)\/([A-Za-z0-9_-]{1,40})\/?$/
        .exec(req.path);

      if (!m) return res.sendStatus(404);
      accion = m[1];
      id = m[2];
    } else if (req.method === 'POST' && req.path === '/accion') {
      id = String(req.body?.id || '').trim();
      accion = String(req.body?.accion || '').trim();

      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) ||
          !['pausar','reanudar'].includes(accion)) {
        return res.status(400).json({
          ok:false,
          error:'ACCION_INVALIDA'
        });
      }
    } else {
      return res.sendStatus(404);
    }

    try {
      const token = String(
        req.get('X-Cliente-Token') || ''
      ).trim();

      const x = identificar(id, token);

      if (!x) {
        return res.status(403).json({
          ok:false,
          estado:'NO_AUTORIZADO'
        });
      }

      if (accion === 'estado' || accion === 'licencia') {
        const estado = x.perfil.estado === 'ACTIVA'
          ? 'ACTIVA' : 'PAUSADA';

        return res.json({
          ok:estado === 'ACTIVA',
          estado
        });
      }

      const estado = accion === 'pausar'
        ? 'PAUSADA' : 'ACTIVA';

      x.perfil.estado = estado;
      x.perfil.ultima_hora = new Date().toISOString();
      x.perfil.ultima_accion = accion === 'pausar'
        ? 'Pausado desde lobito'
        : 'Reanudado desde lobito';

      const temporal = x.archivo + '.cq-lobo.tmp';

      fs.writeFileSync(
        temporal,
        JSON.stringify(x.datos, null, 2),
        'utf8'
      );
      fs.renameSync(temporal, x.archivo);

      const actual = JSON.parse(
        fs.readFileSync(x.archivo, 'utf8')
      );

      if (actual[id]?.estado !== estado) {
        return res.status(500).json({
          ok:false,
          error:'ESTADO_NO_CONFIRMADO'
        });
      }

      res.json({ok:true,id,estado});

      Promise.resolve().then(() => {
        if (x.admin) {
          return app.locals.cq2NotificarLobo(id);
        }
        return require('./jean_bot_cliente').enviar(
          x.cliente, id, x.perfil, x.perfil.ultima_accion
        );
      }).catch(error =>
        console.error('[CQ2 TELEGRAM]', error.message)
      );

    } catch(error) {
      console.error('[CQ2 LOBO]', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          ok:false,
          error:'ERROR_INTERNO'
        });
      }
    }
  });
};