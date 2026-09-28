###############################################################################
# Outputs da composição raiz (infra/)
#
# Expõe as evidências consumidas na verificação manual (terraform output):
#   - ec2_public_ip : IP público da EC2 que hospeda a API (Req 15.3).
#   - rds_endpoint  : endpoint (host:porta) da instância RDS (Req 15.4).
#   - api_url       : URL da API = http://<ec2_public_ip>:3000 (Req 15.5).
###############################################################################

output "ec2_public_ip" {
  description = "Endereço IP público da instância EC2 que hospeda a API_Reservas (Req 15.3)."
  value       = module.ec2.public_ip
}

output "rds_endpoint" {
  description = "Endpoint (host:porta) de conexão da instância RDS PostgreSQL (Req 15.4)."
  value       = module.rds.rds_endpoint
}

output "api_url" {
  description = "URL da API_Reservas composta pelo IP público da EC2 e a porta 3000 (Req 15.5)."
  value       = "http://${module.ec2.public_ip}:3000"
}

# ---------------------- Outputs auxiliares de rede/infra --------------------

output "vpc_id" {
  description = "Identificador da VPC provisionada."
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Identificadores das subnets públicas."
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Identificadores das subnets privadas."
  value       = module.vpc.private_subnet_ids
}

output "ec2_security_group_id" {
  description = "Identificador do Security Group da EC2."
  value       = module.security_group.ec2_security_group_id
}

output "rds_security_group_id" {
  description = "Identificador do Security Group do RDS."
  value       = module.security_group.rds_security_group_id
}
