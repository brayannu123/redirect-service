# 1. Referenciar la tabla DynamoDB existente
# Usamos data source para obtener el ARN y Nombre sin crearla
data "aws_dynamodb_table" "urls" {
  name = "${var.shorten_project_name}-${var.environment}"
}

# 2. IAM Role para la Lambda de Redirección
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 3. Políticas de IAM (CloudWatch + DynamoDB Read Only)
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Effect   = "Allow"
        Resource = data.aws_dynamodb_table.urls.arn
      }
    ]
  })
}

# 4. Función Lambda
resource "aws_lambda_function" "redirect" {
  filename      = "../dist/index.zip"
  function_name = "${var.project_name}-${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler" # esbuild genera index.js
  runtime       = "nodejs20.x"

  environment {
    variables = {
      TABLE_NAME = data.aws_dynamodb_table.urls.name
    }
  }

  source_code_hash = fileexists("../dist/index.zip") ? filebase64sha256("../dist/index.zip") : null
}

# 5. API Gateway HTTP v2
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Content-Type"]
    allow_methods = ["GET", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.redirect.invoke_arn
}

# Ruta dinámica para capturar /{shortId}
resource "aws_apigatewayv2_route" "get_redirect" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /{shortId}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# 6. Permiso para API Gateway
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.redirect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
