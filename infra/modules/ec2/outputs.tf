# Identificador da instância EC2 provisionada.
output "instance_id" {
  description = "Identificador da instância EC2 provisionada."
  value       = aws_instance.this.id
}

# IP público da instância EC2, consumido pela composição raiz (ec2_public_ip, Req 15.3).
output "public_ip" {
  description = "Endereço IP público da instância EC2 (host da API_Reservas na porta 3000)."
  value       = aws_instance.this.public_ip
}

output "public_dns" {
  description = "DNS público da instância EC2."
  value       = aws_instance.this.public_dns
}

output "private_ip" {
  description = "Endereço IP privado da instância EC2."
  value       = aws_instance.this.private_ip
}

output "ami_id" {
  description = "Identificador da AMI utilizada pela instância EC2."
  value       = aws_instance.this.ami
}
