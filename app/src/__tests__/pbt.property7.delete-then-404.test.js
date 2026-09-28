'use strict';

/**
 * Property-based test — Property 7: Remover torna a busca subsequente um 404.
 *
 * Feature: api-reservas-devops, Property 7: delete → get 404
 *
 * "Para toda Reserva válida criada via POST /reservas (que devolve 201 com um
 * `id`), quando ela é removida via DELETE /reservas/:id (204), então uma busca
 * subsequente GET /reservas/:id deve resultar em 404, e um segundo DELETE do
 * mesmo `id` também deve resultar em 404 (recurso já inexistente)."
 *
 * Validates: Requirements 6.1
 *
 * Abordagem end-to-end via Supertest: exercita a API real (Express + rotas +
 * repositório + Banco_PostgreSQL). É necessário definir `DATABASE_URL`
 * apontando para o PostgreSQL de teste ANTES de importar `app` (que carrega
 * transitivamente `db/pool.js` e cria o Pool compartilhado a partir do env).
 *
 * Requer um PostgreSQL de teste acessível (localhost:55432, db/user/senha =
 * reservas) com o schema da tabela `reservas` já aplicado. A tabela é truncada
 * a cada iteração (`TRUNCATE reservas RESTART IDENTITY`) via um Pool próprio
 * deste arquivo, garantindo estado inicial limpo e determinístico.
 */

// IMPORTANTE: definir a connection string ANTES de qualquer require que
// carregue a configuração/pool da aplicação.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://reservas:reservas@localhost:55432/reservas';

const fc = require('fast-check');
const request = require('supertest');
const { Pool } = require('pg');

const app = require('../app');
const { STATUS_VALUES } = require('../validation/reservaValidation');

// Pool próprio deste arquivo, usado exclusivamente para o TRUNCATE de setup.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

afterAll(() => pool.end());

/**
 * Gerador de `cliente`: 1–255 caracteres após trim (não vazio).
 * Garante ao menos 1 caractere não-branco mesmo se a string original for
 * composta apenas por espaços.
 */
const clienteArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .map((s) => {
    const trimmed = s.trim();
    return trimmed.length >= 1 ? trimmed.slice(0, 255) : `c${s.slice(0, 254)}`;
  });

/** Gerador de `data` ISO 8601 válida (instante em UTC). */
const dataArb = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-12-31T23:59:59.000Z'),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

/** Gerador de `status` a partir do enum válido. */
const statusArb = fc.constantFrom(...STATUS_VALUES);

/** Gerador de uma Reserva válida completa. */
const reservaArb = fc.record({
  cliente: clienteArb,
  data: dataArb,
  status: statusArb,
});

describe('Feature: api-reservas-devops, Property 7: delete → get 404', () => {
  test('remover torna a busca subsequente (e um novo delete) um 404', async () => {
    await fc.assert(
      fc.asyncProperty(reservaArb, async (reserva) => {
        // Estado inicial limpo a cada iteração.
        await pool.query('TRUNCATE reservas RESTART IDENTITY');

        // POST /reservas -> 201 com id gerado.
        const created = await request(app).post('/reservas').send(reserva);
        expect(created.status).toBe(201);
        expect(created.body).toBeTruthy();
        const id = created.body.id;
        expect(Number.isInteger(id)).toBe(true);

        // DELETE /reservas/:id -> 204 (removida).
        const deleted = await request(app).delete(`/reservas/${id}`);
        expect(deleted.status).toBe(204);

        // GET /reservas/:id subsequente -> 404 (não encontrada).
        const fetched = await request(app).get(`/reservas/${id}`);
        expect(fetched.status).toBe(404);

        // Segundo DELETE do mesmo id -> 404 (recurso já inexistente).
        const deletedAgain = await request(app).delete(`/reservas/${id}`);
        expect(deletedAgain.status).toBe(404);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
