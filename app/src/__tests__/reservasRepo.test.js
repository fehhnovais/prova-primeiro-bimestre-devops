'use strict';

/**
 * Testes unitários do repositório de reservas (`repository/reservasRepo.js`).
 *
 * Estes testes isolam a lógica do repositório da infraestrutura real usando um
 * `pool` mockado (objeto com `query: jest.fn()`) injetado como último parâmetro
 * de cada função. Cobrem:
 *  - o mapeamento dos retornos do `pg` (linhas, `rowCount`) para os contratos
 *    do repositório (`null`/`false`/`true`/objeto/array);
 *  - a propagação de erros lançados por `pool.query` (Req 1.6, sem persistência
 *    parcial — a rejeição chega intacta à camada superior);
 *  - o retorno `null` de `findById` quando não há linhas (Req 4.2).
 */

const repo = require('../repository/reservasRepo');

/**
 * Cria um pool mockado com `query` como jest.fn().
 * @param {jest.Mock} [queryImpl] implementação opcional para `query`.
 */
function makePool(queryImpl) {
  const query = queryImpl || jest.fn();
  return { query };
}

const RESERVA = { id: 1, cliente: 'Ana', data: '2024-02-15', status: 'pendente' };

describe('reservasRepo.create', () => {
  test('insere e retorna a reserva criada com o id gerado', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [RESERVA] }));

    const result = await repo.create(
      { cliente: 'Ana', data: '2024-02-15', status: 'pendente' },
      pool
    );

    expect(result).toEqual(RESERVA);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO reservas/i);
    expect(sql).toMatch(/RETURNING \*/i);
    expect(params).toEqual(['Ana', '2024-02-15', 'pendente']);
  });

  test('propaga erro lançado por pool.query', async () => {
    const erro = new Error('connection refused');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(
      repo.create({ cliente: 'Ana', data: '2024-02-15', status: 'pendente' }, pool)
    ).rejects.toBe(erro);
  });
});

describe('reservasRepo.findAll', () => {
  test('retorna o array de reservas', async () => {
    const rows = [RESERVA, { ...RESERVA, id: 2, cliente: 'Bruno' }];
    const pool = makePool(jest.fn().mockResolvedValue({ rows }));

    const result = await repo.findAll(pool);

    expect(result).toEqual(rows);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM reservas/i);
    expect(sql).toMatch(/ORDER BY id/i);
  });

  test('retorna array vazio quando não há registros', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [] }));

    const result = await repo.findAll(pool);

    expect(result).toEqual([]);
  });

  test('propaga erro lançado por pool.query', async () => {
    const erro = new Error('query failed');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(repo.findAll(pool)).rejects.toBe(erro);
  });
});

describe('reservasRepo.findById', () => {
  test('retorna a reserva quando existe', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [RESERVA] }));

    const result = await repo.findById(1, pool);

    expect(result).toEqual(RESERVA);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM reservas WHERE id = \$1/i);
    expect(params).toEqual([1]);
  });

  test('retorna null quando não há linhas (Req 4.2)', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [] }));

    const result = await repo.findById(999, pool);

    expect(result).toBeNull();
  });

  test('propaga erro lançado por pool.query', async () => {
    const erro = new Error('query failed');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(repo.findById(1, pool)).rejects.toBe(erro);
  });
});

describe('reservasRepo.update', () => {
  test('retorna a reserva atualizada quando o id existe', async () => {
    const atualizada = { ...RESERVA, status: 'confirmada' };
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [atualizada] }));

    const result = await repo.update(
      1,
      { cliente: 'Ana', data: '2024-02-15', status: 'confirmada' },
      pool
    );

    expect(result).toEqual(atualizada);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE reservas SET/i);
    expect(sql).toMatch(/WHERE id = \$4 RETURNING \*/i);
    expect(params).toEqual(['Ana', '2024-02-15', 'confirmada', 1]);
  });

  test('retorna null quando nenhuma linha é afetada (id inexistente)', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [] }));

    const result = await repo.update(
      999,
      { cliente: 'Ana', data: '2024-02-15', status: 'confirmada' },
      pool
    );

    expect(result).toBeNull();
  });

  test('propaga erro lançado por pool.query', async () => {
    const erro = new Error('update failed');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(
      repo.update(1, { cliente: 'Ana', data: '2024-02-15', status: 'confirmada' }, pool)
    ).rejects.toBe(erro);
  });
});

describe('reservasRepo.remove', () => {
  test('retorna true quando uma linha é removida (rowCount > 0)', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] }));

    const result = await repo.remove(1, pool);

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM reservas WHERE id = \$1 RETURNING id/i);
    expect(params).toEqual([1]);
  });

  test('retorna false quando nenhuma linha é removida (rowCount 0)', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }));

    const result = await repo.remove(999, pool);

    expect(result).toBe(false);
  });

  test('propaga erro lançado por pool.query', async () => {
    const erro = new Error('delete failed');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(repo.remove(1, pool)).rejects.toBe(erro);
  });
});

describe('reservasRepo.ping', () => {
  test('resolve com true executando SELECT 1', async () => {
    const pool = makePool(jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }));

    const result = await repo.ping(pool);

    expect(result).toBe(true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SELECT 1/i);
  });

  test('propaga erro lançado por pool.query (banco indisponível)', async () => {
    const erro = new Error('connection terminated');
    const pool = makePool(jest.fn().mockRejectedValue(erro));

    await expect(repo.ping(pool)).rejects.toBe(erro);
  });
});
