'use strict';

/**
 * Testes unitários das rotas HTTP da API_Reservas focados em VALIDAÇÃO e
 * RECURSO INEXISTENTE (Tarefa 3.7).
 *
 * Ferramentas: Jest + Supertest, exercitando o `app` Express montado via
 * `createApp({ reservas, health })` com um repositório FAKE injetado em
 * `createReservasRouter(repo)`. Assim os testes não dependem de banco real e
 * validam apenas a lógica HTTP das rotas.
 *
 * Cobertura:
 * - POST /reservas com corpo inválido → 400 com corpo { error: { campo, mensagem } } (Req 8.3, 2.3/2.4/2.5).
 * - POST /reservas com JSON malformado → 400 (Req 2.6).
 * - GET/PUT/DELETE /reservas/:id com `id` inválido → 400 (Req 4.3).
 * - GET /reservas/:id inexistente → 404 (Req 8.4, 4.2).
 * - PUT /reservas/:id inexistente → 404 (Req 5.2).
 * - DELETE /reservas/:id inexistente → 404 (Req 6.2).
 *
 * _Requirements: 8.3, 8.4, 2.6, 4.3, 5.2, 6.2_
 */

const request = require('supertest');
const { createApp } = require('../app');
const { createReservasRouter } = require('../routes/reservas');

/**
 * Cria um repositório fake configurável. Por padrão, as buscas/atualizações
 * retornam "recurso inexistente" (null/false), o que exercita os caminhos de
 * 404. Overrides permitem cenários específicos por teste.
 */
function makeFakeRepo(overrides = {}) {
  return {
    create: jest.fn(async (reserva) => ({ id: 1, ...reserva })),
    findAll: jest.fn(async () => []),
    findById: jest.fn(async () => null),
    update: jest.fn(async () => null),
    remove: jest.fn(async () => false),
    ping: jest.fn(async () => true),
    ...overrides,
  };
}

/**
 * Monta um app de teste com o router de reservas usando o repo fake. O router
 * de health não é exercitado aqui, então injetamos um router mínimo para não
 * depender do repositório real.
 */
function makeApp(repo) {
  const express = require('express');
  const health = express.Router();
  health.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  return createApp({ reservas: createReservasRouter(repo), health });
}

describe('POST /reservas — validação retorna 400 com corpo indicando o motivo', () => {
  test('cliente ausente → 400 com campo "cliente" e não persiste', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .post('/reservas')
      .send({ data: '2024-02-15', status: 'pendente' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('campo', 'cliente');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('cliente com mais de 255 caracteres → 400 campo "cliente"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .post('/reservas')
      .send({ cliente: 'x'.repeat(256), data: '2024-02-15' });

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('cliente');
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('data em formato inválido → 400 campo "data"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .post('/reservas')
      .send({ cliente: 'Ana', data: '15/02/2024' });

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('data');
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('status fora do enum → 400 campo "status"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .post('/reservas')
      .send({ cliente: 'Ana', data: '2024-02-15', status: 'aprovada' });

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('status');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('POST /reservas — corpo não-JSON (malformado) retorna 400', () => {
  test('texto não-JSON com content-type application/json → 400', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .post('/reservas')
      .set('Content-Type', 'application/json')
      .send('isto não é json {');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('id inválido (não numérico) retorna 400 antes de tocar o banco', () => {
  test('GET /reservas/:id com id "abc" → 400 campo "id"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo)).get('/reservas/abc');

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('id');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  test('PUT /reservas/:id com id "abc" → 400 campo "id"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo))
      .put('/reservas/abc')
      .send({ cliente: 'Ana', data: '2024-02-15', status: 'pendente' });

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('id');
    expect(repo.update).not.toHaveBeenCalled();
  });

  test('DELETE /reservas/:id com id "abc" → 400 campo "id"', async () => {
    const repo = makeFakeRepo();
    const res = await request(makeApp(repo)).delete('/reservas/abc');

    expect(res.status).toBe(400);
    expect(res.body.error.campo).toBe('id');
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

describe('recurso inexistente retorna 404 com corpo indicando não encontrado', () => {
  test('GET /reservas/:id inexistente → 404 (Req 4.2)', async () => {
    const repo = makeFakeRepo({ findById: jest.fn(async () => null) });
    const res = await request(makeApp(repo)).get('/reservas/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(repo.findById).toHaveBeenCalledWith(999);
  });

  test('PUT /reservas/:id inexistente → 404 (Req 5.2)', async () => {
    const repo = makeFakeRepo({ update: jest.fn(async () => null) });
    const res = await request(makeApp(repo))
      .put('/reservas/999')
      .send({ cliente: 'Ana', data: '2024-02-15', status: 'confirmada' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(repo.update).toHaveBeenCalledWith(999, {
      cliente: 'Ana',
      data: '2024-02-15',
      status: 'confirmada',
    });
  });

  test('DELETE /reservas/:id inexistente → 404 (Req 6.2)', async () => {
    const repo = makeFakeRepo({ remove: jest.fn(async () => false) });
    const res = await request(makeApp(repo)).delete('/reservas/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error.mensagem).toBe('string');
    expect(res.body.error.mensagem.length).toBeGreaterThan(0);
    expect(repo.remove).toHaveBeenCalledWith(999);
  });
});
