###############################################################################
# Composição raiz (infra/) — instancia e conecta os módulos vpc, security-group,
# rds e ec2, fluindo os outputs de um módulo para os inputs do próximo.
#
# Fluxo de composição (Req 15.1, 15.2):
#   vpc.vpc_id             -> security-group.vpc_id
#   vpc.public_subnet_ids  -> ec2.public_subnet_id (uma subnet pública)
#   vpc.private_subnet_ids -> rds.private_subnet_ids (as 2 subnets privadas)
#   security-group.ec2_security_group_id -> ec2.ec2_security_group_id
#   security-group.rds_security_group_id -> rds.rds_security_group_id
#     (5432 liberado exclusivamente a partir do SG do EC2 — Req 15.2)
#   rds.rds_address/rds_port -> database_url injetada no ec2 via user_data
#
# Restrições do Learner Lab (Req 17): região us-east-1; uso do LabInstanceProfile
# pré-existente; NÃO declaramos recursos IAM (user/group/role) aqui.
###############################################################################

locals {
  # Tags mínimas de projeto e ambiente aplicadas a todos os recursos (Req 15.6).
  # Além das default_tags do provider, repassamos como tags adicionais aos módulos.
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }

  # Connection string do RDS montada a partir dos outputs do módulo rds, injetada
  # na EC2 via user_data para subir a API e aplicar o init.sql (Req 13.4).
  database_url = "postgres://${var.db_username}:${var.db_password}@${module.rds.rds_address}:${module.rds.rds_port}/${var.db_name}"
}

# --------------------------------- VPC -------------------------------------
# 2 subnets públicas + 2 privadas em 2 AZs de us-east-1 (Req 11).
module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# ---------------------------- Security Groups ------------------------------
# SG do EC2 (22/3000) e SG do RDS (5432 apenas do SG do EC2). Recebe o vpc_id
# do módulo VPC (Req 15.1).
module "security_group" {
  source = "./modules/security-group"

  name_prefix       = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  ssh_ingress_cidrs = var.ssh_ingress_cidrs
  api_ingress_cidrs = var.api_ingress_cidrs
  tags              = local.common_tags
}

# --------------------------------- RDS -------------------------------------
# PostgreSQL db.t3.micro nas 2 subnets privadas, SG do RDS alimentado com o
# output do SG do EC2 (Req 15.1, 15.2, 14).
module "rds" {
  source = "./modules/rds"

  name_prefix           = var.project_name
  environment           = var.environment
  private_subnet_ids    = module.vpc.private_subnet_ids
  rds_security_group_id = module.security_group.rds_security_group_id

  db_name           = var.db_name
  db_username       = var.db_username
  db_password       = var.db_password
  instance_class    = var.db_instance_class
  engine_version    = var.db_engine_version
  allocated_storage = var.db_allocated_storage
  tags              = local.common_tags
}

# --------------------------------- EC2 -------------------------------------
# Instância t2.micro em subnet pública, SG do EC2 e LabInstanceProfile.
# Recebe a database_url do RDS (depende implicitamente do módulo rds via
# local.database_url) para subir a API na porta 3000 e aplicar o init.sql
# (Req 15.1, 13).
module "ec2" {
  source = "./modules/ec2"

  name_prefix           = var.project_name
  environment           = var.environment
  public_subnet_id      = module.vpc.public_subnet_ids[0]
  ec2_security_group_id = module.security_group.ec2_security_group_id

  instance_type        = var.instance_type
  iam_instance_profile = var.instance_profile_name
  key_name             = var.key_name != null ? var.key_name : ""
  database_url         = local.database_url
  api_port             = 3000
  tags                 = local.common_tags
}
