'use strict';

/**
 * Property-based test — Property 4: A listagem reflete exatamente as inserções.
 *
 * Feature: api-reservas-devops, Property 4: list reflete inserts
 *
 * Para toda sequência de N (N >= 0) Reservas válidas inseridas em um banco
 * inicialmente vazio, `repo.findAll` deve retornar uma coleção de tamanho N
 * contendo exatamente as reservas inseridas (mesmos `cliente`, `data`, `status`).
 *
 * Validates: Requirements 3.1, 3.2
 *
 * Requer um PostgreSQL de teste acessível (localhost:55432, db/user/senha =
 * reservas) com o schema da tabela `reservas` já aplicado. A tabela é truncada
 * a cada iteração (`TRUNCATE reservas RESTART IDENTITY`) para garantir estado
 * inicial vazio e determinístico.
 */

const fc = require('fast-check');
const { Pool } = require('pg');

const repo = require('../repository/reservasRepo');

const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    'postgres://reservas:reservas@localhost:55432/reservas',
});

const STATUS_VALUES = ['pendente', 'confirmada', 'cancelada'];

afterAll(() => pool.end());

/**
 * Gerador de uma Reserva válida:
 * - `cliente`: texto com 1–255 caracteres após trim (garantimos borda não vazia).
 * - `data`: instante ISO 8601 (com fuso Z) dentro de uma faixa segura.
 * - `status`: um dos valores permitidos.
 */
const reservaArb = fc.record({
  cliente: fc
    .string({ minLength: 1, maxLength: 255 })
    // Garante que sobra ao menos 1 caractere não-branco após trim.
    .map((s) => {
      const trimmed = s.trim();
      return trimmed.length >= 1 ? trimmed.slice(0, 255) : `c${s.slice(0, 254)}`;
    }),
  data: fc
    .date({
      min: new Date('2000-01-01T00:00:00.000Z'),
      max: new Date('2100-12-31T23:59:59.000Z'),
    })
    .map((d) => d.toISOString()),
  status: fc.constantFrom(...STATUS_VALUES),
});

/**
 * Normaliza uma reserva (inserida ou retornada) em uma chave comparável.
 * A `data` é comparada como instante (epoch em ms), pois a coluna é TIMESTAMPTZ
 * e o driver `pg` devolve um objeto Date.
 */
function toKey(reserva) {
  const instant = new Date(reserva.data).getTime();
  return `${reserva.cliente}\u0000${instant}\u0000${reserva.status}`;
}

/** Constrói um multiset (contagem por chave) a partir de uma lista de reservas. */
function toMultiset(reservas) {
  const counts = new Map();
  for (const r of reservas) {
    const key = toKey(r);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/** Compara dois multisets por igualdade estrutural. */
function multisetsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, count] of a) {
    if (b.get(key) !== count) {
      return false;
    }
  }
  return true;
}

describe('Feature: api-reservas-devops, Property 4: list reflete inserts', () => {
  test('findAll reflete exatamente as N reservas inseridas (0..10)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(reservaArb, { minLength: 0, maxLength: 10 }),
        async (reservas) => {
          await pool.query('TRUNCATE reservas RESTART IDENTITY');

          for (const reserva of reservas) {
            await repo.create(reserva, pool);
          }

          const listadas = await repo.findAll(pool);

          // Tamanho: exatamente N itens (Req 3.1, 3.2).
          expect(listadas).toHaveLength(reservas.length);

          // Conjunto (multiset) de (cliente, data, status) preservado.
          const esperado = toMultiset(reservas);
          const obtido = toMultiset(listadas);
          expect(multisetsEqual(esperado, obtido)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
