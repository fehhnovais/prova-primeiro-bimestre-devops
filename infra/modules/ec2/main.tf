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

  # user_data padrão: instala Node.js + PostgreSQL client + git, CLONA o
  # repositório da aplicação, instala as dependências de produção, aplica o
  # init.sql no RDS e sobe a API_Reservas na porta configurada (Req 13.4).
  # Se um user_data customizado for fornecido, ele tem precedência.
  #
  # O código é obtido via `git clone` de um repositório PÚBLICO (var.app_repo_url)
  # no branch var.app_repo_branch. Isso evita embutir o código-fonte no user_data
  # e mantém a instância alinhada ao repositório entregue.
  default_user_data = <<-EOT
    #!/bin/bash
    set -uxo pipefail
    exec > /var/log/api-reservas-bootstrap.log 2>&1

    export DATABASE_URL="${var.database_url}"
    export PORT="${var.api_port}"

    # Dependências: Node.js, cliente PostgreSQL e git.
    dnf install -y nodejs npm postgresql15 git || dnf install -y nodejs npm postgresql git || yum install -y nodejs npm postgresql git

    APP_ROOT=/opt/api-reservas
    rm -rf "$APP_ROOT"
    git clone --depth 1 --branch "${var.app_repo_branch}" "${var.app_repo_url}" "$APP_ROOT"

    APP_DIR="$APP_ROOT/app"

    # Aplica o schema (init.sql) no RDS; idempotente via CREATE TABLE IF NOT EXISTS.
    # Faz algumas tentativas caso o RDS ainda esteja finalizando a inicialização.
    if [ -f "$APP_DIR/init.sql" ] && [ -n "$DATABASE_URL" ]; then
      for i in 1 2 3 4 5 6 7 8 9 10; do
        if psql "$DATABASE_URL" -f "$APP_DIR/init.sql"; then
          break
        fi
        echo "Tentativa $i de aplicar init.sql falhou; aguardando o RDS..."
        sleep 15
      done
    fi

    # Instala dependências de produção e sobe a API_Reservas via systemd, para
    # reiniciar automaticamente e sobreviver a reboots.
    if [ -f "$APP_DIR/package.json" ]; then
      cd "$APP_DIR"
      npm ci --omit=dev || npm install --omit=dev

      cat > /etc/systemd/system/api-reservas.service <<UNIT
[Unit]
Description=API de Reservas
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=DATABASE_URL=${var.database_url}
Environment=PORT=${var.api_port}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

      systemctl daemon-reload
      systemctl enable --now api-reservas.service
    fi
  EOT

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
