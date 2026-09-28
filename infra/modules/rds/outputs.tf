# Endpoint (host:porta) da instância RDS, consumido pela composição raiz (rds_endpoint, Req 15.4).
output "rds_endpoint" {
  description = "Endpoint (host:porta) da instância RDS PostgreSQL."
  value       = aws_db_instance.this.endpoint
}

output "rds_address" {
  description = "Endereço (host) da instância RDS PostgreSQL."
  value       = aws_db_instance.this.address
}

output "rds_port" {
  description = "Porta de conexão da instância RDS PostgreSQL."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Nome do banco de dados inicial da instância RDS."
  value       = aws_db_instance.this.db_name
}

output "db_instance_id" {
  description = "Identificador da instância RDS provisionada."
  value       = aws_db_instance.this.id
}

output "db_subnet_group_name" {
  description = "Nome do db subnet group associado à instância RDS."
  value       = aws_db_subnet_group.this.name
}
