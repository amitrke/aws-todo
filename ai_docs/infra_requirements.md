# Infrastructure Requirements

## Cloud Provider
- **AWS**

## Region
- `us-east-1`

## Database
- **DynamoDB Table:**
  - A DynamoDB table named `TodoTable`.
  - **Billing:** On-demand (`PAY_PER_REQUEST`).
  - **Primary Key:**
    - `userId` (Partition Key, String)
    - `todoId` (Sort Key, String)

## Authentication
- **AWS Cognito Identity Pool:**
  - Manages user identities.
  - **Name:** `todo-identity-pool`.
  - **Providers:** Supports authenticated users logging in with Google.
  - **Access:** Unauthenticated access is disabled.

## API
- **API Gateway REST API:**
  - **Name:** `TodoApi`.
  - **Resource:** A `/todo` resource to manage todo items.
  - **Methods:**
    - `POST` on `/todo` to create new todo items.
  - **Security:** The `POST` method is secured using AWS IAM.
  - **Integration:** The API is directly integrated with the DynamoDB table.
  - **CORS:** Enabled for the `/todo` resource.

## Security & IAM
- **IAM Role for Authenticated Users:**
  - Grants permissions for CRUD operations on their own items in the DynamoDB table.
  - Grants permissions to invoke the API Gateway endpoints.

## Logging & Monitoring
- **CloudWatch Log Group:**
  - Captures API Gateway execution logs.

## Configuration
- **AWS Secrets Manager:**
  - The Google Client ID for Cognito is fetched from a secret named `dev/app`.