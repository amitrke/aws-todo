# ------------------------------
# Terraform Setup for Todo App
# ------------------------------

provider "aws" {
  region = "us-east-1"
}

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

data "aws_secretsmanager_secret" "app" {
  name = "dev/app"
}

data "aws_secretsmanager_secret_version" "app" {
  secret_id = data.aws_secretsmanager_secret.app.id
}

locals {
  secrets = jsondecode(data.aws_secretsmanager_secret_version.app.secret_string)
  region  = data.aws_region.current.name
}

# ------------------
# DynamoDB Table
# ------------------
resource "aws_dynamodb_table" "todo_table" {
  name         = "TodoTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "todoId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "todoId"
    type = "S"
  }
}

# ------------------
# Cognito User Pool
# ------------------
resource "aws_cognito_user_pool" "user_pool" {
  name = "todo-user-pool"
}

# ------------------
# Google IdP
# ------------------
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.user_pool.id
  provider_name = "Google"
  provider_type = "Google"
  provider_details = {
    client_id        = local.secrets["google_client_id"]
    client_secret    = local.secrets["google_client_secret"]
    authorize_scopes = "openid email profile"
  }
  attribute_mapping = {
    email = "email"
  }

}

# User pool domain
resource "aws_cognito_user_pool_domain" "user_pool_domain" {
  domain       = "amrke-myapp"
  user_pool_id = aws_cognito_user_pool.user_pool.id
}

resource "aws_cognito_user_pool_client" "user_pool_client" {
  name                                 = "todo-client"
  user_pool_id                         = aws_cognito_user_pool.user_pool.id
  generate_secret                      = false
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers         = ["Google"]
  callback_urls                        = ["http://localhost:3000"]
  logout_urls                          = ["http://localhost:3000"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  depends_on = [
    aws_cognito_identity_provider.google
  ]
}

# ------------------
# Cognito Identity Pool
# ------------------
resource "aws_cognito_identity_pool" "identity_pool" {
  identity_pool_name               = "todo-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.user_pool_client.id
    provider_name = "cognito-idp.${local.region}.amazonaws.com/${aws_cognito_user_pool.user_pool.id}"
  }

  supported_login_providers = {
    "accounts.google.com" = local.secrets["google_client_id"]
  }
}

# ------------------
# IAM Roles for Identity Pool
# ------------------
resource "aws_iam_role" "authenticated_role" {
  name = "Cognito_Todo_Authenticated"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.identity_pool.id
          },
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "dynamo_access_policy" {
  name = "DynamoAccessPolicy"
  role = aws_iam_role.authenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ],
        Resource = aws_dynamodb_table.todo_table.arn,
        Condition = {
          "ForAllValues:StringEquals" = {
            "dynamodb:LeadingKeys" = ["$${cognito-identity.amazonaws.com:sub}"]
          }
        }
      },
      {
        Effect = "Allow",
        Action = [
          "execute-api:Invoke"
        ],
        Resource = "arn:aws:execute-api:${local.region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.todo_api.id}/*"
      }
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "roles_attachment" {
  identity_pool_id = aws_cognito_identity_pool.identity_pool.id
  roles = {
    authenticated = aws_iam_role.authenticated_role.arn
  }
}

# ------------------
# API Gateway to DynamoDB (Direct Integration)
# ------------------
resource "aws_api_gateway_rest_api" "todo_api" {
  name        = "TodoApi"
  description = "API for Todo App using direct integration with DynamoDB"

  depends_on = [
    aws_cognito_user_pool_client.user_pool_client,
    aws_cognito_identity_pool.identity_pool,
    aws_iam_role.authenticated_role
  ]
}

resource "aws_api_gateway_resource" "todo_resource" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  parent_id   = aws_api_gateway_rest_api.todo_api.root_resource_id
  path_part   = "todo"
}

resource "aws_api_gateway_method" "post_todo" {
  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  resource_id   = aws_api_gateway_resource.todo_resource.id
  http_method   = "POST"
  authorization = "AWS_IAM"

  request_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration" "post_todo_integration" {
  rest_api_id             = aws_api_gateway_rest_api.todo_api.id
  resource_id             = aws_api_gateway_resource.todo_resource.id
  http_method             = aws_api_gateway_method.post_todo.http_method
  type                    = "AWS"
  credentials             = aws_iam_role.authenticated_role.arn
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:${local.region}:dynamodb:action/PutItem"

  request_templates = {
    "application/json" = <<EOF
{
  "TableName": "${aws_dynamodb_table.todo_table.name}",
  "Item": {
    "userId": {
      "S": "$context.identity.cognitoIdentityId"
    },
    "todoId": {
      "S": "$input.path('$.todoId')"
    },
    "content": {
      "S": "$input.path('$.content')"
    }
  }
}
EOF
  }
}

resource "aws_api_gateway_method_response" "post_todo_200" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.post_todo.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }

  response_models = {
    "application/json" = "Empty"
  }

  depends_on = [aws_api_gateway_integration.post_todo_integration]
}

resource "aws_api_gateway_integration_response" "post_todo_200" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.post_todo.http_method
  status_code = "200"
  response_templates = {
    "application/json" = "\"Success\""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  depends_on = [
    aws_api_gateway_integration.post_todo_integration,
    aws_api_gateway_method_response.post_todo_200
  ]
}

resource "aws_api_gateway_integration_response" "post_todo_400" {
  rest_api_id       = aws_api_gateway_rest_api.todo_api.id
  resource_id       = aws_api_gateway_resource.todo_resource.id
  http_method       = aws_api_gateway_method.post_todo.http_method
  status_code       = "400"
  selection_pattern = "^4\\d{2}.*"
  response_templates = {
    "application/json" = "{ \"error\": \"Bad Request\" }"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  depends_on = [
    aws_api_gateway_integration.post_todo_integration,
    aws_api_gateway_method_response.post_todo_400
  ]
}

resource "aws_api_gateway_method_response" "post_todo_400" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.post_todo.http_method
  status_code = "400"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "post_todo_500" {
  rest_api_id       = aws_api_gateway_rest_api.todo_api.id
  resource_id       = aws_api_gateway_resource.todo_resource.id
  http_method       = aws_api_gateway_method.post_todo.http_method
  status_code       = "500"
  selection_pattern = "^5\\d{2}.*"
  response_templates = {
    "application/json" = "{ \"error\": \"Internal Server Error\" }"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }
  depends_on = [
    aws_api_gateway_integration.post_todo_integration,
    aws_api_gateway_method_response.post_todo_500
  ]
}

resource "aws_api_gateway_method_response" "post_todo_500" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.post_todo.http_method
  status_code = "500"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
  response_models = {
    "application/json" = "Empty"
  }
}

# OPTIONS method and integration...

resource "aws_api_gateway_method" "options_todo" {
  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  resource_id   = aws_api_gateway_resource.todo_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_todo_integration" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.options_todo.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "options_todo_200" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.options_todo.http_method
  status_code = "200"
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-amz-content-sha256'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [
    aws_api_gateway_integration.options_todo_integration,
    aws_api_gateway_method_response.options_todo_200
  ]
}

resource "aws_api_gateway_method_response" "options_todo_200" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todo_resource.id
  http_method = aws_api_gateway_method.options_todo.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }

  depends_on = [aws_api_gateway_integration.options_todo_integration]
}

resource "aws_api_gateway_deployment" "todo_deployment" {
  depends_on = [
    aws_api_gateway_integration.post_todo_integration,
    aws_api_gateway_integration.options_todo_integration,
    aws_api_gateway_method_response.options_todo_200
  ]
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  lifecycle {
    create_before_destroy = true
  }

  triggers = {
    #redeploy = sha1(jsonencode(aws_api_gateway_rest_api.todo_api))
    redeployment = timestamp()
  }
}

resource "aws_api_gateway_stage" "todo_stage" {
  deployment_id = aws_api_gateway_deployment.todo_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  stage_name    = "prod"
}

# ------------------
# Outputs
# ------------------
output "api_url" {
  value = "https://${aws_api_gateway_rest_api.todo_api.id}.execute-api.${local.region}.amazonaws.com/${aws_api_gateway_stage.todo_stage.stage_name}/todo"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.user_pool.id
}

output "identity_pool_id" {
  value = aws_cognito_identity_pool.identity_pool.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.user_pool_client.id
}

# User pool domain URL
output "user_pool_domain" {
  value = "${aws_cognito_user_pool_domain.user_pool_domain.domain}.auth.${local.region}.amazoncognito.com"
}
