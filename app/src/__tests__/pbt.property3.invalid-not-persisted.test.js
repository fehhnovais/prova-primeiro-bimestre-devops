'use strict';

/**
 * Property-Based Test — Property 3 do design (api-reservas-devops).
 *
 * Feature: api-reservas-devops, Property 3: POST inválido não persiste
 *
 * "Para toda entrada de POST /reservas que viole ao menos uma regra de
 * validação (cliente ausente/vazio/maior que 255, data ausente ou fora do
 * formato ISO 8601, ou status fora de {pendente, confirmada, cancelada}), a
 * API deve responder com HTTP 400 indicando o campo inválido e o total de
 * reservas armazenadas deve permanecer inalterado."
 *
 * Validates: Requirements 1.7, 2.3, 2.4, 2.5
 *
 * Abordagem end-to-end: define DATABASE_URL apontando para o PostgreSQL de
 * teste ANTES de requerer os módulos da aplicação (para que db/pool.js use o
 * banco de teste), monta o app real via require('../app') e usa um Pool próprio
 * apenas para inspeção/limpeza (TRUNCATE e contagem). A tabela `reservas` é
 * truncada a cada iteração, garantindo estado inicial limpo e determinístico.
 */

// IMPORTANTE: definir a connection string ANTES de requerer módulos que criam
// o pool a partir da configuração de ambiente (config.js / db/pool.js).
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://reservas:reservas@localhost:55432/reservas';

const fc = require('fast-check');
const request = require('supertest');
const { Pool } = require('pg');

const app = require('../app');
const { STATUS_VALUES } = require('../validation/reservaValidation');

// Pool próprio, exclusivo para inspeção (contagem) e limpeza (truncate).
const inspectionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(() => inspectionPool.end());

/**
 * Conta as reservas atualmente persistidas na tabela.
 * @returns {Promise<number>}
 */
async function countReservas() {
  const { rows } = await inspectionPool.query('SELECT count(*)::int AS total FROM reservas');
  return rows[0].total;
}

// ---------------------------------------------------------------------------
// Geradores de VALORES por campo: cada gerador produz um valor válido OU um
// valor inválido, sinalizando via `ok`. O gerador de payload combina os três e
// força ao menos um campo inválido por caso, garantindo que TODA entrada gerada
// seja inválida.
// ---------------------------------------------------------------------------

/** Cliente válido: string 1–255 chars após trim. */
const clienteValidoArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .map((s) => s.trim())
  .filter((s) => s.length >= 1 && s.length <= 255)
  .map((value) => ({ ok: true, value }));

/** Cliente inválido: ausente, vazio/só espaços, não-string, ou > 255 chars. */
const clienteInvalidoArb = fc.oneof(
  fc.constant({ ok: false, absent: true }), // campo ausente
  fc.constant({ ok: false, value: '' }), // vazio
  fc
    .string({ minLength: 1, maxLength: 10 })
    .map((s) => ' '.repeat(1 + s.length)) // só espaços -> trim vira vazio
    .map((value) => ({ ok: false, value })),
  fc
    .string({ minLength: 256, maxLength: 400 })
    .filter((s) => s.trim().length > 255)
    .map((value) => ({ ok: false, value })), // > 255 chars
  fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)).map((value) => ({
    ok: false,
    value,
  })) // tipo inválido
);

/** Data válida: ISO 8601 via toISOString(). */
const dataValidaArb = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-12-31T23:59:59.000Z'),
    noInvalidDate: true,
  })
  .map((d) => ({ ok: true, value: d.toISOString() }));

/** Data inválida: ausente, formato não-ISO, data impossível, ou tipo inválido. */
const dataInvalidaArb = fc.oneof(
  fc.constant({ ok: false, absent: true }), // ausente
  fc.constantFrom(
    '01/02/2024',
    '2024/02/01',
    '31-12-2024',
    'ontem',
    'not-a-date',
    '2024-13-01', // mês inválido
    '2024-02-30', // dia inválido (sem fuso)
    '2024-00-10',
    ''
  ).map((value) => ({ ok: false, value })),
  fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)).map((value) => ({
    ok: false,
    value,
  }))
);

/** Status válido: pertence ao enum. */
const statusValidoArb = fc
  .constantFrom(...STATUS_VALUES)
  .map((value) => ({ ok: true, value }));

/**
 * Status inválido: valor presente fora do enum, ou tipo inválido.
 * NOTA: status ausente ou `null` NÃO é inválido no POST (assume `pendente`),
 * portanto `undefined`/`null` são deliberadamente excluídos como fonte de
 * invalidez — apenas valores presentes fora do enum contam.
 */
const statusInvalidoArb = fc.oneof(
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !STATUS_VALUES.includes(s))
    .map((value) => ({ ok: false, value })),
  fc.constantFrom('PENDENTE', 'Confirmada', 'cancelado', 'ok', 'x').map(
    (value) => ({ ok: false, value })
  ),
  fc.oneof(fc.integer(), fc.boolean()).map((value) => ({
    ok: false,
    value,
  }))
);

/**
 * Aplica um "spec" de campo (válido/inválido/ausente) ao payload.
 * @param {object} payload
 * @param {string} key
 * @param {{ok: boolean, value?: unknown, absent?: boolean}} spec
 */
function applyField(payload, key, spec) {
  if (spec.absent) {
    return; // campo omitido do corpo
  }
  payload[key] = spec.value;
}

/**
 * Gerador de payload garantidamente INVÁLIDO.
 *
 * Sorteia specs para cliente, data e status (cada um válido ou inválido) e uma
 * máscara que decide quais campos serão inválidos, forçando ao menos um. Isso
 * cobre invalidez em um único campo e em combinações.
 */
const payloadInvalidoArb = fc
  .record({
    clienteValido: clienteValidoArb,
    clienteInvalido: clienteInvalidoArb,
    dataValida: dataValidaArb,
    dataInvalida: dataInvalidaArb,
    statusValido: statusValidoArb,
    statusInvalido: statusInvalidoArb,
    // Máscara: quais campos serão inválidos. Filtrada para garantir >= 1.
    invalidMask: fc
      .record({
        cliente: fc.boolean(),
        data: fc.boolean(),
        status: fc.boolean(),
      })
      .filter((m) => m.cliente || m.data || m.status),
    // Se true, o campo `status` é omitido quando ele deveria ser válido
    // (ausência de status é válida no POST). Não afeta a invalidez global.
    omitirStatusValido: fc.boolean(),
  })
  .map((s) => {
    const payload = {};

    applyField(
      payload,
      'cliente',
      s.invalidMask.cliente ? s.clienteInvalido : s.clienteValido
    );
    applyField(
      payload,
      'data',
      s.invalidMask.data ? s.dataInvalida : s.dataValida
    );

    if (s.invalidMask.status) {
      applyField(payload, 'status', s.statusInvalido);
    } else if (!s.omitirStatusValido) {
      applyField(payload, 'status', s.statusValido);
    }
    // else: status válido omitido -> assume pendente (permanece válido)

    return payload;
  });

describe('Feature: api-reservas-devops, Property 3: POST inválido não persiste', () => {
  test('POST /reservas com entrada inválida retorna 400 e não persiste', async () => {
    await fc.assert(
      fc.asyncProperty(payloadInvalidoArb, async (payload) => {
        // Estado inicial limpo a cada iteração.
        await inspectionPool.query('TRUNCATE reservas RESTART IDENTITY');

        const res = await request(app)
          .post('/reservas')
          .send(payload)
          .set('Content-Type', 'application/json');

        // Deve rejeitar com 400 e indicar o campo inválido.
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('mensagem');

        // Nenhuma reserva pode ter sido persistida.
        const total = await countReservas();
        expect(total).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
