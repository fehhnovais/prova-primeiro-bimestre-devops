'use strict';

/**
 * Rota de health check da API_Reservas (`GET /health`).
 *
 * Verifica a conectividade com o Banco_PostgreSQL executando `ping()`
 * (`SELECT 1`) no repositório de reservas. Serve para o orquestrador de
 * containers determinar se o serviço está pronto para receber tráfego.
 *
 * Contrato (Req 7.1, 7.2):
 * - Conexão com o banco OK  → HTTP 200 com `{ status: 'ok' }`.
 * - Falha ao conectar/consultar → HTTP 503 com corpo de erro no formato
 *   padronizado `{ error: { mensagem } }` indicando indisponibilidade.
 *
 * Requisitos: 7.1, 7.2.
 */

const express = require('express');
const reservasRepo = require('../repository/reservasRepo');

const router = express.Router();

/**
 * `GET /health` — verifica a saúde do serviço e da conexão com o banco.
 *
 * Executa `reservasRepo.ping()` (`SELECT 1`). Se resolver, a conexão está
 * operacional e responde 200 (Req 7.1). Se rejeitar (banco indisponível),
 * responde 503 com mensagem de indisponibilidade (Req 7.2).
 */
router.get('/health', async (req, res) => {
  try {
    await reservasRepo.ping();
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    return res.status(503).json({
      error: {
        mensagem: 'Serviço indisponível: falha na conexão com o banco de dados',
      },
    });
  }
});

module.exports = router;
