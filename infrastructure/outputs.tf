output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_url" {
  description = "HTTP URL of the application"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "cost_estimate" {
  description = "Estimated monthly AWS cost breakdown"
  value = <<-EOT
    ┌──────────────────────────────────────────┐
    │      Estimated Monthly Cost Breakdown     │
    ├──────────────────────────────────────────┤
    │  ECS Fargate (0.25 vCPU / 512 MB)        │
    │    1 task × ~$0.01048/hr × 730 hr ≈ $15  │
    │  RDS PostgreSQL (db.t4g.micro)            │
    │    Single-AZ, 20 GB gp3 storage   ≈ $15  │
    │  ALB (750 LCU-hours free tier)            │
    │    + data transfer             ≈  $5-$8  │
    │  ECR storage + data transfer   ≈   $1-2  │
    │  CloudWatch Logs               ≈   $1-2  │
    ├──────────────────────────────────────────┤
    │  TOTAL ESTIMATE                ≈ $37-$42 │
    └──────────────────────────────────────────┘
  EOT
}

output "deploy_instructions" {
  description = "Quick-start deployment instructions"
  value = <<-EOT
    1. Build & push Docker image:
         aws ecr get-login-password --region ${var.aws_region} | \
           docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}
         docker build -t ${aws_ecr_repository.app.repository_url}:latest .
         docker push ${aws_ecr_repository.app.repository_url}:latest

    2. Run Prisma migrations (one-time, from your machine or CI):
         DATABASE_URL="postgresql://<user>:<pass>@${aws_db_instance.postgres.address}:5432/${var.db_name}" \
           npx prisma migrate deploy

    3. Force new ECS deployment:
         aws ecs update-service --cluster ${aws_ecs_cluster.main.name} \
           --service ${aws_ecs_service.app.name} --force-new-deployment

    4. Open: http://${aws_lb.main.dns_name}
  EOT
}
