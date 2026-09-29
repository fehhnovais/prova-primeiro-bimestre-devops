## Relatório do Processo (relatorio.md) — 4 Questões

Crie o arquivo `relatorio.md` no seu repositório. Responda de forma **dissertativa** (mínimo 10 linhas por questão), com base na sua experiência real. **Informe no início qual ferramenta de IA utilizou.**

### Questão 1 — A Jornada Completa (Aulas 01 a 07)

Descreva como você conectou as peças do bimestre para entregar a API de Reservas: do versionamento (Git) à infraestrutura na nuvem (Terraform + módulos + remote state). Explique a ordem que seguiu e por quê. Onde cada aula (01 a 07) apareceu na sua solução?

RESPOSTA: 
1- comecei pelo git (aprendemos na aula 01), criando o repositorio e versionando a API de reservas
2-ainda na aula 01, conternizei a API usando o DOCKERFILE 
3-como aprendemos (aula02), usei o DOCKER COMPOSE para orquestrar a API junto com o POSTRGRESQL
4- tambem usei o KIRO COMO COPILOTO DEVOPS, auxiliando na implementação
5- como vimos na (aula03), comecei a infraestrutura AWS com terraform e utilizei o IAM do ambiante
6-como na (aula04), criei a VPC, subnets e EC2 para hospedar a aplicacao
7- como na (aula05) configurei o RDS postgres e o S3 com dynamoDB  para o terrraform 
8- como na (aula06) organizei a infraestrutura em modulos de VPC, security group, ec2 e RDS.
9- (aula07) usei o kiro e a abordagem SPEC-DRIVEN para organizar e executar 
Segui essa ordem porque primeiro precisava construir e testar a aplicação, depois containerizá-la e, por fim, criar sua infraestrutura na AWS.

### Questão 2 — O Processo com IA como Copiloto

Qual ferramenta de IA você usou e como? Descreva os prompts principais, o que a IA gerou bem e o que precisou corrigir. Se usou Kiro Spec, descreva o fluxo requisitos → design → tarefas. Compare com fazer manualmente: onde a IA economizou tempo e onde atrapalhou?

RESPOSTA:
Utilizei o Kiro como ferramenta de IA, principalmente por meio do Kiro Spec. Primeiro, criei o arquivo atividade.md com a solicitação da prova e retirei informações redundantes, deixando apenas os requisitos necessários, como recursos da AWS, rotas obrigatórias e estrutura do repositório.

Meu prompt inicial foi: “Analise e faça perguntas. Após isso, crie.” A partir dos requisitos, utilizei o fluxo do Kiro Spec de requisitos → design → tarefas, transformando o problema em etapas menores e um checklist de execução.Também defini que, para comandos como terraform plan, terraform apply e docker compose up, o Kiro deveria me orientar passo a passo para que eu executasse manualmente no terminal.

A IA gerou muito bem a estrutura inicial, o planejamento e o checklist de tarefas, o que economizou bastante tempo. Porém, durante a execução, alguns problemas exigiram intervenção e correção. Por exemplo, as ferramentas de gerenciamento das tarefas ficaram indisponíveis em alguns momentos, então passei a atualizar o tasks.md manualmente.Também tivemos um problema de encoding no tasks.md, que deixou caracteres acentuados incorretos, e um problema de configuração das senhas no .env, que impedia a conexão da API com o PostgreSQL. Esses problemas foram identificados e corrigidos durante a execução.

Comparando com fazer tudo manualmente, o Kiro economizou muito tempo principalmente no planejamento, na organização e na criação da estrutura inicial. Por outro lado, ele não substituiu a revisão humana: foi necessário conferir as sugestões, identificar erros e executar manualmente as etapas relacionadas ao ambiente AWS e ao terminal.


### Questão 3 — Infraestrutura, Segurança e o Learner Lab

Explique a arquitetura AWS que você provisionou (pode incluir diagrama). Por que o RDS fica na subnet privada e a EC2 na pública? Como funcionou o uso do `LabRole`/`LabInstanceProfile` em vez de criar IAM próprio? Que ajustes o AWS Academy Learner Lab exigiu em relação ao que foi ensinado (credenciais temporárias, região, restrições de IAM)?

RESPOSTA:
A arquitetura foi construída em uma VPC 10.0.0.0/16, com 2 subnets públicas e 2 privadas distribuídas em duas AZs (us-east-1a e us-east-1b), além de Internet Gateway e tabelas de rotas. A EC2 t2.micro ficou em uma subnet pública, executando a API na porta 3000, enquanto o RDS PostgreSQL db.t3.micro ficou nas subnets privadas.

Para controlar o acesso, foram utilizados dois Security Groups. O SG da EC2 permite as portas 22 e 3000, enquanto o SG do RDS permite a porta 5432 somente para conexões originadas pelo SG da EC2.

O RDS foi colocado em uma subnet privada para não ficar exposto diretamente à internet, sendo acessível somente pela aplicação. A EC2 ficou na subnet pública porque precisa receber as requisições externas da API e acessar a internet por meio do Internet Gateway.

Na EC2, utilizei o LabInstanceProfile, que fornece as permissões já disponibilizadas pelo Learner Lab, sem criar novos usuários, grupos ou roles do IAM.

Durante a implementação, precisei considerar as limitações do Learner Lab, como o uso de credenciais temporárias com Session Token, a região us-east-1 e a restrição para criação de recursos próprios de IAM. Também encontrei uma restrição relacionada ao remote state em S3, o que exigiu ajustes na configuração do backend durante a execução.

### Questão 4 — Validação e Responsabilidade

Que checklist você aplicou antes de rodar `terraform apply` em código gerado por IA? Como validou que a infraestrutura estava correta e segura? O que aconteceria se você aceitasse o código da IA sem revisar? Como a evolução Git → Docker → Terraform → Modules preparou você para usar IA com responsabilidade?

RESPOSTA:
Antes de executar o terraform apply em código gerado pela IA, apliquei um checklist de validação:

Executei terraform fmt e terraform validate para verificar formatação, sintaxe e configuração.
Analisei o terraform plan inteiro, conferindo os recursos que seriam criados, alterados ou destruídos.
Confirmei a região us-east-1 e verifiquei que não havia criação de recursos próprios de IAM, utilizando apenas o LabInstanceProfile.
Revisei os Security Groups, garantindo o princípio do menor privilégio: o RDS liberava a porta 5432 somente para o SG da EC2.
Conferi no RDS as configurações publicly_accessible=false e storage_encrypted=true.
Verifiquei que senhas não estavam diretamente no código, utilizando TF_VAR_db_password.

Depois do apply, validei a infraestrutura na prática: o endpoint /health respondeu 200 e o GET /reservas funcionou na EC2 conectada ao RDS. Também conferi os Security Groups pela AWS CLI e verifiquei o .gitignore para evitar o versionamento de .env e arquivos de state.Se eu tivesse aceitado o código da IA sem revisar, alguns problemas poderiam ter passado despercebidos, como um user_data que não levava corretamente o código da API para a EC2, um problema no shebang causado pela indentação do heredoc e a ausência de SSL na conexão com o RDS. Também existiria risco de configurações inseguras, como Security Groups muito abertos, banco público ou exposição de senhas, além de custos desnecessários caso os recursos não fossem destruídos.

A evolução Git → Docker → Terraform → Modules me ensinou a validar cada etapa antes de confiar nela: o Git trouxe rastreabilidade e possibilidade de reversão; o Docker permitiu testar a aplicação de forma reproduzível; o Terraform trouxe o plan como etapa de revisão; e os módulos ajudaram a entender inputs, outputs e a composição da infraestrutura. Assim, aprendi a tratar o código gerado pela IA como um ponto de partida que precisa ser revisado, testado e versionado, e não como uma solução pronta.