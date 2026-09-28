'use strict';

/**
 * Property-Based Test — Property 5 do design (api-reservas-devops).
 *
 * Feature: api-reservas-devops, Property 5: update round-trip
 *
 * "Para toda Reserva válida inicialmente criada e todo conjunto de novos dados
 * válidos (cliente com 1–255 caracteres após trim, `data` ISO 8601 válida,
 * `status` no enum), quando a Reserva é atualizada via repo.update(id, novos)
 * e depois buscada via repo.findById(id), a Reserva retornada deve refletir
 * exatamente os novos `cliente`, `data` e `status`."
 *
 * Validates: Requirements 5.1
 *
 * Isolamento: a tabela `reservas` é truncada (TRUNCATE ... RESTART IDENTITY)
 * a cada iteração da propriedade, garantindo estado inicial limpo e
 * determinístico. Este arquivo cria e encerra o seu próprio Pool.
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
 */
const clienteArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .map((s) => s.trim())
  .filter((s) => s.length >= 1 && s.length <= 255);

/**
 * Gerador de `data` ISO 8601 válida via toISOString() (sempre válido em UTC).
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

describe('Feature: api-reservas-devops, Property 5: update round-trip', () => {
  test('round-trip de atualização reflete os novos cliente, data e status', async () => {
    await fc.assert(
      fc.asyncProperty(reservaArb, reservaArb, async (inicial, novos) => {
        // Estado inicial limpo a cada iteração.
        await pool.query('TRUNCATE reservas RESTART IDENTITY');

        const created = await reservasRepo.create(inicial, pool);
        expect(created).toBeTruthy();
        expect(created.id).toBeDefined();

        const updated = await reservasRepo.update(created.id, novos, pool);

        // O update deve retornar a linha atualizada (id existe).
        expect(updated).not.toBeNull();
        expect(updated.id).toBe(created.id);

        const found = await reservasRepo.findById(created.id, pool);

        // A busca deve refletir exatamente os novos dados.
        expect(found).not.toBeNull();
        expect(found.id).toBe(created.id);
        expect(found.cliente).toBe(novos.cliente);
        expect(found.status).toBe(novos.status);

        // `data` é TIMESTAMPTZ → o pg retorna um Date; comparar por instante.
        expect(found.data).toBeInstanceOf(Date);
        expect(found.data.getTime()).toBe(new Date(novos.data).getTime());
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
