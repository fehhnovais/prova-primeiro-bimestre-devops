variable "name_prefix" {
  description = "Prefixo aplicado ao nome dos Security Groups e demais recursos (ex.: api-reservas)."
  type        = string
}

variable "environment" {
  description = "Nome do ambiente (ex.: dev, prod) usado nas tags de ambiente."
  type        = string
}

variable "vpc_id" {
  description = "Identificador da VPC onde os Security Groups serão criados (output do Modulo_VPC)."
  type        = string
}

variable "ssh_ingress_cidrs" {
  description = "Faixas CIDR de origem autorizadas a acessar a porta 22 (SSH) da EC2."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "api_ingress_cidrs" {
  description = "Faixas CIDR de origem autorizadas a acessar a porta 3000 (API) da EC2."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  description = "Tags adicionais aplicadas a todos os recursos do módulo."
  type        = map(string)
  default     = {}
}
