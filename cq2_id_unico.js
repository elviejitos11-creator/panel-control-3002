
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('./clientes_store');

module.exports = function existeId(id) {
  const clave = String(id);
  const raiz = process.env.DATA_DIR ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    __dirname;

  const archivos = [path.join(raiz, 'data.json')];

  for (const c of store.listar()) {
    archivos.push(path.join(
      store.carpetaCliente(c.id), 'data.json'
    ));
  }

  for (const archivo of archivos) {
    if (!fs.existsSync(archivo)) continue;
    const datos = JSON.parse(fs.readFileSync(archivo,'utf8'));
    if (!datos || typeof datos !== 'object' ||
        Array.isArray(datos)) throw Error('Datos invalidos');
    if (Object.prototype.hasOwnProperty.call(datos,clave)) {
      return true;
    }
  }
  return false;
};
