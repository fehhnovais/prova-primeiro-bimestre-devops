'use strict';

const {
  DEFAULT_PORT,
  loadConfig,
  validateConnectionConfig,
} = require('../config');

describe('config.loadConfig', () => {
  test('lê DATABASE_URL quando presente', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgres://u:p@db:5432/reservas' });
    expect(cfg.databaseUrl).toBe('postgres://u:p@db:5432/reservas');
  });

  test('lê variáveis discretas PG*', () => {
    const cfg = loadConfig({
      PGHOST: 'db',
      PGPORT: '5432',
      PGUSER: 'reservas',
      PGPASSWORD: 'senha',
      PGDATABASE: 'reservas',
    });
    expect(cfg.pg).toEqual({
      host: 'db',
      port: 5432,
      user: 'reservas',
      password: 'senha',
      database: 'reservas',
    });
  });

  test('usa a porta padrão quando PORT ausente', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgres://x' });
    expect(cfg.port).toBe(DEFAULT_PORT);
  });

  test('lê a porta HTTP a partir de PORT', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgres://x', PORT: '8080' });
    expect(cfg.port).toBe(8080);
  });

  test('ignora PORT inválido e cai no padrão', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgres://x', PORT: 'abc' });
    expect(cfg.port).toBe(DEFAULT_PORT);
  });

  test('trata valores vazios/espaços como ausentes', () => {
    const cfg = loadConfig({ DATABASE_URL: '   ' });
    expect(cfg.databaseUrl).toBeUndefined();
  });
});

describe('config.validateConnectionConfig', () => {
  test('válido quando DATABASE_URL está presente', () => {
    const result = validateConnectionConfig({ DATABASE_URL: 'postgres://u:p@db:5432/reservas' });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  test('válido quando todas as variáveis discretas obrigatórias estão presentes', () => {
    const result = validateConnectionConfig({
      PGHOST: 'db',
      PGPORT: '5432',
      PGUSER: 'reservas',
      PGDATABASE: 'reservas',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  test('inválido e reporta ambas as alternativas quando nada foi informado', () => {
    const result = validateConnectionConfig({});
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'])
    );
  });

  test('identifica exatamente a variável discreta ausente', () => {
    const result = validateConnectionConfig({
      PGHOST: 'db',
      PGPORT: '5432',
      PGUSER: 'reservas',
      // PGDATABASE ausente
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['PGDATABASE']);
  });

  test('senha (PGPASSWORD) é opcional e não bloqueia a validação', () => {
    const result = validateConnectionConfig({
      PGHOST: 'db',
      PGPORT: '5432',
      PGUSER: 'reservas',
      PGDATABASE: 'reservas',
      // sem PGPASSWORD
    });
    expect(result.valid).toBe(true);
  });
});
