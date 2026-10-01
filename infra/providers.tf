###############################################################################
# Provider AWS + Backend remoto (S3 + DynamoDB) da composição raiz
#
# - Provider aws fixado na região us-east-1 do Learner Lab (Req 17.1).
# - Backend "s3" apontando para o bucket/tabela criados pelo bootstrap em
#   infra/backend (Req 16.3). Os valores default abaixo correspondem aos
#   defaults do bootstrap (infra/backend/variables.tf):
#     bucket         = "api-reservas-devops-tfstate"
#     dynamodb_table = "api-reservas-devops-tflock"
#
# IMPORTANTE (Learner Lab): NÃO rodar `terraform init` com o backend real sem
# credenciais válidas. Para validação offline use:
#     terraform init -backend=false
#     terraform validate
#
# As credenciais temporárias (Access Key, Secret Key e Session Token) do
# Learner Lab são fornecidas via variáveis de ambiente / ~/.aws/credentials
# (Req 17.4). NÃO declaramos recursos IAM aqui (Req 17.3).
###############################################################################

terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # -----------------------------------------------------------------------------
  # Backend remoto S3 + DynamoDB (remote state com locking).
  #
  # O bucket S3 (versionado + SSE AES256) e a tabela DynamoDB (chave LockID)
  # foram provisionados via AWS CLI (ver infra/backend), contornando a Service
  # Control Policy do Learner Lab que nega a leitura de Object Lock feita pelo
  # provider ao gerenciar o bucket. Com os recursos ja existentes, o backend
  # "s3" abaixo funciona normalmente no `terraform init`.
  backend "s3" {
    bucket         = "api-reservas-devops-tfstate"
    key            = "api-reservas-devops/infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "api-reservas-devops-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
