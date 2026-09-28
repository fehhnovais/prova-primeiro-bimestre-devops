'use strict';

/**
 * Property-Based Test — Property 8 do design (api-reservas-devops).
 *
 * Feature: api-reservas-devops, Property 8: id inexistente → 404
 *
 * "Para todo `id` com formato válido que não corresponde a nenhuma Reserva
 * armazenada, `GET /reservas/:id` deve responder com HTTP 404 e mensagem
 * indicando que a reserva não foi encontrada."
 *
 * Validates: Requirements 4.2
 *
 * Abordagem end-to-end (Supertest): exercita a stack HTTP real (`app.js` →
 * routes → repository → pool do `pg`) contra um PostgreSQL de teste. Para
 * garantir a INEXISTÊNCIA do `id` sorteado, a tabela `reservas` é truncada a
 * cada iteração (TRUNCATE ... RESTART IDENTITY) — assim nenhum `id` existe e
 * qualquer `id` de formato válido resulta necessariamente em 404.
 *
 * Distinção importante (Req 4.2 vs Req 4.3):
 * - `id` de FORMATO VÁLIDO (inteiro positivo) porém INEXISTENTE → 404.
 * - `id` de FORMATO INVÁLIDO (ex.: `abc`, `-3`) → 400 (não é o foco aqui).
 *
 * Isolamento: usa um Pool próprio, criado neste arquivo, exclusivamente para o
 * TRUNCATE; as requisições HTTP passam pelo pool compartilhado da aplicação.
 */

// A configuração de conexão DEVE ser definida ANTES de exigir `app`/`pool`,
// pois o pool compartilhado é criado no momento do require a partir da
// `DATABASE_URL` (via config.js → db/pool.js).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://reservas:reservas@localhost:55432/reservas';

const fc = require('fast-check');
const request = require('supertest');
const { Pool } = require('pg');

// Requeridos DEPOIS de definir DATABASE_URL para que o pool compartilhado da
// aplicação seja construído com a connection string de teste.
const app = require('../app');
const sharedPool = require('../db/pool');

// Pool próprio (independente do compartilhado da app) usado só para o TRUNCATE.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

afterAll(async () => {
  await pool.end();
  await sharedPool.end();
});

/**
 * Gerador de `id` com FORMATO VÁLIDO: inteiro positivo dentro do range de um
 * `int4` do PostgreSQL (coluna SERIAL). Como a tabela é esvaziada a cada
 * iteração, qualquer valor gerado é garantidamente inexistente.
 */
const idInexistenteArb = fc.integer({ min: 1, max: 2147483647 });

describe('Feature: api-reservas-devops, Property 8: id inexistente → 404', () => {
  test('GET /reservas/:id com id de formato válido inexistente responde 404', async () => {
    await fc.assert(
      fc.asyncProperty(idInexistenteArb, async (id) => {
        // Esvazia a tabela: nenhum id existe nesta iteração.
        await pool.query('TRUNCATE reservas RESTART IDENTITY');

        const res = await request(app).get(`/reservas/${id}`);

        // Recurso inexistente → 404 (Req 4.2).
        expect(res.status).toBe(404);

        // Corpo de erro normalizado: { error: { mensagem } }.
        expect(res.body).toBeDefined();
        expect(res.body.error).toBeDefined();
        expect(typeof res.body.error.mensagem).toBe('string');
        expect(res.body.error.mensagem.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
