terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

locals {
  # Tags de nome e ambiente aplicadas a todos os recursos do módulo (Req 14.5).
  common_tags = merge(
    {
      Environment = var.environment
    },
    var.tags
  )
}

# DB subnet group composto pelas 2 subnets privadas fornecidas pelo Modulo_VPC (Req 14.1).
resource "aws_db_subnet_group" "this" {
  name        = "${var.name_prefix}-rds-subnet-group"
  description = "DB subnet group da API de Reservas (2 subnets privadas)"
  subnet_ids  = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-rds-subnet-group"
  })
}

# 1 instância RDS PostgreSQL db.t3.micro nas subnets privadas (Req 14.1).
# publicly_accessible = false (Req 14.2); storage_encrypted = true (Req 14.3);
# associada ao SG de RDS fornecido pelo Modulo_SG, liberando 5432 apenas do SG da EC2 (Req 14.4).
resource "aws_db_instance" "this" {
  identifier     = "${var.name_prefix}-${var.environment}-rds"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false

  multi_az            = false
  skip_final_snapshot = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-${var.environment}-rds"
  })
}
