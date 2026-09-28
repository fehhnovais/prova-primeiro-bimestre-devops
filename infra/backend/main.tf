###############################################################################
# Bootstrap do Remote State do Terraform
#
# Este arquivo provisiona a infraestrutura que armazena o estado remoto do
# projeto principal (infra/):
#   - Bucket S3 com versionamento e criptografia em repouso (SSE) habilitados
#   - Tabela DynamoDB com chave "LockID" para locking do estado
#
# IMPORTANTE: o estado deste bootstrap é LOCAL (nenhum bloco backend "s3" aqui),
# pois não podemos armazenar o estado do backend no próprio backend que ainda
# não existe. Rode `terraform init` e `terraform apply` nesta pasta ANTES de
# inicializar o projeto principal em infra/.
#
# Requisitos: 16.1 (S3 versionado + SSE), 16.2 (DynamoDB com LockID)
###############################################################################

terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "remote-state"
  }
}

###############################################################################
# Bucket S3 para armazenar o estado do Terraform (Req 16.1)
###############################################################################

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = var.state_bucket_name
    }
  )
}

# Versionamento habilitado: mantém histórico de versões do estado (Req 16.1)
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Criptografia do lado do servidor (SSE) do estado em repouso (Req 16.1)
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Bloqueia todo acesso público ao bucket de estado
resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

###############################################################################
# Tabela DynamoDB para o locking do estado (Req 16.2)
#
# A chave "LockID" (String) é o contrato esperado pelo backend "s3" do
# Terraform para gerenciar locks de estado.
###############################################################################

resource "aws_dynamodb_table" "tflock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(
    local.common_tags,
    {
      Name = var.lock_table_name
    }
  )
}
