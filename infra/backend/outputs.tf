###############################################################################
# Outputs do bootstrap do remote state
#
# Use estes valores para configurar o bloco backend "s3" no projeto principal
# (infra/providers.tf).
###############################################################################

output "state_bucket_name" {
  description = "Nome do bucket S3 que armazena o estado remoto do Terraform."
  value       = aws_s3_bucket.tfstate.id
}

output "state_bucket_arn" {
  description = "ARN do bucket S3 do estado remoto."
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table_name" {
  description = "Nome da tabela DynamoDB usada para o locking do estado."
  value       = aws_dynamodb_table.tflock.name
}

output "lock_table_arn" {
  description = "ARN da tabela DynamoDB de locking do estado."
  value       = aws_dynamodb_table.tflock.arn
}

output "aws_region" {
  description = "Região AWS do remote state (para uso no backend s3 do projeto principal)."
  value       = var.aws_region
}
