output "api_endpoint" {
  description = "URL del API Gateway para redirección"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/${var.environment}"
}

output "lambda_function_name" {
  value = aws_lambda_function.redirect.function_name
}
