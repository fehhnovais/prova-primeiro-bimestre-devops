locals {
  common_tags = merge(
    {
      Environment = var.environment
    },
    var.tags
  )
}

# Security Group da instância EC2 (API_Reservas).
# Permite entrada TCP nas portas 22 (SSH) e 3000 (API) a partir de faixas
# parametrizáveis. Nega todo o demais tráfego de entrada (comportamento padrão
# de um Security Group: apenas o que é explicitamente permitido entra).
resource "aws_security_group" "ec2" {
  name        = "${var.name_prefix}-ec2-sg"
  description = "SG da EC2 da API de Reservas: SSH (22) e API (3000)"
  vpc_id      = var.vpc_id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.name_prefix}-ec2-sg"
    }
  )
}

resource "aws_security_group_rule" "ec2_ingress_ssh" {
  type              = "ingress"
  security_group_id = aws_security_group.ec2.id
  description       = "SSH de entrada (porta 22) a partir das faixas autorizadas"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = var.ssh_ingress_cidrs
}

resource "aws_security_group_rule" "ec2_ingress_api" {
  type              = "ingress"
  security_group_id = aws_security_group.ec2.id
  description       = "API de entrada (porta 3000) a partir das faixas autorizadas"
  from_port         = 3000
  to_port           = 3000
  protocol          = "tcp"
  cidr_blocks       = var.api_ingress_cidrs
}

resource "aws_security_group_rule" "ec2_egress_all" {
  type              = "egress"
  security_group_id = aws_security_group.ec2.id
  description       = "Saida liberada para a EC2"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# Security Group da instância RDS (Banco_PostgreSQL).
# Permite entrada TCP na porta 5432 EXCLUSIVAMENTE a partir do Security Group
# da EC2 (source_security_group_id). Nega todo o demais tráfego de entrada.
resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds-sg"
  description = "SG do RDS da API de Reservas: PostgreSQL (5432) apenas do SG da EC2"
  vpc_id      = var.vpc_id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.name_prefix}-rds-sg"
    }
  )
}

resource "aws_security_group_rule" "rds_ingress_postgres" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL (porta 5432) exclusivamente a partir do SG da EC2"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ec2.id
}

resource "aws_security_group_rule" "rds_egress_all" {
  type              = "egress"
  security_group_id = aws_security_group.rds.id
  description       = "Saida liberada para o RDS"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}
