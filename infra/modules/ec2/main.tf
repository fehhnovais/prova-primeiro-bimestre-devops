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
  # Tags de nome e ambiente aplicadas a todos os recursos do módulo (Req 13.5).
  common_tags = merge(
    {
      Environment = var.environment
    },
    var.tags
  )

  # Resolve a AMI: usa a fornecida explicitamente ou a Amazon Linux 2023 mais recente (data source).
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux.id

  # user_data: renderizado a partir de um arquivo de template (.tftpl) SEM
  # indentacao, garantindo que o shebang (#!/bin/bash) fique na coluna 0. O
  # heredoc <<-EOT do HCL so remove tabs (nao espacos), o que corrompia o
  # shebang e fazia o cloud-init falhar. templatefile() evita esse problema.
  default_user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    database_url    = var.database_url
    api_port        = var.api_port
    app_repo_url    = var.app_repo_url
    app_repo_branch = var.app_repo_branch
  })

  user_data = var.user_data != "" ? var.user_data : local.default_user_data
}

# Data source da AMI Amazon Linux 2023 mais recente (usado quando ami_id não é fornecido).
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 1 instância EC2 t2.micro em subnet pública (Req 13.1).
# Associa o SG da EC2 fornecido pelo Modulo_SG (Req 13.2) e o LabInstanceProfile (Req 13.3).
# user_data sobe a API na porta 3000 e aplica o init.sql no RDS (Req 13.4).
resource "aws_instance" "this" {
  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [var.ec2_security_group_id]
  iam_instance_profile        = var.iam_instance_profile
  associate_public_ip_address = var.associate_public_ip_address
  key_name                    = var.key_name != "" ? var.key_name : null

  user_data = local.user_data

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-${var.environment}-ec2"
  })
}
