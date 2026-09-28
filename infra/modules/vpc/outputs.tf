# Identificador da VPC (Req 11.2)
output "vpc_id" {
  description = "Identificador da VPC provisionada."
  value       = aws_vpc.this.id
}

# Lista dos identificadores das 2 subnets publicas (Req 11.2)
output "public_subnet_ids" {
  description = "Lista com os identificadores das 2 subnets publicas."
  value       = aws_subnet.public[*].id
}

# Lista dos identificadores das 2 subnets privadas (Req 11.2)
output "private_subnet_ids" {
  description = "Lista com os identificadores das 2 subnets privadas."
  value       = aws_subnet.private[*].id
}

output "vpc_cidr_block" {
  description = "Bloco CIDR da VPC provisionada."
  value       = aws_vpc.this.cidr_block
}

output "internet_gateway_id" {
  description = "Identificador do Internet Gateway associado a VPC."
  value       = aws_internet_gateway.this.id
}
