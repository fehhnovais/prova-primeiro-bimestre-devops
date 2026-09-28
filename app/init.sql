-- Schema de inicialização da API de Reservas
-- Executado automaticamente pelo container Postgres (montado em
-- /docker-entrypoint-initdb.d/) e aplicável no RDS de forma idempotente.
-- Requisitos: 1.3 (campos e regras da Reserva), 2.2 (status default 'pendente').

CREATE TABLE IF NOT EXISTS reservas (
    id       SERIAL PRIMARY KEY,
    cliente  VARCHAR(255) NOT NULL CHECK (char_length(trim(cliente)) BETWEEN 1 AND 255),
    data     TIMESTAMPTZ NOT NULL,
    status   VARCHAR(20) NOT NULL DEFAULT 'pendente'
             CHECK (status IN ('pendente', 'confirmada', 'cancelada'))
);
