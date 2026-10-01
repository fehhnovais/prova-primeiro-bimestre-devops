# API de Reservas — Jornada DevOps

**Aluna:** Fernanda Novais
**RA:** 4025109

## Descrição do projeto

Este projeto é uma jornada DevOps completa em torno de uma **API de Reservas** da TechNova. A aplicação é construída em **Node.js/Express** e expõe um CRUD completo do recurso `reservas` (campos `id`, `cliente`, `data` e `status`), além de uma rota de health check (`GET /health`). Toda a persistência é feita **exclusivamente em PostgreSQL**, acessado pelo driver `pg` (node-postgres) com queries parametrizadas e sem ORM, garantindo que os dados sobrevivam a reinícios da aplicação. A API valida os dados de entrada na camada de aplicação (retornando HTTP 400 amigável) e conta com uma restrição `CHECK` no banco como defesa em profundidade.

Além da aplicação, o projeto cobre a esteira de entrega ponta a ponta: **containerização com Docker** (Dockerfile multi-stage executando com usuário não-root), **orquestração local com Docker Compose** (serviços da API e do PostgreSQL, volume nomeado, rede bridge customizada e healthcheck do banco) e **provisionamento de infraestrutura na AWS com Terraform** modularizado (VPC com subnets públicas e privadas, Security Groups de menor privilégio, EC2, RDS PostgreSQL) usando **remote state** em bucket S3 versionado/criptografado com locking em DynamoDB. A infraestrutura respeita as restrições do AWS Academy Learner Lab (região `us-east-1`, uso de `LabRole`/`LabInstanceProfile`, sem criação de recursos IAM). A qualidade é assegurada por uma suíte de testes automatizados com **Jest**, **Supertest** e testes property-based com **fast-check**.

## Rotas da API

| Método | Rota              | Descrição                          |
|--------|-------------------|------------------------------------|
| POST   | `/reservas`       | Cria uma reserva (201)             |
| GET    | `/reservas`       | Lista todas as reservas (200)      |
| GET    | `/reservas/:id`   | Busca uma reserva por id (200/404) |
| PUT    | `/reservas/:id`   | Atualiza uma reserva (200/404)     |
| DELETE | `/reservas/:id`   | Remove uma reserva (204/404)       |
| GET    | `/health`         | Verifica a saúde do serviço (200/503) |

O recurso `reservas` possui os campos:

- `id`: identificador único gerado pelo banco (`SERIAL`).
- `cliente`: texto não vazio com até 255 caracteres.
- `data`: data/hora válida no formato ISO 8601.
- `status`: um de `pendente`, `confirmada` ou `cancelada` (padrão `pendente`).

## Como executar localmente

### Opção 1 — Node.js diretamente

Requer um PostgreSQL acessível e as variáveis de conexão configuradas.

```bash
cd app
npm ci
npm test        # Jest + Supertest + fast-check
npm start       # sobe a API na porta configurada (padrão 3000)
```

Configuração de conexão via `DATABASE_URL` ou variáveis discretas (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) e `PORT`.

### Opção 2 — Docker Compose (API + PostgreSQL)

```bash
cp .env.example .env       # preencha a senha localmente (não versione)
docker compose up --build  # aguarda o banco ficar saudável antes de subir a API
docker compose ps
curl http://localhost:3000/health
```

O `init.sql` é montado no container do PostgreSQL e cria o schema da tabela `reservas` na primeira inicialização do volume.

## Infraestrutura na AWS (Terraform)

Os comandos de infraestrutura são executados manualmente, com credenciais válidas do Learner Lab.

```bash
# 1. Bootstrap do remote state (cria S3 + DynamoDB)
cd infra/backend
terraform init
terraform apply

# 2. Projeto principal com backend S3
cd ..
terraform init
terraform plan -out=tfplan
terraform apply tfplan
terraform output          # ec2_public_ip, rds_endpoint, api_url

# 3. Destroy ao final (obrigatório no Learner Lab)
terraform destroy
cd backend && terraform destroy
```

## Estrutura do repositório

```
prova-primeiro-bimestre-devops/
├── README.md
├── docker-compose.yml
├── .env.example
├── app/                 # API Node.js/Express + PostgreSQL (pg)
│   ├── Dockerfile
│   ├── init.sql
│   └── src/
└── infra/               # Terraform (VPC, SG, EC2, RDS, remote state)
    ├── modules/
    └── backend/
```


## Evidências

As evidências de execução (Docker, Terraform, AWS) estão na pasta
[`evidencias/`](./evidencias/), com o histórico da interação com a IA em
[`evidencias/historico_kiro.md`](./evidencias/historico_kiro.md).
