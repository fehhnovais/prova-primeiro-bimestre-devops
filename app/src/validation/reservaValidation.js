'use strict';

/**
 * Regras de validação dos campos de uma Reserva.
 *
 * Este módulo concentra a validação dos campos `cliente`, `data` e `status`
 * usada pelas rotas de escrita (`POST` e `PUT`). Ele não acessa o banco: apenas
 * inspeciona o payload recebido, normaliza os valores e reporta os campos
 * inválidos, permitindo que o controller responda 400 sem tocar o
 * Banco_PostgreSQL.
 *
 * Requisitos cobertos:
 * - 1.3 / 2.2: campos e enum de `status`; default `pendente`.
 * - 1.7: rejeitar escrita inválida identificando o campo, sem persistir.
 * - 2.3 / 5.5: `cliente` obrigatório, 1–255 caracteres após `trim`.
 * - 2.4 / 5.4: `data` obrigatória e em formato ISO 8601 válido.
 * - 2.5 / 5.3: `status` deve pertencer ao enum quando presente.
 */

/** Valores permitidos para o campo `status`. */
const STATUS_VALUES = ['pendente', 'confirmada', 'cancelada'];

/** Valor padrão de `status` quando ausente na criação (POST). */
const DEFAULT_STATUS = 'pendente';

/** Comprimento mínimo e máximo do `cliente` após `trim`. */
const CLIENTE_MIN = 1;
const CLIENTE_MAX = 255;

/**
 * Expressão que reconhece datas ISO 8601 na forma `YYYY-MM-DD` ou data-hora
 * `YYYY-MM-DDTHH:mm[:ss[.sss]][Z|±HH:mm]`. Serve como primeira barreira contra
 * formatos que o `Date` do JS aceitaria de forma permissiva (ex.: `01/02/2024`).
 */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Indica se um valor é uma string de data ISO 8601 válida (formato e data real).
 *
 * A checagem combina duas etapas: o formato precisa casar com {@link ISO_8601_REGEX}
 * e a string precisa resultar em uma data real (rejeitando, por exemplo,
 * `2024-02-30`).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidIso8601(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!ISO_8601_REGEX.test(trimmed)) {
    return false;
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    return false;
  }
  // Guarda contra datas de calendário inválidas normalizadas pelo JS
  // (ex.: 2024-02-30 vira março). Compara apenas a parte de data.
  const [datePart] = trimmed.split(/[T ]/);
  const parsed = new Date(timestamp);
  const isoDate = parsed.toISOString().slice(0, 10);
  if (datePart.length === 10 && isoDate !== datePart) {
    // Só reprova quando não há informação de fuso; com fuso, a normalização
    // de dia é esperada e não deve invalidar a entrada.
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed);
    if (!hasTimezone) {
      return false;
    }
  }
  return true;
}

/**
 * Valida o campo `cliente`.
 *
 * @param {unknown} cliente
 * @returns {{ ok: true, value: string } | { ok: false, mensagem: string }}
 */
function validateCliente(cliente) {
  if (typeof cliente !== 'string') {
    return {
      ok: false,
      mensagem: 'cliente é obrigatório e deve ser um texto entre 1 e 255 caracteres',
    };
  }
  const trimmed = cliente.trim();
  if (trimmed.length < CLIENTE_MIN || trimmed.length > CLIENTE_MAX) {
    return {
      ok: false,
      mensagem: 'cliente é obrigatório e deve ter entre 1 e 255 caracteres',
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Valida o campo `data` (ISO 8601).
 *
 * @param {unknown} data
 * @returns {{ ok: true, value: string } | { ok: false, mensagem: string }}
 */
function validateData(data) {
  if (!isValidIso8601(data)) {
    return {
      ok: false,
      mensagem: 'data é obrigatória e deve estar no formato ISO 8601',
    };
  }
  return { ok: true, value: data.trim() };
}

/**
 * Valida o campo `status` considerando o modo de operação.
 *
 * No modo `create`, `status` ausente assume o valor padrão `pendente`. No modo
 * `update`, `status` é obrigatório (Req 5.5). Em ambos os modos, quando
 * presente, deve pertencer ao enum permitido.
 *
 * @param {unknown} status
 * @param {'create'|'update'} mode
 * @returns {{ ok: true, value: string } | { ok: false, mensagem: string }}
 */
function validateStatus(status, mode) {
  const ausente = status === undefined || status === null;

  if (ausente) {
    if (mode === 'create') {
      return { ok: true, value: DEFAULT_STATUS };
    }
    return {
      ok: false,
      mensagem: `status é obrigatório e deve ser um de: ${STATUS_VALUES.join(', ')}`,
    };
  }

  if (typeof status !== 'string' || !STATUS_VALUES.includes(status)) {
    return {
      ok: false,
      mensagem: `status deve ser um de: ${STATUS_VALUES.join(', ')}`,
    };
  }

  return { ok: true, value: status };
}

/**
 * Valida o payload de uma Reserva para operações de escrita.
 *
 * Reúne a validação de `cliente`, `data` e `status`, acumulando todos os campos
 * inválidos encontrados. Quando válido, retorna também `value` com os campos
 * normalizados (`cliente` sem espaços nas bordas e `status` já com o default
 * aplicado quando aplicável), pronto para persistência.
 *
 * @param {unknown} input corpo da requisição.
 * @param {{ mode?: 'create'|'update' }} [options] `create` (POST, padrão) ou
 *   `update` (PUT). No modo `create`, `status` ausente vira `pendente`; no modo
 *   `update`, todos os campos obrigatórios (`cliente`, `data`, `status`) devem
 *   estar presentes.
 * @returns {{
 *   valid: boolean,
 *   errors: Array<{ campo: string, mensagem: string }>,
 *   value?: { cliente: string, data: string, status: string }
 * }}
 */
function validateReserva(input, options = {}) {
  const mode = options.mode === 'update' ? 'update' : 'create';
  const body = input && typeof input === 'object' ? input : {};

  const errors = [];
  const value = {};

  const clienteResult = validateCliente(body.cliente);
  if (clienteResult.ok) {
    value.cliente = clienteResult.value;
  } else {
    errors.push({ campo: 'cliente', mensagem: clienteResult.mensagem });
  }

  const dataResult = validateData(body.data);
  if (dataResult.ok) {
    value.data = dataResult.value;
  } else {
    errors.push({ campo: 'data', mensagem: dataResult.mensagem });
  }

  const statusResult = validateStatus(body.status, mode);
  if (statusResult.ok) {
    value.status = statusResult.value;
  } else {
    errors.push({ campo: 'status', mensagem: statusResult.mensagem });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], value };
}

module.exports = {
  STATUS_VALUES,
  DEFAULT_STATUS,
  CLIENTE_MIN,
  CLIENTE_MAX,
  isValidIso8601,
  validateReserva,
};
