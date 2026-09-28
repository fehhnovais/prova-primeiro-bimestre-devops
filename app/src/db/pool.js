'use strict';

/**
 * Pool de conexões do PostgreSQL (node-postgres / `pg`).
 *
 * Cria e exporta um `Pool` do `pg` a partir da configuração de conexão exposta
 * por `config.js`. Todo o acesso ao banco na aplicação é feito através deste
 * pool, usando exclusivamente queries parametrizadas (`$1, $2, ...`) — sem ORM.
 *
 * Requisitos: 1.1 (acesso via `pg` com queries parametrizadas, sem ORM),
 * 1.2 (persistência exclusiva em PostgreSQL).
 */

const { Pool } = require('pg');
const { loadConfig } = require('../config');

/**
 * Monta as opções de conexão do `pg.Pool` a partir da configuração carregada.
 *
 * Prioriza a connection string (`DATABASE_URL`) quando presente; caso contrário
 * usa as variáveis discretas (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
 * `PGDATABASE`). Se nenhuma configuração estiver presente, retorna um objeto
 * vazio, deixando o `pg` recorrer aos seus próprios defaults/variáveis de
 * ambiente — a validação de presença de configuração é responsabilidade do
 * bootstrap (`server.js`, Req 1.5).
 *
 * @param {ReturnType<typeof loadConfig>} [config=loadConfig()] configuração normalizada.
 * @returns {import('pg').PoolConfig} opções para o `pg.Pool`.
 */
function buildPoolConfig(config = loadConfig()) {
  const cfg = config || {};

  if (cfg.databaseUrl) {
    return { connectionString: cfg.databaseUrl };
  }

  if (cfg.pg) {
    const { host, port, user, password, database } = cfg.pg;
    return { host, port, user, password, database };
  }

  return {};
}

/**
 * Cria uma nova instância de `pg.Pool` a partir da configuração informada.
 *
 * Útil em testes para instanciar pools isolados. A aplicação usa o pool
 * compartilhado exportado por este módulo.
 *
 * @param {ReturnType<typeof loadConfig>} [config=loadConfig()] configuração normalizada.
 * @returns {import('pg').Pool}
 */
function createPool(config = loadConfig()) {
  return new Pool(buildPoolConfig(config));
}

/**
 * Pool compartilhado usado por toda a camada de repositório da aplicação.
 * @type {import('pg').Pool}
 */
const pool = createPool();

module.exports = pool;
module.exports.pool = pool;
module.exports.createPool = createPool;
module.exports.buildPoolConfig = buildPoolConfig;
