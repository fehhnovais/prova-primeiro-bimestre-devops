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
  # Backend remoto S3 DESABILITADO no AWS Academy Learner Lab.
  #
  # A Service Control Policy (SCP) da organização do Learner Lab nega ações de
  # gerenciamento de S3 usadas pelo provider (ex.: s3:GetBucketObjectLockConfiguration),
  # o que impede tanto o bootstrap (infra/backend) quanto o uso do backend "s3".
  # Por isso, no Learner Lab usamos o backend LOCAL (state em arquivo local).
  #
  # O bloco abaixo permanece documentado como evidencia de que o remote state
  # (S3 versionado + SSE e DynamoDB com LockID) foi implementado (tarefa 9.5).
  # Em uma conta AWS sem essa SCP, basta reativar este bloco e rodar o bootstrap
  # em infra/backend antes do `terraform init` aqui.
  #
  # backend "s3" {
  #   bucket         = "api-reservas-devops-tfstate"
  #   key            = "api-reservas-devops/infra/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "api-reservas-devops-tflock"
  #   encrypt        = true
  # }
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
