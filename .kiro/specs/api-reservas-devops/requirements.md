# Requirements Document

## Introduction

Este documento define os requisitos da jornada DevOps completa da **API de Reservas** da TechNova. A entrega abrange desde a aplicação Node.js/Express com persistência em PostgreSQL, passando pela containerização com Docker e orquestração local com Docker Compose, até o provisionamento de infraestrutura na AWS com Terraform modularizado e remote state, seguindo as restrições do AWS Academy Learner Lab.

O recurso central é `reservas` (campos: `id`, `cliente`, `data`, `status`), com CRUD completo persistido exclusivamente em banco de dados PostgreSQL (nunca em memória), tanto no ambiente local quanto na nuvem.

Estão **fora do escopo** deste spec: a coleta de arquivos de evidência (docker-build.txt, compose-ps.txt, terraform-plan.txt, screenshots) e o `relatorio.md`.

## Glossary

- **API_Reservas**: Aplicação Node.js/Express que expõe as rotas HTTP do recurso `reservas` e da rota de saúde.
- **Reserva**: Entidade de domínio com os campos `id`, `cliente`, `data` e `status`.
- **Banco_PostgreSQL**: Instância de banco de dados PostgreSQL onde as reservas são persistidas, acessada via driver `pg` (node-postgres).
- **Driver_PG**: Biblioteca `pg` (node-postgres) usada para acesso ao PostgreSQL sem ORM.
- **Suite_Testes**: Conjunto de testes automatizados escritos com Jest e Supertest.
- **Imagem_Docker**: Imagem de container produzida pelo Dockerfile da API_Reservas.
- **Compose_Stack**: Conjunto de serviços orquestrados pelo docker-compose.yml (API_Reservas + Banco_PostgreSQL).
- **Terraform_Infra**: Configuração Terraform modularizada que provisiona os recursos AWS.
- **Modulo_VPC**: Módulo Terraform que provisiona a VPC com subnets públicas e privadas.
- **Modulo_SG**: Módulo Terraform `security-group` que provisiona os Security Groups.
- **Modulo_EC2**: Módulo Terraform que provisiona a instância EC2.
- **Modulo_RDS**: Módulo Terraform que provisiona o banco PostgreSQL no RDS.
- **Remote_State**: Backend de estado remoto do Terraform composto por bucket S3 e tabela DynamoDB.
- **Learner_Lab**: Ambiente AWS Academy Learner Lab, região `us-east-1`, com credenciais temporárias e restrições de IAM.
- **LabRole**: Role IAM pré-existente do Learner_Lab usada em vez de criar novas roles.
- **LabInstanceProfile**: Instance profile pré-existente do Learner_Lab usado pela EC2.
- **Repositorio**: Repositório Git do projeto `prova-primeiro-bimestre-devops`.

## Requirements

### Requirement 1: Persistência de reservas em PostgreSQL

**User Story:** Como desenvolvedor da TechNova, quero que as reservas sejam gravadas em um banco PostgreSQL, para que os dados sejam persistidos de forma durável e não se percam entre reinícios da aplicação.

#### Acceptance Criteria

1. THE API_Reservas SHALL acessar o Banco_PostgreSQL por meio do Driver_PG sem uso de ORM.
2. WHEN qualquer rota de CRUD do recurso `reservas` é executada, THE API_Reservas SHALL ler ou gravar os dados no Banco_PostgreSQL.
3. THE API_Reservas SHALL persistir cada Reserva com os campos `id` (identificador único, não nulo), `cliente` (texto não vazio com no máximo 255 caracteres), `data` (data válida no formato ISO 8601) e `status` (um dos valores permitidos: `pendente`, `confirmada` ou `cancelada`).
4. WHERE a variável de ambiente de conexão do Banco_PostgreSQL está definida, THE API_Reservas SHALL usar essa configuração para estabelecer a conexão.
5. IF a variável de ambiente de conexão do Banco_PostgreSQL não está definida na inicialização, THEN THE API_Reservas SHALL interromper a inicialização e registrar uma indicação de erro identificando a variável de conexão ausente.
6. IF a conexão com o Banco_PostgreSQL falha durante uma operação de CRUD, THEN THE API_Reservas SHALL responder com o código de status HTTP 500, retornar uma indicação de erro informando a falha de conexão e não persistir dados parciais da operação.
7. IF os dados de uma Reserva recebida em uma operação de escrita não atendem às regras de validação dos campos `id`, `cliente`, `data` ou `status`, THEN THE API_Reservas SHALL rejeitar a operação com o código de status HTTP 400, retornar uma indicação de erro identificando o campo inválido e não gravar dados no Banco_PostgreSQL.

### Requirement 2: Criar reserva (POST /reservas)

**User Story:** Como cliente da API, quero criar uma nova reserva, para que ela fique registrada no sistema.

#### Acceptance Criteria

1. WHEN uma requisição `POST /reservas` é recebida com `cliente` não-vazio contendo entre 1 e 255 caracteres, `data` em formato ISO 8601 (data ou data-hora válida) e `status` igual a `pendente`, `confirmada` ou `cancelada`, THE API_Reservas SHALL inserir a Reserva no Banco_PostgreSQL e responder com o código de status HTTP 201 e a Reserva criada incluindo o `id` gerado.
2. WHERE o campo `status` está ausente na requisição `POST /reservas`, THE API_Reservas SHALL atribuir o valor `pendente` ao campo `status` da Reserva.
3. IF a requisição `POST /reservas` possui o campo `cliente` ausente, vazio ou com mais de 255 caracteres, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e uma mensagem de erro indicando que o campo `cliente` é inválido, sem inserir nenhuma Reserva no Banco_PostgreSQL.
4. IF a requisição `POST /reservas` possui o campo `data` ausente ou fora do formato ISO 8601, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e uma mensagem de erro indicando que o campo `data` é inválido, sem inserir nenhuma Reserva no Banco_PostgreSQL.
5. IF a requisição `POST /reservas` possui o campo `status` com valor diferente de `pendente`, `confirmada` ou `cancelada`, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e uma mensagem de erro indicando que o campo `status` é inválido, sem inserir nenhuma Reserva no Banco_PostgreSQL.
6. IF a requisição `POST /reservas` possui um corpo que não é um JSON válido, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e uma mensagem de erro indicando que o corpo da requisição é inválido, sem inserir nenhuma Reserva no Banco_PostgreSQL.
7. IF a inserção da Reserva no Banco_PostgreSQL falha, THEN THE API_Reservas SHALL responder com o código de status HTTP 500 e uma mensagem de erro indicando falha ao persistir a reserva, sem retornar um `id` gerado.

### Requirement 3: Listar reservas (GET /reservas)

**User Story:** Como cliente da API, quero listar todas as reservas, para que eu possa visualizar os registros existentes.

#### Acceptance Criteria

1. WHEN uma requisição `GET /reservas` é recebida, THE API_Reservas SHALL retornar todas as reservas armazenadas no Banco_PostgreSQL com o código de status HTTP 200 em no máximo 2 segundos.
2. WHILE não existem reservas no Banco_PostgreSQL, THE API_Reservas SHALL responder à requisição `GET /reservas` com uma lista vazia e o código de status HTTP 200.
3. IF o Banco_PostgreSQL está indisponível ou a consulta falha ao processar uma requisição `GET /reservas`, THEN THE API_Reservas SHALL responder com o código de status HTTP 500 e uma mensagem de erro indicando falha ao recuperar as reservas.

### Requirement 4: Buscar reserva por id (GET /reservas/:id)

**User Story:** Como cliente da API, quero buscar uma reserva pelo seu identificador, para que eu possa consultar seus detalhes.

#### Acceptance Criteria

1. WHEN uma requisição `GET /reservas/:id` é recebida e existe uma Reserva com o `id` informado, THE API_Reservas SHALL retornar essa Reserva com o código de status HTTP 200 em no máximo 2 segundos.
2. IF uma requisição `GET /reservas/:id` referencia um `id` inexistente no Banco_PostgreSQL, THEN THE API_Reservas SHALL responder com o código de status HTTP 404 e uma mensagem de erro indicando que a reserva com o `id` informado não foi encontrada.
3. IF uma requisição `GET /reservas/:id` referencia um `id` com formato inválido, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e uma mensagem de erro indicando que o `id` informado é inválido.
4. IF o Banco_PostgreSQL está indisponível ou a consulta falha ao processar uma requisição `GET /reservas/:id`, THEN THE API_Reservas SHALL responder com o código de status HTTP 500 e uma mensagem de erro indicando falha ao recuperar a reserva.

### Requirement 5: Atualizar reserva (PUT /reservas/:id)

**User Story:** Como cliente da API, quero atualizar uma reserva existente, para que eu possa corrigir ou alterar seus dados.

#### Acceptance Criteria

1. WHEN uma requisição `PUT /reservas/:id` é recebida com todos os campos obrigatórios (`cliente`, `data`, `status`) presentes e válidos e existe uma Reserva com o `id` informado, THE API_Reservas SHALL atualizar a Reserva no Banco_PostgreSQL e responder, em até 2 segundos, com o código de status HTTP 200 e o corpo contendo a Reserva atualizada.
2. IF uma requisição `PUT /reservas/:id` referencia um `id` inexistente no Banco_PostgreSQL, THEN THE API_Reservas SHALL responder com o código de status HTTP 404 e um corpo com mensagem de erro indicando que a Reserva não foi encontrada, sem alterar dados no Banco_PostgreSQL.
3. IF uma requisição `PUT /reservas/:id` possui o campo `status` com valor diferente de `pendente`, `confirmada` ou `cancelada`, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e um corpo com mensagem de erro indicando o valor inválido de `status`, sem alterar dados no Banco_PostgreSQL.
4. IF uma requisição `PUT /reservas/:id` possui o campo `data` presente e fora do formato ISO 8601, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e um corpo com mensagem de erro indicando o formato inválido de `data`, sem alterar dados no Banco_PostgreSQL.
5. IF uma requisição `PUT /reservas/:id` está ausente de pelo menos um dos campos obrigatórios (`cliente`, `data`, `status`) ou possui o campo `cliente` vazio ou com mais de 255 caracteres, THEN THE API_Reservas SHALL responder com o código de status HTTP 400 e um corpo com mensagem de erro indicando quais campos estão ausentes ou inválidos, sem alterar dados no Banco_PostgreSQL.

### Requirement 6: Remover reserva (DELETE /reservas/:id)

**User Story:** Como cliente da API, quero remover uma reserva, para que registros indesejados sejam eliminados do sistema.

#### Acceptance Criteria

1. WHEN uma requisição `DELETE /reservas/:id` é recebida e existe uma Reserva com o `id` informado, THE API_Reservas SHALL remover a Reserva do Banco_PostgreSQL e responder, em até 2 segundos, com o código de status HTTP 204 e corpo vazio.
2. IF uma requisição `DELETE /reservas/:id` referencia um `id` inexistente no Banco_PostgreSQL, THEN THE API_Reservas SHALL responder com o código de status HTTP 404 e um corpo com mensagem de erro indicando que a Reserva não foi encontrada, sem remover dados no Banco_PostgreSQL.

### Requirement 7: Health check (GET /health)

**User Story:** Como orquestrador de containers, quero consultar o estado de saúde da API, para que eu possa determinar se o serviço está pronto para receber tráfego.

#### Acceptance Criteria

1. WHEN uma requisição `GET /health` é recebida e a API_Reservas está operacional (processo em execução e conexão com o Banco_PostgreSQL estabelecida), THE API_Reservas SHALL responder, em até 2 segundos, com o código de status HTTP 200.
2. IF uma requisição `GET /health` é recebida e a API_Reservas não consegue estabelecer conexão com o Banco_PostgreSQL, THEN THE API_Reservas SHALL responder, em até 2 segundos, com o código de status HTTP 503 e um corpo com mensagem indicando que o serviço está indisponível.

### Requirement 8: Testes automatizados

**User Story:** Como desenvolvedor, quero uma suíte de testes automatizados das rotas, para que eu possa validar o comportamento do CRUD de forma repetível.

#### Acceptance Criteria

1. THE Suite_Testes SHALL usar Jest e Supertest para exercitar as rotas HTTP da API_Reservas.
2. THE Suite_Testes SHALL incluir pelo menos um teste de caso de sucesso para cada uma das rotas `POST /reservas` (resposta HTTP 201), `GET /reservas` (resposta HTTP 200), `GET /reservas/:id` (resposta HTTP 200), `PUT /reservas/:id` (resposta HTTP 200) e `DELETE /reservas/:id` (resposta HTTP 200 ou 204).
3. WHEN uma requisição contém dados de entrada que violam as regras de validação, THE Suite_Testes SHALL verificar que a API_Reservas responde com HTTP 400 e um corpo indicando o motivo da falha de validação.
4. IF uma requisição referencia um recurso de reserva inexistente pelo identificador, THEN THE Suite_Testes SHALL verificar que a API_Reservas responde com HTTP 404 e um corpo indicando que o recurso não foi encontrado.
5. WHEN a suíte de testes é executada, THE Suite_Testes SHALL concluir a execução completa em no máximo 60 segundos e reportar o resultado de aprovação ou reprovação de cada teste.

### Requirement 9: Containerização com Docker

**User Story:** Como engenheiro DevOps, quero uma imagem Docker funcional da API, para que a aplicação seja executada de forma isolada e reproduzível.

#### Acceptance Criteria

1. THE Imagem_Docker SHALL ser construída a partir de um Dockerfile que empacota a API_Reservas.
2. THE Imagem_Docker SHALL executar a API_Reservas com um usuário não-root.
3. THE Dockerfile SHALL usar build multi-stage para separar as etapas de construção e execução.
4. THE Repositorio SHALL incluir um arquivo `.dockerignore` que exclui do contexto de build no mínimo os diretórios e arquivos `node_modules`, `.env` e os artefatos de teste e controle de versão.
5. WHEN o container da Imagem_Docker é iniciado com a configuração de conexão do Banco_PostgreSQL válida, THE API_Reservas SHALL responder às requisições HTTP nas rotas definidas em no máximo 30 segundos após o início do container.
6. IF o container da Imagem_Docker é iniciado sem conseguir estabelecer conexão com o Banco_PostgreSQL, THEN THE API_Reservas SHALL registrar um erro indicando a falha de conexão e encerrar com código de saída diferente de zero.

### Requirement 10: Orquestração local com Docker Compose

**User Story:** Como desenvolvedor, quero subir a API e o banco com um único comando, para que eu possa executar o ambiente local completo rapidamente.

#### Acceptance Criteria

1. THE Compose_Stack SHALL definir os serviços API_Reservas e Banco_PostgreSQL em um arquivo `docker-compose.yml`.
2. THE Compose_Stack SHALL definir um volume nomeado que persiste os dados do Banco_PostgreSQL entre reinícios dos containers.
3. THE Compose_Stack SHALL definir uma rede bridge customizada que conecta os serviços API_Reservas e Banco_PostgreSQL.
4. THE Compose_Stack SHALL definir um healthcheck no serviço Banco_PostgreSQL com intervalo máximo de 10 segundos entre verificações e no máximo 5 tentativas antes de marcar o serviço como não saudável.
5. WHILE o serviço Banco_PostgreSQL não estiver no estado saudável, THE Compose_Stack SHALL impedir o início do serviço API_Reservas por meio de `depends_on` condicionado ao estado saudável do serviço Banco_PostgreSQL.
6. IF o serviço Banco_PostgreSQL não atingir o estado saudável dentro do número máximo de tentativas do healthcheck, THEN THE Compose_Stack SHALL marcar o serviço Banco_PostgreSQL como não saudável e não iniciar o serviço API_Reservas.
7. THE Repositorio SHALL incluir um arquivo `.env.example` versionado que documenta as variáveis de ambiente com valores de exemplo ou vazios, sem conter senhas reais.
8. THE Repositorio SHALL incluir o arquivo `.env` na lista de exclusão do `.gitignore`.

### Requirement 11: Módulo Terraform de VPC

**User Story:** Como engenheiro de infraestrutura, quero uma VPC modularizada com subnets públicas e privadas, para que os recursos fiquem segmentados por níveis de exposição.

#### Acceptance Criteria

1. THE Modulo_VPC SHALL provisionar uma VPC contendo exatamente 1 subnet pública e 1 subnet privada em cada uma de 2 zonas de disponibilidade distintas da região `us-east-1`, totalizando 2 subnets públicas e 2 subnets privadas.
2. THE Modulo_VPC SHALL expor como outputs o identificador da VPC, a lista de identificadores das 2 subnets públicas e a lista de identificadores das 2 subnets privadas.
3. THE Modulo_VPC SHALL aplicar em todos os recursos que provisiona ao menos as tags de nome do recurso e de ambiente.
4. IF o provisionamento de qualquer subnet ou da VPC falhar, THEN THE Modulo_VPC SHALL interromper a aplicação retornando uma mensagem de erro que identifique o recurso que falhou e não deixar recursos parcialmente provisionados aplicados.

### Requirement 12: Módulo Terraform de Security Group

**User Story:** Como engenheiro de segurança, quero Security Groups com menor privilégio, para que apenas o tráfego necessário seja permitido entre os recursos.

#### Acceptance Criteria

1. THE Modulo_SG SHALL provisionar um Security Group para o Modulo_EC2 que permite tráfego de entrada TCP nas portas 22 e 3000 a partir de faixas de origem parametrizáveis, e negar todo o demais tráfego de entrada.
2. THE Modulo_SG SHALL provisionar um Security Group para o Modulo_RDS que permite tráfego de entrada TCP na porta 5432 exclusivamente a partir do Security Group do Modulo_EC2, e negar todo o demais tráfego de entrada.
3. THE Modulo_SG SHALL aplicar em todos os recursos que provisiona ao menos as tags de nome do recurso e de ambiente.

### Requirement 13: Módulo Terraform de EC2

**User Story:** Como engenheiro de infraestrutura, quero uma instância EC2 que executa a API, para que a aplicação fique acessível na nuvem.

#### Acceptance Criteria

1. THE Modulo_EC2 SHALL provisionar exatamente 1 instância EC2 do tipo `t2.micro` em uma subnet pública fornecida como entrada pelo Modulo_VPC.
2. THE Modulo_EC2 SHALL associar a instância EC2 ao Security Group de EC2 fornecido como entrada pelo Modulo_SG.
3. WHERE a instância EC2 necessita de permissões de serviço AWS, THE Modulo_EC2 SHALL associar à instância o LabInstanceProfile.
4. THE Modulo_EC2 SHALL configurar a instância EC2 para iniciar a API_Reservas de modo que ela responda a requisições na porta 3000 após a inicialização da instância.
5. THE Modulo_EC2 SHALL aplicar em todos os recursos que provisiona ao menos as tags de nome do recurso e de ambiente.

### Requirement 14: Módulo Terraform de RDS

**User Story:** Como engenheiro de dados, quero um banco PostgreSQL gerenciado nas subnets privadas, para que a persistência da API na nuvem seja segura e isolada.

#### Acceptance Criteria

1. THE Modulo_RDS SHALL provisionar exatamente 1 instância RDS PostgreSQL do tipo `db.t3.micro` usando um db subnet group composto pelas 2 subnets privadas fornecidas como entrada pelo Modulo_VPC.
2. THE Modulo_RDS SHALL configurar a instância RDS com `publicly_accessible` igual a `false`.
3. THE Modulo_RDS SHALL configurar a instância RDS com `storage_encrypted` igual a `true`.
4. THE Modulo_RDS SHALL associar a instância RDS ao Security Group de RDS fornecido como entrada pelo Modulo_SG, de modo que o acesso na porta 5432 seja permitido exclusivamente a partir do Security Group do Modulo_EC2.
5. THE Modulo_RDS SHALL aplicar em todos os recursos que provisiona ao menos as tags de nome do recurso e de ambiente.
6. IF o provisionamento da instância RDS falhar por indisponibilidade das subnets privadas fornecidas, THEN THE Modulo_RDS SHALL interromper a aplicação retornando uma mensagem de erro que identifique a causa e não deixar a instância RDS parcialmente provisionada aplicada.

### Requirement 15: Composição dos módulos e outputs

**User Story:** Como engenheiro de infraestrutura, quero que os módulos se componham entre si, para que a infraestrutura seja provisionada de forma coesa a partir de uma configuração raiz.

#### Acceptance Criteria

1. THE Terraform_Infra SHALL alimentar os inputs do Modulo_SG, do Modulo_EC2 e do Modulo_RDS com os outputs do Modulo_VPC, usando o identificador da VPC no Modulo_SG, um identificador de subnet pública no Modulo_EC2 e a lista de identificadores das 2 subnets privadas no Modulo_RDS.
2. THE Terraform_Infra SHALL alimentar o input de Security Group do Modulo_RDS com o output do Security Group de EC2 do Modulo_SG, de modo que o acesso na porta 5432 seja permitido exclusivamente a partir do Security Group do Modulo_EC2.
3. THE Terraform_Infra SHALL expor um output com o endereço IP público da instância EC2 provisionada pelo Modulo_EC2.
4. THE Terraform_Infra SHALL expor um output com o endpoint de conexão da instância RDS provisionada pelo Modulo_RDS.
5. THE Terraform_Infra SHALL expor um output com a URL da API_Reservas composta pelo endereço IP público da instância EC2 seguido da porta 3000.
6. THE Terraform_Infra SHALL aplicar em todos os recursos provisionados ao menos as tags de nome do projeto e de ambiente.

### Requirement 16: Remote State

**User Story:** Como equipe de infraestrutura, quero o estado do Terraform armazenado remotamente com locking, para que o estado seja compartilhado com segurança e sem escritas concorrentes.

#### Acceptance Criteria

1. THE Remote_State SHALL usar um bucket S3 com versionamento habilitado e encriptação do estado em repouso habilitada por criptografia do lado do servidor (SSE) para armazenar o estado do Terraform.
2. THE Remote_State SHALL usar uma tabela DynamoDB para o locking do estado do Terraform.
3. THE Terraform_Infra SHALL configurar o backend `s3` apontando para o bucket S3 e a tabela DynamoDB do Remote_State.
4. IF um lock de estado já está retido por outra execução ao iniciar uma operação do Terraform_Infra, THEN THE Terraform_Infra SHALL interromper a operação retornando uma mensagem de erro que identifique o lock concorrente e não modificar o estado remoto.
5. IF o bucket S3 ou a tabela DynamoDB do Remote_State está indisponível ao iniciar uma operação do Terraform_Infra, THEN THE Terraform_Infra SHALL interromper a operação retornando uma mensagem de erro que identifique o backend indisponível e não modificar o estado remoto.

### Requirement 17: Restrições do AWS Academy Learner Lab

**User Story:** Como aluno usando o Learner Lab, quero que a infraestrutura respeite as restrições do ambiente, para que o provisionamento funcione sem violar as políticas do Lab.

#### Acceptance Criteria

1. THE Terraform_Infra SHALL provisionar todos os recursos na região `us-east-1`.
2. THE Terraform_Infra SHALL usar o LabRole e o LabInstanceProfile pré-existentes do Learner_Lab.
3. THE Terraform_Infra SHALL NOT criar recursos IAM do tipo user, group ou role.
4. WHERE a autenticação AWS é necessária, THE Terraform_Infra SHALL usar as credenciais temporárias do Learner_Lab com Session Token.
5. IF o Session Token do Learner_Lab está ausente ou expirado ao iniciar uma operação do Terraform_Infra, THEN THE Terraform_Infra SHALL interromper a operação retornando uma mensagem de erro que identifique a credencial expirada ou ausente (ExpiredToken) e não provisionar nenhum recurso.

### Requirement 18: Documentação do repositório

**User Story:** Como avaliador, quero um README com a identificação do aluno e a descrição do projeto, para que eu possa identificar a autoria e o propósito da entrega.

#### Acceptance Criteria

1. THE Repositorio SHALL incluir um arquivo `README.md` na raiz do repositório.
2. THE `README.md` SHALL conter o nome "Fernanda Novais".
3. THE `README.md` SHALL conter o RA "4025109".
4. THE `README.md` SHALL conter uma descrição do projeto com ao menos um parágrafo.
