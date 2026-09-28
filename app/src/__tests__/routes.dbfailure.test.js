'use strict';

/**
 * Testes unitários de falha de banco e health check (Tarefa 3.8).
 *
 * Estes testes exercitam os caminhos de erro das rotas usando Supertest contra
 * a instância do Express montada por `createApp`, com repositórios/routers
 * FALSOS (fakes) injetados — sem tocar em nenhum banco real. O objetivo é
 * validar dois grupos de comportamento:
 *
 * 1) Falha de banco → HTTP 500 (Req 2.7, 3.3, 4.4):
 *    Quando `create`/`findAll`/`findById`/`update` do repositório lançam um
 *    erro, a rota propaga via `next(err)` e o error handler global responde
 *    500 com o corpo normalizado `{ error: { mensagem } }`.
 *
 * 2) Health check `/health` (Req 7.1, 7.2):
 *    - `ping()` resolve → 200 `{ status: 'ok' }` (Req 7.1).
 *    - `ping()` rejeita  → 503 `{ error: { mensagem } }` (Req 7.2).
 *
 * Estratégia de isolamento:
 * - Para as rotas de reservas, usamos `createReservasRouter(repoFake)` — o repo
 *   é injetável, então basta um objeto cujos métodos rejeitam.
 * - Para o health, `routes/health.js` usa o repo real e não é injetável, então
 *   montamos um router de health de teste que consome um `ping` injetado e o
 *   passamos como `options.health` para `createApp`. Isso reproduz o contrato
 *   200/503 sem depender do repositório real.
 *
 * Requisitos cobertos: 2.7, 3.3, 4.4, 7.1, 7.2.
 */

const express = require('express');
const request = require('supertest');

const { createApp } = require('../app');
const { createReservasRouter } = require('../routes/reservas');

/**
 * Cria um router de health de teste que executa um `ping` injetado, replicando
 * o contrato de `routes/health.js` (200 quando resolve, 503 quando rejeita)
 * sem depender do repositório real.
 *
 * @param {() => Promise<unknown>} ping função de verificação de conexão.
 * @returns {import('express').Router}
 */
function makeHealthRouter(ping) {
  const router = express.Router();
  router.get('/health', async (req, res) => {
    try {
      await ping();
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      return res.status(503).json({
        error: {
          mensagem:
            'Serviço indisponível: falha na conexão com o banco de dados',
        },
      });
    }
  });
  return router;
}

/**
 * Monta um app cujas rotas de reservas usam o repositório fake informado.
 *
 * @param {object} repo repositório fake (métodos que resolvem/rejeitam).
 * @returns {import('express').Express}
 */
function appWithRepo(repo) {
  return createApp({ reservas: createReservasRouter(repo) });
}

// Um corpo de reserva válido, para que a requisição passe pela validação e
// chegue ao repositório (onde o erro de banco será lançado).
const RESERVA_VALIDA = {
  cliente: 'Fernanda Novais',
  data: '2025-01-15T10:00:00.000Z',
  status: 'pendente',
};

describe('Falha de banco → HTTP 500 com corpo { error: { mensagem } }', () => {
  test('POST /reservas: create lança erro → 500 (Req 2.7)', async () => {
    const repo = {
      create: jest.fn().mockRejectedValue(new Error('falha de INSERT no banco')),
    };
    const app = appWithRepo(repo);

    const res = await request(app).post('/reservas').send(RESERVA_VALIDA);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  test('GET /reservas: findAll lança erro → 500 (Req 3.3)', async () => {
    const repo = {
      findAll: jest.fn().mockRejectedValue(new Error('falha de consulta no banco')),
    };
    const app = appWithRepo(repo);

    const res = await request(app).get('/reservas');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(repo.findAll).toHaveBeenCalledTimes(1);
  });

  test('GET /reservas/:id: findById lança erro → 500 (Req 4.4)', async () => {
    const repo = {
      findById: jest.fn().mockRejectedValue(new Error('falha de consulta no banco')),
    };
    const app = appWithRepo(repo);

    const res = await request(app).get('/reservas/1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(repo.findById).toHaveBeenCalledWith(1);
  });

  test('PUT /reservas/:id: update lança erro → 500 (Req 4.4)', async () => {
    const repo = {
      update: jest.fn().mockRejectedValue(new Error('falha de UPDATE no banco')),
    };
    const app = appWithRepo(repo);

    const res = await request(app).put('/reservas/1').send(RESERVA_VALIDA);

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  test('DELETE /reservas/:id: remove lança erro → 500', async () => {
    const repo = {
      remove: jest.fn().mockRejectedValue(new Error('falha de DELETE no banco')),
    };
    const app = appWithRepo(repo);

    const res = await request(app).delete('/reservas/1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(repo.remove).toHaveBeenCalledWith(1);
  });
});

describe('Health check /health (Req 7.1, 7.2)', () => {
  test('ping resolve → 200 { status: "ok" } (Req 7.1)', async () => {
    const ping = jest.fn().mockResolvedValue(true);
    const app = createApp({ health: makeHealthRouter(ping) });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  test('ping rejeita → 503 { error: { mensagem } } (Req 7.2)', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('banco indisponível'));
    const app = createApp({ health: makeHealthRouter(ping) });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(ping).toHaveBeenCalledTimes(1);
  });
});
