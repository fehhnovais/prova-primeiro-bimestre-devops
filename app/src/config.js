'use strict';

/**
 * Módulo de configuração de conexão da API_Reservas.
 *
 * Lê a configuração do banco a partir de variáveis de ambiente, aceitando
 * tanto a connection string `DATABASE_URL` quanto as variáveis discretas
 * `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`. A porta HTTP é lida
 * de `PORT` (com fallback para o padrão).
 *
 * Requisitos: 1.4 (usar a configuração de conexão quando definida),
 * 1.5 (identificar a variável de conexão ausente na inicialização).
 */

/** Porta HTTP padrão da API quando `PORT` não é fornecida ou é inválida. */
const DEFAULT_PORT = 3000;

/**
 * Variáveis discretas obrigatórias para montar a conexão sem `DATABASE_URL`.
 * `PGPASSWORD` é intencionalmente opcional (bancos locais podem não exigir senha).
 */
const REQUIRED_PG_VARS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'];

/**
 * Retorna o valor "limpo" de uma variável de ambiente, tratando `undefined`,
 * `null` e strings vazias ou compostas apenas por espaços como ausentes.
 *
 * @param {string|undefined|null} value
 * @returns {string|undefined} o valor sem espaços nas bordas, ou `undefined`.
 */
function cleanValue(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Indica se uma variável de ambiente está presente (não vazia após trim).
 *
 * @param {object} env
 * @param {string} name
 * @returns {boolean}
 */
function hasValue(env, name) {
  return cleanValue(env[name]) !== undefined;
}

/**
 * Carrega a configuração da aplicação a partir do ambiente informado.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] variáveis de ambiente.
 * @returns {{
 *   databaseUrl: string|undefined,
 *   pg: {host: string, port: number, user: string, password: string|undefined, database: string}|undefined,
 *   port: number
 * }} configuração normalizada.
 */
function loadConfig(env = process.env) {
  const source = env || {};

  const databaseUrl = cleanValue(source.DATABASE_URL);

  const host = cleanValue(source.PGHOST);
  const rawPgPort = cleanValue(source.PGPORT);
  const user = cleanValue(source.PGUSER);
  const password = cleanValue(source.PGPASSWORD);
  const database = cleanValue(source.PGDATABASE);

  let pg;
  if (host || rawPgPort || user || database || password) {
    const parsedPgPort = Number.parseInt(rawPgPort, 10);
    pg = {
      host,
      port: Number.isNaN(parsedPgPort) ? undefined : parsedPgPort,
      user,
      password,
      database,
    };
  }

  return {
    databaseUrl,
    pg,
    port: parsePort(source.PORT),
  };
}

/**
 * Converte o valor de `PORT` para inteiro, retornando o padrão quando ausente
 * ou inválido.
 *
 * @param {string|undefined} rawPort
 * @returns {number}
 */
function parsePort(rawPort) {
  const cleaned = cleanValue(rawPort);
  if (cleaned === undefined) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
}

/**
 * Valida a presença de uma configuração de conexão válida no ambiente.
 *
 * A configuração é considerada válida quando `DATABASE_URL` está presente OU
 * quando todas as variáveis discretas obrigatórias (`PGHOST`, `PGPORT`,
 * `PGUSER`, `PGDATABASE`) estão presentes. `PGPASSWORD` é opcional.
 *
 * Quando inválida, `missing` lista as variáveis que faltam para satisfazer
 * pelo menos uma das alternativas de conexão, permitindo identificar a(s)
 * variável(is) ausente(s) (Req 1.5).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] variáveis de ambiente.
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateConnectionConfig(env = process.env) {
  const source = env || {};

  if (hasValue(source, 'DATABASE_URL')) {
    return { valid: true, missing: [] };
  }

  const missingPgVars = REQUIRED_PG_VARS.filter((name) => !hasValue(source, name));

  // Todas as variáveis discretas presentes => conexão válida por PG*.
  if (missingPgVars.length === 0) {
    return { valid: true, missing: [] };
  }

  // Nenhuma configuração de conexão informada: reportar ambas as alternativas.
  const informouAlgumPg = REQUIRED_PG_VARS.some((name) => hasValue(source, name));
  if (!informouAlgumPg) {
    return { valid: false, missing: ['DATABASE_URL', ...REQUIRED_PG_VARS] };
  }

  // Configuração discreta parcial: reportar exatamente as variáveis ausentes.
  return { valid: false, missing: missingPgVars };
}

module.exports = {
  DEFAULT_PORT,
  loadConfig,
  validateConnectionConfig,
};
