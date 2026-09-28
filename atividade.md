

> **⚙️ Ambiente AWS:** 
>
> - Toda a parte de nuvem usa o **AWS Academy Learner Lab**. 
>
> - Credenciais são temporárias (com **Session Token**, via **AWS Details → AWS CLI**)
> 
> - Região sempre **us-east-1**
>
>  O Lab **não permite criar IAM users/groups/roles**, use a role pré-existente **`LabRole`** e o instance profile **`LabInstanceProfile`** quando precisar de permissões de serviço. 
> 
> **Sempre execute `terraform destroy`** ao final para não esgotar os créditos.

Esse é o seu desafio: entregar a **API de Reservas** da TechNova, do commit inicial até a infraestrutura na nuvem.

## O Que Construir

A **API de Reservas** é uma aplicação Node.js/Express que gerencia reservas (campos: `id`, `cliente`, `data`, `status`). Você vai entregar a jornada completa dela.

### Rotas obrigatórias (CRUD completo)

A API **deve** implementar o CRUD completo do recurso `reservas`, persistindo os dados no banco PostgreSQL:

| Método | Rota | Ação (CRUD) | Descrição |
|--------|------|-------------|-----------|
| `POST` | `/reservas` | **Create** | Cria uma nova reserva (valida os campos obrigatórios) |
| `GET` | `/reservas` | **Read** | Lista todas as reservas |
| `GET` | `/reservas/:id` | **Read** | Busca uma reserva pelo `id` (404 se não existir) |
| `PUT` | `/reservas/:id` | **Update** | Atualiza uma reserva existente |
| `DELETE` | `/reservas/:id` | **Delete** | Remove uma reserva |
| `GET` | `/health` | — | Health check (usado pelo healthcheck do Compose) |

> **Importante:** as rotas de CRUD devem **ler e gravar no banco de dados PostgreSQL** (não em memória) — tanto no ambiente local (Docker Compose) quanto na nuvem (RDS).


### Parte 1 — Docker (Aula 01)

- `Dockerfile` funcional da API de Reservas (multi-stage recomendado, usuário não-root)
- `.dockerignore` configurado
- Evidência de build e execução do container

### Parte 2 — Docker Compose (Aula 02)

- `docker-compose.yml` que sobe a **API + PostgreSQL**
- Volume nomeado para persistência do banco
- Rede bridge customizada, healthcheck no banco, `depends_on` com condição
- `.env.example` versionado (sem senhas reais) e `.env` no `.gitignore`

### Parte 3 — Infraestrutura AWS com Terraform, Módulos e Remote State (Aulas 03 a 06)

Provisione, com Terraform **modularizado**, no **AWS Academy Learner Lab**:

- **VPC** com subnets públicas e privadas em 2 AZs (módulo `vpc`)
- **Security Groups** com menor privilégio (módulo `security-group`): EC2 (22, 3000) e RDS (5432 apenas do SG do EC2)
- **EC2** t2.micro na subnet pública com a API (módulo `ec2`) — use o instance profile **`LabInstanceProfile`** se precisar de acesso a serviços
- **RDS** PostgreSQL db.t3.micro **provisionado e funcional** nas subnets privadas (módulo `rds`) — este é o **banco de dados da API na nuvem**, onde as rotas de CRUD gravam os dados. Deve ter `publicly_accessible = false`, `storage_encrypted = true`, `db_subnet_group_name` com as subnets privadas e ser acessível **apenas** a partir do Security Group da EC2 (porta 5432)
- **Remote State**: backend S3 (com versionamento e encriptação) + DynamoDB para locking
- Composição entre módulos (output de um alimenta input de outro)
- Tags em todos os recursos e outputs úteis (IP da EC2, endpoint do RDS, URL da API)

> **Importante (Learner Lab):** 
>
> NÃO crie IAM users/groups/roles — use `LabRole` / `LabInstanceProfile`. Região `us-east-1`. Rode `terraform destroy` após capturar evidências.

### Parte 4 — IA como Copiloto (Aulas 02 e 07)

- Use **Kiro (Spec-Driven)** ou outra LLM de sua escolha para gerar parte da solução (Dockerfile, docker-compose, módulos Terraform)
- Documente o processo no relatório (Parte 6)

---

## Estrutura do Repositório do Aluno

No **seu** repositório `prova-primeiro-bimestre-devops`:

```
prova-primeiro-bimestre-devops/
├── README.md                     # Nome, RA, descrição do projeto
├── .gitignore
├── app/                          # API de Reservas
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml            # API + PostgreSQL (ambiente local)
├── .env.example
├── infra/                        # Terraform modularizado
│   ├── modules/
│   │   ├── vpc/
│   │   ├── security-group/
│   │   ├── ec2/
│   │   └── rds/
│   ├── main.tf                   # Composição dos módulos
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf              # Provider AWS + backend S3
│   └── backend/                  # S3 + DynamoDB para remote state
├── evidencias/
│   ├── docker-build.txt          # ou screenshot
│   ├── compose-ps.txt            # docker compose ps
│   ├── terraform-plan.txt
│   └── (screenshots opcionais)
└── relatorio.md                  # Relatório do processo com IA

---

## Dicas

- Comece pelo Git e pela aplicação; containerize; suba local com Compose; só então vá para a AWS
- Reaproveite os módulos que você construiu na Aula 06 como base
- Crie o backend (S3 + DynamoDB) **antes** de configurar o `backend "s3"` no projeto principal
- Ao pedir código de infra para a IA, **diga explicitamente** que é AWS Academy Learner Lab e que deve usar `LabRole`/`LabInstanceProfile` sem criar IAM
- Se `terraform` der `ExpiredToken`, reinicie o Lab e atualize `~/.aws/credentials`
- O relatório vale tanto quanto o código — reserve tempo para escrevê-lo com honestidade
- Teste tudo antes do dia da entrega; no dia, foque em finalizar o `entrega.md` e abrir o PR
