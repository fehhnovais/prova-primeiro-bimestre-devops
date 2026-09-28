###############################################################################
# Variáveis do bootstrap do remote state
###############################################################################

variable "aws_region" {
  description = "Região AWS onde o remote state será provisionado (Learner Lab: us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome do projeto, usado nas tags dos recursos."
  type        = string
  default     = "api-reservas-devops"
}

variable "environment" {
  description = "Ambiente de implantação, usado nas tags dos recursos."
  type        = string
  default     = "dev"
}

variable "state_bucket_name" {
  description = "Nome globalmente único do bucket S3 que armazenará o estado do Terraform."
  type        = string
  default     = "api-reservas-devops-tfstate"
}

variable "lock_table_name" {
  description = "Nome da tabela DynamoDB usada para o locking do estado (chave LockID)."
  type        = string
  default     = "api-reservas-devops-tflock"
}
