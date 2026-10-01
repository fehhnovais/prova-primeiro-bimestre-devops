# Implementation Plan: API de Reservas DevOps

## Overview

Este plano converte o design da jornada DevOps completa da **API de Reservas** em tarefas de codificação incrementais. A implementação segue a ordem: aplicação Node.js/Express com persistência em PostgreSQL via `pg` → testes (unitários + property-based com fast-check) → containerização (Docker) → orquestração local (Docker Compose) → infraestrutura AWS (Terraform modularizado + remote state) → documentação.

**Convenção de execução manual:** Tarefas prefixadas com **`[MANUAL]`** NÃO são executadas pelo agente. Elas provisionam infraestrutura ou sobem containers (`docker build`, `docker compose up`, `terraform init/plan/apply/destroy`) e devem ser rodadas pelo próprio usuário no terminal, com as credenciais do Learner Lab válidas. Cada tarefa manual lista os comandos exatos e a ordem. Tarefas de escrever/gerar código e testes são executadas normalmente.

## Tasks

- [x] 1. Setup do repositório e app base
  - [x] 1.1 Criar estrutura de diretórios e `package.json` da API
    - Criar `app/package.json` com dependências `express`, `pg` e devDependencies `jest`, `supertest`, `fast-check`
    - Definir script `test` (jest) e `start` (node src/server.js)
    - Criar estrutura de pastas `app/src/{db,validation,repository,routes,__tests__}`
    - _Requirements: 1.1, 8.1_

  - [x] 1.2 Implementar módulo de configuração de conexão (`config.js`)
    - Ler `DATABASE_URL` ou variáveis discretas `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` e `PORT`
    - Expor função que valida a presença da configuração de conexão e identifica a variável ausente
    - _Requirements: 1.4, 1.5_

  - [x] 1.3 Implementar pool do pg (`db/pool.js`)
    - Criar e exportar um `Pool` do `pg` a partir da configuração de `config.js`
    - Usar queries parametrizadas em todo acesso (sem ORM)
    - _Requirements: 1.1, 1.2_

  - [x] 1.4 Atualizar `.gitignore` para excluir `.env` e artefatos locais
    - Garantir que `.env`, `node_modules` e artefatos de build estejam no `.gitignore`
    - _Requirements: 10.8_

- [x] 2. Schema e camada de repositório
  - [x] 2.1 Criar schema de inicialização (`app/init.sql`)
    - Definir tabela `reservas` com `id SERIAL PRIMARY KEY`, `cliente VARCHAR(255) NOT NULL`, `data TIMESTAMPTZ NOT NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'pendente'` com `CHECK` do enum
    - Usar `CREATE TABLE IF NOT EXISTS` para idempotência
    - _Requirements: 1.3, 2.2_

  - [x] 2.2 Implementar repositório de reservas (`repository/reservasRepo.js`)
    - Implementar `create`, `findAll`, `findById`, `update`, `remove` e `ping` com queries parametrizadas e `RETURNING`
    - Garantir que operações de escrita usem instrução única para evitar persistência parcial
    - _Requirements: 1.2, 1.6, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_

  - [x]* 2.3 Escrever testes unitários do repositório com mock de pool
    - Testar mapeamento de retornos (`null`/`false`) e propagação de erro do `pg`
    - _Requirements: 1.6, 4.2_

- [x] 3. Validação, rotas CRUD, health check e error handling
  - [x] 3.1 Implementar regras de validação (`validation/reservaValidation.js`)
    - Validar `cliente` (1–255 após trim), `data` (ISO 8601 válida) e `status` (enum); default `pendente` quando ausente no POST
    - Retornar campo(s) inválido(s) para resposta 400
    - _Requirements: 1.3, 1.7, 2.2, 2.3, 2.4, 2.5, 5.3, 5.4, 5.5_

  - [x] 3.2 Implementar rotas CRUD de reservas (`routes/reservas.js`)
    - `POST /reservas` (201/400/500), `GET /reservas` (200), `GET /reservas/:id` (200/400/404/500), `PUT /reservas/:id` (200/400/404), `DELETE /reservas/:id` (204/404)
    - Validar formato do `id` antes de consultar existência
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.7, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2_

  - [x] 3.3 Implementar rota de health check (`routes/health.js`)
    - `GET /health` executa `ping()` (`SELECT 1`); 200 se conexão OK, 503 se falha
    - _Requirements: 7.1, 7.2_

  - [x] 3.4 Montar Express e middleware de erro global (`app.js`)
    - Configurar `express.json()`, montar rotas e error handler que normaliza `{ "error": { "campo"?, "mensagem" } }`
    - Mapear `SyntaxError` de corpo não-JSON para 400 e erros de banco para 500
    - _Requirements: 1.6, 2.6, 3.3, 4.4_

  - [x] 3.5 Implementar bootstrap do servidor (`server.js`)
    - Validar env de conexão na inicialização; se ausente, logar variável faltante e `process.exit(1)`
    - Subir HTTP na porta configurada; encerrar com código ≠ 0 se não conseguir conectar ao banco
    - _Requirements: 1.5, 9.6_

  - [x]* 3.6 Escrever testes unitários de sucesso por rota
    - POST→201, GET→200, GET/:id→200, PUT→200, DELETE→204
    - _Requirements: 8.2_

  - [x]* 3.7 Escrever testes unitários de validação e recurso inexistente
    - 400 com corpo indicando motivo; 404 para recurso inexistente; corpo não-JSON→400; `id` inválido→400
    - _Requirements: 8.3, 8.4, 2.6, 4.3, 5.2, 6.2_

  - [x]* 3.8 Escrever testes unitários de falha de banco e health (com mock)
    - Falha de INSERT/consulta→500; `/health` 200 e 503
    - _Requirements: 2.7, 3.3, 4.4, 7.1, 7.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Testes property-based com fast-check (>= 100 iterações)
  - [x]* 5.1 Property test: round-trip criar → buscar preserva dados
    - **Property 1: Round-trip criar → buscar preserva os dados**
    - Tag: `Feature: api-reservas-devops, Property 1: round-trip create→get`
    - `fc.assert(fc.property(...), { numRuns: 100 })`; truncar tabela antes de cada execução
    - _Requirements: 1.2, 1.3, 2.1, 4.1_ / _Properties: 1_

  - [x]* 5.2 Property test: `status` ausente assume `pendente`
    - **Property 2: `status` ausente assume o valor padrão `pendente`**
    - Tag: `Feature: api-reservas-devops, Property 2: default pendente`
    - _Requirements: 2.2_ / _Properties: 2_

  - [x]* 5.3 Property test: entrada inválida em criação nunca é persistida
    - **Property 3: Entrada inválida em criação nunca é persistida**
    - Tag: `Feature: api-reservas-devops, Property 3: POST inválido não persiste`
    - _Requirements: 1.7, 2.3, 2.4, 2.5_ / _Properties: 3_

  - [x]* 5.4 Property test: listagem reflete exatamente as inserções
    - **Property 4: A listagem reflete exatamente as inserções**
    - Tag: `Feature: api-reservas-devops, Property 4: list reflete inserts`
    - _Requirements: 3.1, 3.2_ / _Properties: 4_

  - [x]* 5.5 Property test: round-trip de atualização reflete novos dados
    - **Property 5: Round-trip de atualização reflete os novos dados**
    - Tag: `Feature: api-reservas-devops, Property 5: update round-trip`
    - _Requirements: 5.1_ / _Properties: 5_

  - [x]* 5.6 Property test: atualização inválida nunca altera o estado
    - **Property 6: Atualização inválida nunca altera o estado**
    - Tag: `Feature: api-reservas-devops, Property 6: update inválido não altera`
    - _Requirements: 5.3, 5.4, 5.5_ / _Properties: 6_

  - [x]* 5.7 Property test: remover torna a busca subsequente um 404
    - **Property 7: Remover torna a busca subsequente um 404**
    - Tag: `Feature: api-reservas-devops, Property 7: delete → get 404`
    - _Requirements: 6.1_ / _Properties: 7_

  - [x]* 5.8 Property test: busca por `id` inexistente resulta em 404
    - **Property 8: Busca por `id` inexistente resulta em 404**
    - Tag: `Feature: api-reservas-devops, Property 8: id inexistente → 404`
    - _Requirements: 4.2_ / _Properties: 8_

- [x] 6. Checkpoint - Ensure all tests pass (suíte completa <= 60s)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.5_

- [x] 7. Containerização com Docker
  - [x] 7.1 Criar `Dockerfile` multi-stage com usuário não-root
    - Build multi-stage separando construção e execução; diretiva `USER` não-root; expor porta 3000
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 7.2 Criar `.dockerignore`
    - Excluir `node_modules`, `.env`, artefatos de teste e `.git` do contexto de build
    - _Requirements: 9.4_

  - [x] 7.3 [MANUAL] Build e run do container Docker
    - Executar manualmente no terminal, na pasta `app/`:
      ```bash
      docker build -t api-reservas .
      docker run --rm -e DATABASE_URL="postgres://reservas:senha@host:5432/reservas" -p 3000:3000 api-reservas
      curl http://localhost:3000/health
      ```
    - Verificar resposta HTTP em ≤ 30s após início do container; testar container sem conexão ao banco confirmando exit code ≠ 0
    - _Requirements: 9.5, 9.6_

- [x] 8. Orquestração local com Docker Compose
  - [x] 8.1 Criar `docker-compose.yml` (api + db)
    - Serviços `api` (API_Reservas) e `db` (postgres); volume nomeado `pgdata`; rede bridge customizada
    - Healthcheck no `db` com `pg_isready`, intervalo ≤ 10s, ≤ 5 retries; `depends_on` da `api` condicionado a `service_healthy`
    - Montar `init.sql` em `/docker-entrypoint-initdb.d/`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 8.2 Criar `.env.example` versionado
    - Documentar `DATABASE_URL`/`PG*` e `PORT` com valores de exemplo, sem senhas reais
    - _Requirements: 10.7_

  - [x] 8.3 [MANUAL] Subir o ambiente local com Docker Compose
    - Executar manualmente no terminal, na raiz do repositório:
      ```bash
      cp .env.example .env      # preencher senha localmente (não versionar)
      docker compose up --build # aguarda db saudável antes de subir a api
      docker compose ps
      curl http://localhost:3000/health
      ```
    - Confirmar que o `db` atinge `service_healthy` antes da `api` iniciar
    - _Requirements: 10.1, 10.5, 10.6_

- [x] 9. Módulos Terraform de infraestrutura
  - [x] 9.1 Implementar módulo VPC (`infra/modules/vpc`)
    - Provisionar VPC com 2 subnets públicas e 2 privadas em 2 AZs distintas de `us-east-1`; Internet Gateway e roteamento
    - Expor outputs: id da VPC, lista de subnets públicas, lista de subnets privadas; aplicar tags de nome e ambiente
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 17.1_

  - [x] 9.2 Implementar módulo security-group (`infra/modules/security-group`)
    - SG do EC2: entrada TCP 22 e 3000 de faixas parametrizáveis; SG do RDS: entrada TCP 5432 exclusivamente do SG do EC2; negar demais
    - Aplicar tags de nome e ambiente
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 9.3 Implementar módulo EC2 (`infra/modules/ec2`)
    - 1 instância `t2.micro` em subnet pública; associar SG de EC2 e `LabInstanceProfile`
    - `user_data` para subir a API na porta 3000 e aplicar `init.sql` no RDS; tags de nome e ambiente
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 17.2_

  - [x] 9.4 Implementar módulo RDS (`infra/modules/rds`)
    - 1 instância RDS PostgreSQL `db.t3.micro` com db subnet group das 2 subnets privadas
    - `publicly_accessible=false`, `storage_encrypted=true`, associar SG de RDS; tags de nome e ambiente
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 9.5 Implementar bootstrap do remote state (`infra/backend`)
    - `main.tf` com bucket S3 (versionamento + SSE) e tabela DynamoDB com chave `LockID`; `variables.tf` e `outputs.tf`
    - _Requirements: 16.1, 16.2_

  - [x] 9.6 Implementar composição raiz (`infra/`)
    - `providers.tf` (provider aws `us-east-1` + backend `s3`), `variables.tf`, `main.tf` compondo os módulos com outputs da VPC, `outputs.tf`
    - Alimentar SG do RDS com SG do EC2; expor `ec2_public_ip`, `rds_endpoint`, `api_url` (http://IP:3000); tags de projeto e ambiente
    - Não declarar `aws_iam_user`, `aws_iam_group` nem `aws_iam_role`; usar `LabRole`/`LabInstanceProfile`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 16.3, 16.4, 16.5, 17.2, 17.3, 17.4_

- [x] 10. Execução manual da infraestrutura (Learner Lab)
  - [x]* 10.1 [MANUAL] Bootstrap do remote state (S3 + DynamoDB)
    - Executar manualmente em `infra/backend` (state local neste passo):
      ```bash
      cd infra/backend
      terraform init
      terraform apply   # cria bucket S3 (versionado+SSE) e tabela DynamoDB (LockID)
      ```
    - _Requirements: 16.1, 16.2, 17.4_

  - [x]* 10.2 [MANUAL] Init do projeto principal com backend S3
    - Executar manualmente em `infra/`:
      ```bash
      cd infra
      terraform init   # configura backend "s3" apontando para o bucket/tabela criados
      ```
    - _Requirements: 16.3_

  - [x]* 10.3 [MANUAL] Plan e Apply da infraestrutura
    - Executar manualmente em `infra/`:
      ```bash
      terraform plan -out=tfplan
      terraform apply tfplan
      ```
    - Requer Session Token válido do Learner Lab; se `ExpiredToken`, reiniciar o Lab e atualizar credenciais
    - _Requirements: 11.1, 12.1, 12.2, 13.1, 14.1, 14.2, 14.3, 15.1, 15.2, 17.1, 17.4, 17.5_

  - [x]* 10.4 [MANUAL] Verificar outputs da infraestrutura
    - Executar manualmente em `infra/`:
      ```bash
      terraform output   # ec2_public_ip, rds_endpoint, api_url
      curl http://<ec2_public_ip>:3000/health
      ```
    - _Requirements: 15.3, 15.4, 15.5_

  - [x]* 10.5 [MANUAL] Destroy ao final (obrigatório no Learner Lab)
    - Executar manualmente para não esgotar créditos:
      ```bash
      cd infra && terraform destroy          # VPC, SG, EC2, RDS
      cd backend && terraform destroy         # remove S3 + DynamoDB do remote state
      ```
    - _Requirements: 17.1_

- [x] 11. Documentação do repositório
  - [x] 11.1 Criar `README.md` na raiz
    - Incluir o nome "Fernanda Novais", o RA "4025109" e uma descrição do projeto com ao menos um parágrafo
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido. Isso inclui os testes (unitários e property-based) e as tarefas `[MANUAL]` de nuvem que dependem de credenciais do Learner Lab.
- Tarefas prefixadas com `[MANUAL]` NÃO são executadas pelo agente: o usuário roda os comandos no próprio terminal e observa/cola a saída. Os arquivos correspondentes (Dockerfile, docker-compose.yml, `.tf`) são criados por tarefas normais de codificação.
- Cada tarefa referencia os requisitos (`_Requirements: X.Y_`) e, quando aplicável, as propriedades de correção (`_Properties: N_`) para rastreabilidade.
- Os 8 testes property-based usam `fast-check` com no mínimo 100 iterações e a tag `Feature: api-reservas-devops, Property N: ...`.
- Checkpoints garantem validação incremental; a suíte completa deve concluir em ≤ 60s (Req 8.5).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "9.1", "9.2", "9.5"] },
    { "id": 1, "tasks": ["1.2", "2.1", "9.4"] },
    { "id": 2, "tasks": ["1.3", "3.1", "9.3", "9.6"] },
    { "id": 3, "tasks": ["2.2", "10.1"] },
    { "id": 4, "tasks": ["2.3", "3.2", "3.3", "10.2"] },
    { "id": 5, "tasks": ["3.4", "10.3"] },
    { "id": 6, "tasks": ["3.5", "7.1", "7.2", "8.1", "8.2", "10.4"] },
    { "id": 7, "tasks": ["3.6", "3.7", "3.8", "7.3", "8.3", "10.5", "11.1"] },
    { "id": 8, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8"] }
  ]
}
```
