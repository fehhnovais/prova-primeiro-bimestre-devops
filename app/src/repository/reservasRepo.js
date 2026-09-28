'use strict';

/**
 * Repositório de dados da entidade Reserva.
 *
 * Concentra todo o acesso SQL ao Banco_PostgreSQL usando exclusivamente
 * queries parametrizadas (`$1, $2, ...`) através do `pg.Pool` compartilhado
 * (`db/pool.js`) — sem ORM. As operações de escrita (`create`, `update`,
 * `remove`) usam uma única instrução SQL com `RETURNING`, evitando estados
 * intermediários e persistência parcial (Req 1.6).
 *
 * Requisitos cobertos:
 * - 1.2: leitura/gravação exclusivamente no Banco_PostgreSQL.
 * - 1.6: operação de escrita em instrução única, sem persistência parcial.
 * - 2.1: `create` insere e retorna a Reserva com o `id` gerado.
 * - 3.1: `findAll` retorna todas as reservas.
 * - 4.1 / 4.2: `findById` retorna a Reserva ou `null` quando o `id` não existe.
 * - 5.1 / 5.2: `update` atualiza e retorna a Reserva, ou `null` quando não existe.
 * - 6.1 / 6.2: `remove` remove e retorna `true`, ou `false` quando não existe.
 * - 7.1: `ping` executa `SELECT 1` para o health check.
 */

const sharedPool = require('../db/pool');

/**
 * Insere uma nova Reserva no Banco_PostgreSQL.
 *
 * Usa uma única instrução `INSERT ... RETURNING *` de modo que a linha criada
 * (incluindo o `id` gerado pelo `SERIAL`) seja retornada atomicamente, sem
 * persistência parcial (Req 1.6, 2.1).
 *
 * @param {{ cliente: string, data: string, status: string }} reserva dados já
 *   validados/normalizados pela camada de validação.
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<{ id: number, cliente: string, data: string, status: string }>}
 *   a Reserva criada com o `id` gerado.
 */
async function create({ cliente, data, status }, pool = sharedPool) {
  const sql =
    'INSERT INTO reservas (cliente, data, status) VALUES ($1, $2, $3) RETURNING *';
  const result = await pool.query(sql, [cliente, data, status]);
  return result.rows[0];
}

/**
 * Retorna todas as reservas armazenadas, ordenadas de forma estável por `id`.
 *
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<Array<{ id: number, cliente: string, data: string, status: string }>>}
 *   coleção de reservas (vazia quando não há registros).
 */
async function findAll(pool = sharedPool) {
  const result = await pool.query('SELECT * FROM reservas ORDER BY id');
  return result.rows;
}

/**
 * Busca uma Reserva pelo seu `id`.
 *
 * @param {number|string} id identificador da Reserva.
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<{ id: number, cliente: string, data: string, status: string }|null>}
 *   a Reserva encontrada ou `null` quando o `id` não existe (Req 4.2).
 */
async function findById(id, pool = sharedPool) {
  const result = await pool.query('SELECT * FROM reservas WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Atualiza uma Reserva existente.
 *
 * Usa uma única instrução `UPDATE ... WHERE id = $4 RETURNING *`: quando o `id`
 * existe, a linha atualizada é retornada; caso contrário, nenhuma linha é
 * afetada e a função retorna `null`, sem alterar o estado (Req 1.6, 5.1, 5.2).
 *
 * @param {number|string} id identificador da Reserva a atualizar.
 * @param {{ cliente: string, data: string, status: string }} reserva novos
 *   dados já validados/normalizados.
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<{ id: number, cliente: string, data: string, status: string }|null>}
 *   a Reserva atualizada ou `null` quando o `id` não existe.
 */
async function update(id, { cliente, data, status }, pool = sharedPool) {
  const sql =
    'UPDATE reservas SET cliente = $1, data = $2, status = $3 WHERE id = $4 RETURNING *';
  const result = await pool.query(sql, [cliente, data, status, id]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Remove uma Reserva pelo seu `id`.
 *
 * Usa uma única instrução `DELETE ... WHERE id = $1 RETURNING id`, retornando
 * `true` quando uma linha foi removida e `false` quando o `id` não existe
 * (Req 1.6, 6.1, 6.2).
 *
 * @param {number|string} id identificador da Reserva a remover.
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<boolean>} `true` se removida, `false` se o `id` não existe.
 */
async function remove(id, pool = sharedPool) {
  const result = await pool.query(
    'DELETE FROM reservas WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * Verifica a conectividade com o Banco_PostgreSQL para o health check.
 *
 * Executa a consulta trivial `SELECT 1`. Resolve quando a conexão está
 * operacional e rejeita (propagando o erro do `pg`) quando o banco está
 * indisponível, permitindo que a rota `/health` responda 200 ou 503 (Req 7.1, 7.2).
 *
 * @param {import('pg').Pool} [pool=sharedPool] pool de conexões (injetável em testes).
 * @returns {Promise<boolean>} `true` quando a conexão está OK.
 */
async function ping(pool = sharedPool) {
  await pool.query('SELECT 1');
  return true;
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
  ping,
};
