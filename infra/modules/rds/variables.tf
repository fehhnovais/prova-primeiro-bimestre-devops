variable "name_prefix" {
  description = "Prefixo aplicado ao nome da instância RDS e demais recursos (ex.: api-reservas)."
  type        = string
}

variable "environment" {
  description = "Nome do ambiente (ex.: dev, prod) usado nas tags de ambiente."
  type        = string
}

variable "private_subnet_ids" {
  description = "Lista com os identificadores das 2 subnets privadas (output do Modulo_VPC) que compõem o db subnet group."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) == 2
    error_message = "private_subnet_ids deve conter exatamente 2 subnets privadas."
  }
}

variable "rds_security_group_id" {
  description = "Identificador do Security Group de RDS (output do Modulo_SG) associado à instância; libera a porta 5432 apenas a partir do SG da EC2."
  type        = string
}

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
  description = "Senha do usuário master do banco de dados PostgreSQL."
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "Classe de instância do RDS."
  type        = string
  default     = "db.t3.micro"
}

variable "engine_version" {
  description = "Versão do engine PostgreSQL."
  type        = string
  default     = "16"
}

variable "allocated_storage" {
  description = "Armazenamento alocado (em GB) para a instância RDS."
  type        = number
  default     = 20
}

variable "tags" {
  description = "Tags adicionais aplicadas a todos os recursos do módulo."
  type        = map(string)
  default     = {}
}
