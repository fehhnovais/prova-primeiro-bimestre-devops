variable "project_name" {
  description = "Nome do projeto, usado como prefixo nas tags de nome dos recursos."
  type        = string
  default     = "api-reservas"
}

variable "environment" {
  description = "Nome do ambiente (ex.: dev, prod), aplicado como tag em todos os recursos."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "Bloco CIDR da VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr deve ser um bloco CIDR IPv4 valido."
  }
}

variable "availability_zones" {
  description = "Duas zonas de disponibilidade distintas de us-east-1 para distribuir as subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2
    error_message = "availability_zones deve conter exatamente 2 zonas de disponibilidade distintas."
  }
}

variable "public_subnet_cidrs" {
  description = "Blocos CIDR das 2 subnets publicas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "public_subnet_cidrs deve conter exatamente 2 blocos CIDR."
  }
}

variable "private_subnet_cidrs" {
  description = "Blocos CIDR das 2 subnets privadas (uma por AZ)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "private_subnet_cidrs deve conter exatamente 2 blocos CIDR."
  }
}
