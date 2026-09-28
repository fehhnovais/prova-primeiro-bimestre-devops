###############################################################################
# Variáveis da composição raiz (infra/)
#
# Estas variáveis parametrizam a composição dos módulos vpc, security-group,
# ec2 e rds. Os defaults permitem `terraform validate` sem informar valores,
# exceto a senha do banco (db_password), que é sensível e deve ser fornecida
# via -var, arquivo .tfvars (não versionado) ou variável de ambiente
# TF_VAR_db_password.
###############################################################################

variable "aws_region" {
  description = "Região AWS onde toda a infraestrutura é provisionada (Learner Lab: us-east-1, Req 17.1)."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.aws_region == "us-east-1"
    error_message = "A infraestrutura do Learner Lab deve ser provisionada em us-east-1 (Req 17.1)."
  }
}

variable "project_name" {
  description = "Nome do projeto, usado como prefixo de nomes e tag de projeto em todos os recursos (Req 15.6)."
  type        = string
  default     = "api-reservas"
}

variable "environment" {
  description = "Nome do ambiente (ex.: dev, prod), aplicado como tag de ambiente em todos os recursos (Req 15.6)."
  type        = string
  default     = "dev"
}

# ------------------------------ Rede (VPC) ---------------------------------

variable "vpc_cidr" {
  description = "Bloco CIDR da VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Duas AZs distintas de us-east-1 para distribuir as subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "Blocos CIDR das 2 subnets públicas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Blocos CIDR das 2 subnets privadas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# --------------------------- Security Groups -------------------------------

variable "ssh_ingress_cidrs" {
  description = "Faixas CIDR autorizadas a acessar a porta 22 (SSH) da EC2."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "api_ingress_cidrs" {
  description = "Faixas CIDR autorizadas a acessar a porta 3000 (API) da EC2."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# -------------------------------- EC2 --------------------------------------

variable "instance_type" {
  description = "Tipo da instância EC2 (Learner Lab: t2.micro, Req 13.1)."
  type        = string
  default     = "t2.micro"
}

variable "instance_profile_name" {
  description = "Nome do instance profile pré-existente do Learner Lab associado à EC2 (Req 17.2). Não criar recursos IAM (Req 17.3)."
  type        = string
  default     = "LabInstanceProfile"
}

variable "key_name" {
  description = "Nome do par de chaves EC2 para acesso SSH (opcional). Deixe null para não associar chave."
  type        = string
  default     = null
}

# -------------------------------- RDS --------------------------------------

variable "db_name" {
  description = "Nome do banco de dados inicial criado na instância PostgreSQL."
  type        = string
  default     = "reservas"
}

variable "db_username" {
  description = "Usuário master do banco de dados PostgreSQL."
  type        = string
  default     = "reservas"
}

variable "db_password" {
  description = "Senha do usuário master do banco PostgreSQL. Forneça via TF_VAR_db_password ou -var (não versionar)."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "Classe de instância do RDS (Req 14.1: db.t3.micro)."
  type        = string
  default     = "db.t3.micro"
}

variable "db_engine_version" {
  description = "Versão do engine PostgreSQL do RDS."
  type        = string
  default     = "16"
}

variable "db_allocated_storage" {
  description = "Armazenamento alocado (GB) da instância RDS."
  type        = number
  default     = 20
}
