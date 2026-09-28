'use strict';

const {
  STATUS_VALUES,
  DEFAULT_STATUS,
  isValidIso8601,
  validateReserva,
} = require('../validation/reservaValidation');

describe('reservaValidation.isValidIso8601', () => {
  test('aceita data ISO 8601 no formato YYYY-MM-DD', () => {
    expect(isValidIso8601('2024-02-15')).toBe(true);
  });

  test('aceita data-hora ISO 8601 com fuso Z', () => {
    expect(isValidIso8601('2024-02-15T10:30:00Z')).toBe(true);
  });

  test('aceita data-hora ISO 8601 com offset', () => {
    expect(isValidIso8601('2024-02-15T10:30:00-03:00')).toBe(true);
  });

  test('rejeita formato não-ISO (dd/mm/aaaa)', () => {
    expect(isValidIso8601('15/02/2024')).toBe(false);
  });

  test('rejeita data de calendário inválida', () => {
    expect(isValidIso8601('2024-02-30')).toBe(false);
  });

  test('rejeita valores não-string', () => {
    expect(isValidIso8601(undefined)).toBe(false);
    expect(isValidIso8601(null)).toBe(false);
    expect(isValidIso8601(1234567890)).toBe(false);
  });
});

describe('reservaValidation.validateReserva (create)', () => {
  test('aceita reserva válida completa', () => {
    const result = validateReserva({
      cliente: 'Fernanda',
      data: '2024-02-15',
      status: 'confirmada',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      cliente: 'Fernanda',
      data: '2024-02-15',
      status: 'confirmada',
    });
  });

  test('aplica default pendente quando status ausente', () => {
    const result = validateReserva({ cliente: 'Ana', data: '2024-02-15' });
    expect(result.valid).toBe(true);
    expect(result.value.status).toBe(DEFAULT_STATUS);
    expect(result.value.status).toBe('pendente');
  });

  test('faz trim no cliente antes de persistir', () => {
    const result = validateReserva({ cliente: '  Ana  ', data: '2024-02-15' });
    expect(result.valid).toBe(true);
    expect(result.value.cliente).toBe('Ana');
  });

  test('rejeita cliente ausente com campo cliente', () => {
    const result = validateReserva({ data: '2024-02-15' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ campo: 'cliente' }),
    ]);
  });

  test('rejeita cliente vazio (apenas espaços)', () => {
    const result = validateReserva({ cliente: '   ', data: '2024-02-15' });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('cliente');
  });

  test('rejeita cliente com mais de 255 caracteres', () => {
    const result = validateReserva({
      cliente: 'x'.repeat(256),
      data: '2024-02-15',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('cliente');
  });

  test('aceita cliente no limite de 255 caracteres', () => {
    const result = validateReserva({
      cliente: 'x'.repeat(255),
      data: '2024-02-15',
    });
    expect(result.valid).toBe(true);
  });

  test('rejeita data ausente com campo data', () => {
    const result = validateReserva({ cliente: 'Ana' });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('data');
  });

  test('rejeita data em formato inválido', () => {
    const result = validateReserva({ cliente: 'Ana', data: '15-02-2024' });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('data');
  });

  test('rejeita status fora do enum', () => {
    const result = validateReserva({
      cliente: 'Ana',
      data: '2024-02-15',
      status: 'aprovada',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('status');
  });

  test('acumula múltiplos campos inválidos', () => {
    const result = validateReserva({ cliente: '', data: 'x', status: 'y' });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo).sort()).toEqual([
      'cliente',
      'data',
      'status',
    ]);
  });

  test('trata corpo não-objeto como campos ausentes', () => {
    const result = validateReserva(null);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('cliente');
    expect(result.errors.map((e) => e.campo)).toContain('data');
  });

  test('aceita todos os valores do enum de status', () => {
    for (const status of STATUS_VALUES) {
      const result = validateReserva({ cliente: 'Ana', data: '2024-02-15', status });
      expect(result.valid).toBe(true);
      expect(result.value.status).toBe(status);
    }
  });
});

describe('reservaValidation.validateReserva (update)', () => {
  test('aceita atualização válida completa', () => {
    const result = validateReserva(
      { cliente: 'Ana', data: '2024-02-15', status: 'cancelada' },
      { mode: 'update' }
    );
    expect(result.valid).toBe(true);
    expect(result.value.status).toBe('cancelada');
  });

  test('status é obrigatório no update (sem default)', () => {
    const result = validateReserva(
      { cliente: 'Ana', data: '2024-02-15' },
      { mode: 'update' }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.campo)).toContain('status');
  });
});
