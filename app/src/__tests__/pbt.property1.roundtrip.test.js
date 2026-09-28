'use strict';

/**
 * Property-Based Test — Property 1 do design (api-reservas-devops).
 *
 * Feature: api-reservas-devops, Property 1: round-trip create→get
 *
 * "Para toda Reserva válida (cliente com 1–255 caracteres, `data` ISO 8601
 * válida, `status` no enum), quando ela é criada via repo.create (com `id`
 * gerado) e depois buscada via repo.findById, a Reserva retornada deve conter
 * os mesmos `cliente`, `data` e `status` enviados, além do `id` gerado."
 *
 * Validates: Requirements 1.2, 1.3, 2.1, 4.1
 *
 * Isolamento: a tabela `reservas` é truncada (TRUNCATE ... RESTART IDENTITY)
 * a cada iteração da propriedade, garantindo estado inicial limpo e
 * determinístico. Cada iteração usa um Pool próprio criado neste arquivo.
 */

const fc = require('fast-check');
const { Pool } = require('pg');

const reservasRepo = require('../repository/reservasRepo');
const { STATUS_VALUES } = require('../validation/reservaValidation');

const CONNECTION_STRING =
  process.env.TEST_DATABASE_URL ||
  'postgres://reservas:reservas@localhost:55432/reservas';

const pool = new Pool({ connectionString: CONNECTION_STRING });

afterAll(() => pool.end());

/**
 * Gerador de `cliente`: string com 1–255 caracteres após trim (não vazia).
 * Constrói a partir de um comprimento e caracteres não-brancos, garantindo que
 * o trim não reduza a string a vazio nem ultrapasse 255.
 */
const clienteArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .map((s) => s.trim())
  .filter((s) => s.length >= 1 && s.length <= 255);

/**
 * Gerador de `data` ISO 8601 válida.
 * Usa fc.date restrito a um intervalo razoável e serializa via toISOString(),
 * que sempre produz um instante ISO 8601 válido em UTC.
 */
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

describe('Feature: api-reservas-devops, Property 1: round-trip create→get', () => {
  test('round-trip criar → buscar preserva cliente, data e status', async () => {
    await fc.assert(
      fc.asyncProperty(reservaArb, async (reserva) => {
        // Estado inicial limpo a cada iteração.
        await pool.query('TRUNCATE reservas RESTART IDENTITY');

        const created = await reservasRepo.create(reserva, pool);

        // O create deve gerar um id.
        expect(created).toBeTruthy();
        expect(created.id).toBeDefined();
        expect(Number.isInteger(created.id)).toBe(true);

        const found = await reservasRepo.findById(created.id, pool);

        // A busca deve retornar a mesma reserva criada.
        expect(found).not.toBeNull();
        expect(found.id).toBe(created.id);
        expect(found.cliente).toBe(reserva.cliente);
        expect(found.status).toBe(reserva.status);

        // `data` é TIMESTAMPTZ → o pg retorna um Date; comparar por instante.
        expect(found.data).toBeInstanceOf(Date);
        expect(found.data.getTime()).toBe(new Date(reserva.data).getTime());
      }),
      { numRuns: 100 }
    );
  });
});
