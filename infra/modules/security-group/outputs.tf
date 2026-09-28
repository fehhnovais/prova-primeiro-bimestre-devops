output "ec2_security_group_id" {
  description = "Identificador do Security Group da EC2 (API_Reservas). Usado como origem no SG do RDS."
  value       = aws_security_group.ec2.id
}

output "rds_security_group_id" {
  description = "Identificador do Security Group do RDS (Banco_PostgreSQL)."
  value       = aws_security_group.rds.id
}
