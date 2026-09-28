variable "name_prefix" {
  description = "Prefixo aplicado ao nome da instância EC2 e demais recursos (ex.: api-reservas)."
  type        = string
}

variable "environment" {
  description = "Nome do ambiente (ex.: dev, prod) usado nas tags de ambiente."
  type        = string
}

variable "public_subnet_id" {
  description = "Identificador da subnet pública (output do Modulo_VPC) onde a instância EC2 é provisionada."
  type        = string
}

variable "ec2_security_group_id" {
  description = "Identificador do Security Group da EC2 (output do Modulo_SG) associado à instância; libera SSH (22) e API (3000)."
  type        = string
}

variable "instance_type" {
  description = "Tipo da instância EC2. O Learner Lab exige t2.micro."
  type        = string
  default     = "t2.micro"
}

variable "iam_instance_profile" {
  description = "Instance profile pré-existente do Learner Lab associado à instância (LabInstanceProfile)."
  type        = string
  default     = "LabInstanceProfile"
}

variable "ami_id" {
  description = "AMI a ser usada na instância. Quando vazio, o módulo resolve automaticamente a AMI Amazon Linux 2023 mais recente via data source."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Nome do key pair para acesso SSH (opcional). Quando vazio, a instância é criada sem key pair."
  type        = string
  default     = ""
}

variable "associate_public_ip_address" {
  description = "Se true, associa um IP público à instância (necessário em subnet pública para acesso à API)."
  type        = bool
  default     = true
}

variable "database_url" {
  description = "Connection string do RDS injetada na instância via user_data para subir a API e aplicar o init.sql (ex.: postgres://user:senha@endpoint:5432/reservas)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "api_port" {
  description = "Porta em que a API_Reservas responde na instância."
  type        = number
  default     = 3000
}

variable "app_repo_url" {
  description = "URL do repositório Git PÚBLICO com o código da aplicação, clonado pelo user_data para subir a API na instância."
  type        = string
  default     = "https://github.com/fehhnovais/prova-primeiro-bimestre-devops.git"
}

variable "app_repo_branch" {
  description = "Branch do repositório da aplicação a ser clonado pelo user_data."
  type        = string
  default     = "main"
}

variable "user_data" {
  description = "Script de user_data customizado. Quando vazio, o módulo gera um script padrão que sobe a API na porta configurada e aplica o init.sql no RDS."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags adicionais aplicadas a todos os recursos do módulo."
  type        = map(string)
  default     = {}
}
