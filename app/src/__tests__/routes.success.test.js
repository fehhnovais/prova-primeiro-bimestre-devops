'use strict';

/**
 * Testes unitários de sucesso por rota (Tarefa 3.6).
 *
 * Exercita os caminhos felizes do CRUD de reservas usando Supertest contra o
 * app Express, com um repositório fake/in-memory injetado. Não toca o
 * Banco_PostgreSQL nem os demais arquivos de teste (isolado das tarefas 3.7 e
 * 3.8).
 *
 * Contrato verificado:
 * - POST   /reservas      -> 201 (criada)
 * - GET    /reservas      -> 200 (lista)
 * - GET    /reservas/:id  -> 200 (encontrada)
 * - PUT    /reservas/:id  -> 200 (atualizada)
 * - DELETE /reservas/:id  -> 204 (removida)
 *
 * Requisitos: 8.2.
 */

const request = require('supertest');
const { createApp } = require('../app');
const { createReservasRouter } = require('../routes/reservas');

/**
 * Cria um repositório de reservas fake/in-memory que cobre os caminhos de
 * sucesso das rotas. As operações resolvem com dados consistentes (nunca
 * retornam `null`/`false`), garantindo que apenas o caminho feliz seja
 * exercitado.
 *
 * @returns {{
 *   create: Function,
 *   findAll: Function,
 *   findById: Function,
 *   update: Function,
 *   remove: Function,
 * }}
 */
function createFakeRepo() {
  const store = new Map();
  let nextId = 1;

  return {
    async create(value) {
      const id = nextId++;
      const reserva = { id, ...value };
      store.set(id, reserva);
      return reserva;
    },
    async findAll() {
      return Array.from(store.values());
    },
    async findById(id) {
      return store.get(id) || null;
    },
    async update(id, value) {
      if (!store.has(id)) {
        return null;
      }
      const reserva = { id, ...value };
      store.set(id, reserva);
      return reserva;
    },
    async remove(id) {
      return store.delete(id);
    },
  };
}

/**
 * Monta um app Express com o router de reservas apontando para um repo fake.
 *
 * @param {ReturnType<typeof createFakeRepo>} repo
 * @returns {import('express').Express}
 */
function buildApp(repo) {
  return createApp({ reservas: createReservasRouter(repo) });
}

describe('Rotas de reservas - caminhos de sucesso', () => {
  let repo;
  let app;

  beforeEach(() => {
    repo = createFakeRepo();
    app = buildApp(repo);
  });

  test('POST /reservas retorna 201 com a reserva criada', async () => {
    const payload = { cliente: 'Fernanda', data: '2024-02-15', status: 'confirmada' };

    const res = await request(app).post('/reservas').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(payload);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /reservas retorna 200 com a lista de reservas', async () => {
    await repo.create({ cliente: 'Ana', data: '2024-02-15', status: 'pendente' });

    const res = await request(app).get('/reservas');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ cliente: 'Ana' });
  });

  test('GET /reservas/:id retorna 200 com a reserva encontrada', async () => {
    const criada = await repo.create({
      cliente: 'Bruno',
      data: '2024-02-15',
      status: 'pendente',
    });

    const res = await request(app).get(`/reservas/${criada.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: criada.id, cliente: 'Bruno' });
  });

  test('PUT /reservas/:id retorna 200 com a reserva atualizada', async () => {
    const criada = await repo.create({
      cliente: 'Carla',
      data: '2024-02-15',
      status: 'pendente',
    });

    const res = await request(app)
      .put(`/reservas/${criada.id}`)
      .send({ cliente: 'Carla Silva', data: '2024-03-01', status: 'confirmada' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: criada.id,
      cliente: 'Carla Silva',
      status: 'confirmada',
    });
  });

  test('DELETE /reservas/:id retorna 204 sem corpo', async () => {
    const criada = await repo.create({
      cliente: 'Diego',
      data: '2024-02-15',
      status: 'pendente',
    });

    const res = await request(app).delete(`/reservas/${criada.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});
