variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project Name"
  type        = string
  default     = "redirect-service"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "dev"
}

variable "shorten_project_name" {
  description = "Name of the shorten-service project to reference its resources"
  type        = string
  default     = "url-shortener-shorten-urls"
}
