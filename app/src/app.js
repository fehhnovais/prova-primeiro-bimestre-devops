'use strict';

/**
 * Montagem do aplicativo Express da API_Reservas.
 *
 * Este módulo cria e configura a instância do Express, monta os middlewares
 * globais (parser JSON), registra os routers de domínio (`/reservas` e
 * `/health`) e instala o error handler global que normaliza toda resposta de
 * erro para o contrato `{ "error": { "campo"?, "mensagem" } }`.
 *
 * O `app` é exportado SEM chamar `listen()` — o bootstrap real (validação de
 * env, escolha da porta e subida do servidor HTTP) fica em `server.js`. Isso
 * permite exercitar as rotas com Supertest sem abrir uma porta real.
 *
 * Contrato de resposta de erro (normalizado pelo error handler global):
 *   { "error": { "campo"?: string, "mensagem": string } }
 * Quando o erro não é de um campo específico, `campo` é omitido.
 *
 * Mapeamento de erros no handler global:
 * - `SyntaxError` de corpo não-JSON (lançado por `express.json()`) → HTTP 400
 *   com mensagem de corpo inválido (Req 2.6).
 * - Demais erros (ex.: falhas do Banco_PostgreSQL propagadas via `next(err)`)
 *   → HTTP 500 com mensagem de erro interno (Req 1.6, 3.3, 4.4).
 *
 * Requisitos cobertos: 1.6, 2.6, 3.3, 4.4.
 */

const express = require('express');
const reservasRouter = require('./routes/reservas');
const healthRouter = require('./routes/health');

/**
 * Cria e configura uma instância do Express da API_Reservas.
 *
 * A criação é fatorada em função para facilitar os testes (cada suíte pode
 * montar um app isolado, opcionalmente com routers injetados). A aplicação
 * padrão exportada usa os routers reais de `routes/`.
 *
 * @param {object} [options]
 * @param {import('express').Router} [options.reservas] router de reservas
 *   (padrão: `routes/reservas.js`).
 * @param {import('express').Router} [options.health] router de health
 *   (padrão: `routes/health.js`, já define `/health` internamente).
 * @returns {import('express').Express}
 */
function createApp(options = {}) {
  const reservas = options.reservas || reservasRouter;
  const health = options.health || healthRouter;

  const app = express();

  // Parser de corpo JSON. Um corpo malformado faz este middleware lançar um
  // SyntaxError, que é tratado no error handler global e mapeado para 400.
  app.use(express.json());

  // Router de saúde montado na raiz — ele próprio define `GET /health`.
  app.use('/', health);

  // Router CRUD de reservas montado sob o prefixo `/reservas`.
  app.use('/reservas', reservas);

  // Error handler global (4 argumentos). Normaliza o corpo de erro e mapeia
  // SyntaxError de JSON malformado para 400 e os demais erros para 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Corpo não-JSON: o body-parser lança SyntaxError com `status`/`type`
    // definidos. Respondemos 400 sem tocar o banco (Req 2.6).
    const isJsonParseError =
      err instanceof SyntaxError &&
      (err.type === 'entity.parse.failed' ||
        err.status === 400 ||
        err.statusCode === 400);

    if (isJsonParseError) {
      return res.status(400).json({
        error: { mensagem: 'corpo da requisição é inválido: JSON malformado' },
      });
    }

    // Demais erros (ex.: falha do Banco_PostgreSQL propagada via next(err)):
    // respondem 500 com mensagem genérica de erro interno (Req 1.6, 3.3, 4.4).
    return res.status(500).json({
      error: { mensagem: 'erro interno ao processar a requisição' },
    });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
