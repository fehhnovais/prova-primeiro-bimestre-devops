'use strict';

/**
 * Bootstrap do servidor HTTP da API_Reservas.
 *
 * Responsabilidades (separadas de `app.js` para preservar a testabilidade das
 * rotas com Supertest):
 * 1. Validar, na inicialização, a presença da configuração de conexão com o
 *    Banco_PostgreSQL via `validateConnectionConfig`. Se faltar variável,
 *    loga a(s) variável(is) ausente(s) e encerra com `process.exit(1)`
 *    (Req 1.5).
 * 2. Verificar a conectividade real com o banco (`reservasRepo.ping()`); se
 *    não conseguir conectar, loga o erro e encerra com código de saída ≠ 0,
 *    sinalizando a falha ao orquestrador de containers (Req 9.6).
 * 3. Subir o servidor HTTP do Express (`app.js`) na porta configurada
 *    (`loadConfig().port`).
 *
 * O módulo exporta `start()` para permitir testes e reutilização, e só executa
 * o bootstrap automaticamente quando rodado diretamente (`node src/server.js`).
 *
 * Requisitos cobertos: 1.5, 9.6.
 */

const app = require('./app');
const { loadConfig, validateConnectionConfig } = require('./config');
const reservasRepo = require('./repository/reservasRepo');

/**
 * Executa o bootstrap do servidor: valida a config de conexão, verifica a
 * conectividade com o banco e sobe o HTTP na porta configurada.
 *
 * Em caso de configuração ausente ou falha de conexão, encerra o processo com
 * código de saída ≠ 0 (Req 1.5, 9.6). Os pontos de I/O são injetáveis para
 * facilitar os testes.
 *
 * @param {object} [deps] dependências injetáveis (usado em testes).
 * @param {NodeJS.ProcessEnv} [deps.env=process.env] variáveis de ambiente.
 * @param {import('express').Express} [deps.application=app] app Express a subir.
 * @param {() => Promise<boolean>} [deps.ping=reservasRepo.ping] verificação de
 *   conectividade com o banco.
 * @param {(code?: number) => void} [deps.exit=process.exit] encerramento do processo.
 * @param {Console} [deps.logger=console] destino de logs.
 * @returns {Promise<import('http').Server|undefined>} o servidor HTTP quando a
 *   inicialização é bem-sucedida; `undefined` quando o processo é encerrado.
 */
async function start(deps = {}) {
  const {
    env = process.env,
    application = app,
    ping = reservasRepo.ping,
    exit = process.exit,
    logger = console,
  } = deps;

  // 1. Validação da configuração de conexão na inicialização (Req 1.5).
  const { valid, missing } = validateConnectionConfig(env);
  if (!valid) {
    logger.error(
      'Configuração de conexão ausente na inicialização. ' +
        `Defina ${missing.join(' ou ')} para conectar ao banco.`
    );
    exit(1);
    return undefined;
  }

  // 2. Verificação de conectividade com o Banco_PostgreSQL (Req 9.6).
  try {
    await ping();
  } catch (err) {
    logger.error(
      'Falha ao conectar ao Banco_PostgreSQL na inicialização: ' +
        (err && err.message ? err.message : String(err))
    );
    exit(1);
    return undefined;
  }

  // 3. Subida do servidor HTTP na porta configurada (Req 9.6).
  const { port } = loadConfig(env);
  const server = application.listen(port, () => {
    logger.log(`API_Reservas ouvindo na porta ${port}`);
  });

  return server;
}

module.exports = start;
module.exports.start = start;

// Executa o bootstrap apenas quando o arquivo é o ponto de entrada direto
// (`node src/server.js` / `npm start`), preservando a importação em testes.
if (require.main === module) {
  start();
}
