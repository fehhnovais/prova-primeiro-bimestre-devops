'use strict';

/**
 * Property-Based Test — Property 6 do design (api-reservas-devops).
 *
 * Feature: api-reservas-devops, Property 6: update inválido não altera
 *
 * "Para toda Reserva existente e todo payload de PUT /reservas/:id que viole as
 * regras de validação (campo obrigatório ausente, cliente vazio/maior que 255,
 * data fora de ISO 8601 ou status fora do enum), a API deve responder com HTTP
 * 400 e a Reserva armazenada deve permanecer idêntica ao seu estado anterior."
 *
 * Validates: Requirements 5.3, 5.4, 5.5
 *
 * Abordagem end-to-end: define DATABASE_URL apontando para o PostgreSQL de
 * teste ANTES de requerer os módulos da aplicação (para que db/pool.js use o
 * banco de teste), monta o app real via require('../app') e usa um Pool próprio
 * apenas para limpeza (TRUNCATE) e inspeção do estado. A tabela `reservas` é
 * truncada a cada iteração, garantindo estado inicial limpo e determinístico.
 *
 * Fluxo de cada iteração:
 *  1. Cria uma reserva válida inicial via POST /reservas (201).
 *  2. Aplica PUT /reservas/:id com um payload garantidamente INVÁLIDO.
 *     Observação sobre a Req 5.5: no modo update o campo `status` é
 *     obrigatório, portanto a AUSÊNCIA de `status` é uma entrada inválida
 *     válida para este teste (além de cliente/data/status fora das regras).
 *  3. Espera HTTP 400.
 *  4. Busca a reserva via GET /reservas/:id e verifica que o estado
 *     (cliente/data/status) permanece EXATAMENTE igual ao inicial.
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

// Pool próprio, exclusivo para limpeza (truncate) e inspeção do estado.
const inspectionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

afterAll(() => inspectionPool.end());

/**
 * Lê a reserva persistida diretamente do banco, para comparação de estado.
 * @param {number} id
 * @returns {Promise<{id: number, cliente: string, data: Date, status: string}|null>}
 */
async function readReserva(id) {
  const { rows } = await inspectionPool.query(
    'SELECT id, cliente, data, status FROM reservas WHERE id = $1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// Geradores de VALORES por campo (válidos e inválidos), no mesmo espírito do
// teste da Property 3, mas voltados ao modo `update` (status obrigatório).
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
 * Status inválido no modo UPDATE: ausente (obrigatório na Req 5.5), fora do
 * enum, ou tipo inválido.
 */
const statusInvalidoArb = fc.oneof(
  fc.constant({ ok: false, absent: true }), // ausente -> inválido no update (Req 5.5)
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !STATUS_VALUES.includes(s))
    .map((value) => ({ ok: false, value })),
  fc.constantFrom('PENDENTE', 'Confirmada', 'cancelado', 'ok', 'x').map(
    (value) => ({ ok: false, value })
  ),
  fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)).map((value) => ({
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
 * Gerador da reserva VÁLIDA inicial (usada para criar o estado a preservar).
 */
const reservaInicialArb = fc.record({
  cliente: clienteValidoArb.map((s) => s.value),
  data: dataValidaArb.map((s) => s.value),
  status: statusValidoArb.map((s) => s.value),
});

/**
 * Gerador de payload de UPDATE garantidamente INVÁLIDO.
 *
 * Sorteia specs para cliente, data e status (válido ou inválido) e uma máscara
 * que decide quais campos serão inválidos, forçando ao menos um. No modo
 * update, `status` ausente conta como inválido (Req 5.5), então quando o
 * campo status não é forçado inválido, geramos um status válido explícito.
 */
const payloadInvalidoArb = fc
  .record({
    clienteValido: clienteValidoArb,
    clienteInvalido: clienteInvalidoArb,
    dataValida: dataValidaArb,
    dataInvalida: dataInvalidaArb,
    statusValido: statusValidoArb,
    statusInvalido: statusInvalidoArb,
    invalidMask: fc
      .record({
        cliente: fc.boolean(),
        data: fc.boolean(),
        status: fc.boolean(),
      })
      .filter((m) => m.cliente || m.data || m.status),
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
    applyField(
      payload,
      'status',
      s.invalidMask.status ? s.statusInvalido : s.statusValido
    );

    return payload;
  });

describe('Feature: api-reservas-devops, Property 6: update inválido não altera', () => {
  test('PUT /reservas/:id inválido retorna 400 e não altera o estado', async () => {
    await fc.assert(
      fc.asyncProperty(
        reservaInicialArb,
        payloadInvalidoArb,
        async (inicial, payloadInvalido) => {
          // Estado inicial limpo a cada iteração.
          await inspectionPool.query('TRUNCATE reservas RESTART IDENTITY');

          // 1. Cria a reserva válida inicial.
          const criada = await request(app)
            .post('/reservas')
            .send(inicial)
            .set('Content-Type', 'application/json');

          expect(criada.status).toBe(201);
          const id = criada.body.id;
          expect(Number.isInteger(id)).toBe(true);

          // Estado persistido logo após a criação (referência a preservar).
          const antes = await readReserva(id);
          expect(antes).not.toBeNull();

          // 2. Aplica PUT inválido.
          const atualizacao = await request(app)
            .put(`/reservas/${id}`)
            .send(payloadInvalido)
            .set('Content-Type', 'application/json');

          // 3. Deve rejeitar com 400 indicando o campo/motivo.
          expect(atualizacao.status).toBe(400);
          expect(atualizacao.body).toHaveProperty('error');
          expect(atualizacao.body.error).toHaveProperty('mensagem');

          // 4. O estado persistido deve permanecer idêntico ao inicial.
          const depois = await readReserva(id);
          expect(depois).not.toBeNull();
          expect(depois.id).toBe(antes.id);
          expect(depois.cliente).toBe(antes.cliente);
          expect(depois.status).toBe(antes.status);
          // `data` é TIMESTAMPTZ: compara pelo instante absoluto.
          expect(new Date(depois.data).getTime()).toBe(
            new Date(antes.data).getTime()
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
