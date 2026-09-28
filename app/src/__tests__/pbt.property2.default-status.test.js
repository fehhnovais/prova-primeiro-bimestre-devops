'use strict';

/**
 * Property-based test — Property 2 do design da API_Reservas.
 *
 * Feature: api-reservas-devops, Property 2: default pendente
 *
 * Property 2: `status` ausente assume o valor padrão `pendente`.
 *   Para toda Reserva válida enviada em `POST /reservas` SEM o campo `status`,
 *   a Reserva criada e persistida deve ter `status` igual a `pendente`.
 *
 * **Validates: Requirements 2.2**
 *
 * Abordagem: end-to-end via Supertest contra o app Express real, usando um
 * PostgreSQL de teste (localhost:55432). A `DATABASE_URL` de teste é definida
 * ANTES de qualquer require dos módulos que criam o pool (`db/pool.js`), de
 * modo que a camada de repositório persista no banco de teste. Após o POST sem
 * `status`, confirmamos via `GET /reservas/:id` que a reserva persistida tem
 * `status === 'pendente'`.
 */

// Configura o banco de teste ANTES de requerer módulos que instanciam o pool.
const TEST_DATABASE_URL = 'postgres://reservas:reservas@localhost:55432/reservas';
process.env.DATABASE_URL = TEST_DATABASE_URL;
// Evita que variáveis PG* discretas interfiram na construção do pool.
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;

const fc = require('fast-check');
const request = require('supertest');

const pool = require('../db/pool');
const app = require('../app');

/**
 * Trunca a tabela `reservas` reiniciando a sequência de `id`, garantindo
 * estado inicial limpo e determinístico por iteração.
 */
async function truncateReservas() {
  await pool.query('TRUNCATE reservas RESTART IDENTITY');
}

// Garante conectividade e schema antes de rodar a propriedade.
beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  await pool.end();
});

describe('Feature: api-reservas-devops, Property 2: default pendente', () => {
  test('POST /reservas sem status persiste a reserva com status "pendente"', async () => {
    await fc.assert(
      fc.asyncProperty(
        // cliente válido: 1–255 caracteres após trim.
        fc
          .string({ minLength: 1, maxLength: 255 })
          .filter((s) => s.trim().length >= 1 && s.trim().length <= 255),
        // data válida ISO 8601 (usa timestamps reais convertidos para ISO).
        fc
          .date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2100-12-31T23:59:59.000Z') })
          .map((d) => d.toISOString()),
        async (cliente, data) => {
          // Estado limpo a cada iteração.
          await truncateReservas();

          // POST sem o campo `status` — deve assumir o default 'pendente'.
          const postRes = await request(app)
            .post('/reservas')
            .send({ cliente, data });

          expect(postRes.status).toBe(201);
          expect(postRes.body).toHaveProperty('id');
          expect(postRes.body.status).toBe('pendente');

          // Confirma persistência via GET /reservas/:id.
          const getRes = await request(app).get(`/reservas/${postRes.body.id}`);
          expect(getRes.status).toBe(200);
          expect(getRes.body.status).toBe('pendente');
        }
      ),
      { numRuns: 100 }
    );
  });
});
