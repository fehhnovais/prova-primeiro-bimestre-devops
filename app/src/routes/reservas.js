'use strict';

/**
 * Rotas CRUD do recurso `reservas`.
 *
 * Expõe um `express.Router()` com os endpoints de criação, listagem, busca,
 * atualização e remoção de reservas. As rotas orquestram a validação
 * (`reservaValidation.js`) e o repositório (`reservasRepo.js`) sem acessar o
 * banco diretamente. Erros de banco são propagados ao error handler global
 * via `next(err)`, resultando em HTTP 500 com corpo de erro normalizado.
 *
 * Contrato de resposta de erro (normalizado pelo error handler global):
 *   { "error": { "campo"?: string, "mensagem": string } }
 *
 * Requisitos cobertos:
 * - 2.1 / 2.2 / 2.3 / 2.4 / 2.5 / 2.7: POST /reservas (201/400/500).
 * - 3.1 / 3.2 / 3.3: GET /reservas (200/500).
 * - 4.1 / 4.2 / 4.3 / 4.4: GET /reservas/:id (200/400/404/500).
 * - 5.1 / 5.2 / 5.3 / 5.4 / 5.5: PUT /reservas/:id (200/400/404).
 * - 6.1 / 6.2: DELETE /reservas/:id (204/404).
 */

const express = require('express');
const { validateReserva } = require('../validation/reservaValidation');
const defaultRepo = require('../repository/reservasRepo');

/**
 * Valida o formato do `id` de rota antes de qualquer consulta ao banco.
 *
 * Com o `id` modelado como `SERIAL` (inteiro positivo), um `id` válido é
 * composto apenas por dígitos e representa um inteiro >= 1. Isso permite
 * responder 400 para formatos inválidos (ex.: `abc`, `1.5`, `-3`) antes de
 * tocar o Banco_PostgreSQL (Req 4.3).
 *
 * @param {string} rawId valor de `req.params.id`.
 * @returns {number|null} o inteiro positivo parseado, ou `null` se inválido.
 */
function parseId(rawId) {
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
    return null;
  }
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }
  return id;
}

/**
 * Monta a resposta de erro de validação (400) a partir dos erros acumulados
 * pela camada de validação. Usa o primeiro campo inválido como `campo` e
 * concatena as mensagens para dar uma indicação completa do problema.
 *
 * @param {Array<{ campo: string, mensagem: string }>} errors
 * @returns {{ error: { campo: string, mensagem: string } }}
 */
function buildValidationError(errors) {
  return {
    error: {
      campo: errors[0].campo,
      mensagem: errors.map((e) => e.mensagem).join('; '),
    },
  };
}

/**
 * Cria o router de reservas com um repositório injetável.
 *
 * A injeção do repositório facilita os testes (mock do repo/pool) sem depender
 * de um banco real, mantendo o comportamento padrão para a aplicação.
 *
 * @param {typeof defaultRepo} [repo=defaultRepo] repositório de reservas.
 * @returns {import('express').Router}
 */
function createReservasRouter(repo = defaultRepo) {
  const router = express.Router();

  // POST /reservas -> 201 (criada) | 400 (validação) | 500 (falha de banco)
  router.post('/', async (req, res, next) => {
    const result = validateReserva(req.body, { mode: 'create' });
    if (!result.valid) {
      return res.status(400).json(buildValidationError(result.errors));
    }
    try {
      const reserva = await repo.create(result.value);
      return res.status(201).json(reserva);
    } catch (err) {
      return next(err);
    }
  });

  // GET /reservas -> 200 (lista, possivelmente vazia) | 500 (falha de banco)
  router.get('/', async (req, res, next) => {
    try {
      const reservas = await repo.findAll();
      return res.status(200).json(reservas);
    } catch (err) {
      return next(err);
    }
  });

  // GET /reservas/:id -> 200 | 400 (id inválido) | 404 | 500
  router.get('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        error: { campo: 'id', mensagem: 'id informado é inválido' },
      });
    }
    try {
      const reserva = await repo.findById(id);
      if (!reserva) {
        return res.status(404).json({
          error: { mensagem: `reserva com id ${id} não encontrada` },
        });
      }
      return res.status(200).json(reserva);
    } catch (err) {
      return next(err);
    }
  });

  // PUT /reservas/:id -> 200 | 400 (id/validação) | 404 | 500
  router.put('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        error: { campo: 'id', mensagem: 'id informado é inválido' },
      });
    }
    const result = validateReserva(req.body, { mode: 'update' });
    if (!result.valid) {
      return res.status(400).json(buildValidationError(result.errors));
    }
    try {
      const reserva = await repo.update(id, result.value);
      if (!reserva) {
        return res.status(404).json({
          error: { mensagem: `reserva com id ${id} não encontrada` },
        });
      }
      return res.status(200).json(reserva);
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /reservas/:id -> 204 (removida) | 400 (id inválido) | 404 | 500
  router.delete('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        error: { campo: 'id', mensagem: 'id informado é inválido' },
      });
    }
    try {
      const removed = await repo.remove(id);
      if (!removed) {
        return res.status(404).json({
          error: { mensagem: `reserva com id ${id} não encontrada` },
        });
      }
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

const router = createReservasRouter();

module.exports = router;
module.exports.createReservasRouter = createReservasRouter;
module.exports.parseId = parseId;
