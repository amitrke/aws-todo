# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to effectively contribute to this project.

## Project Overview

This project is a simple "To-Do" single-page application (SPA). It features a React-based frontend and an AWS serverless backend. The goal is to allow users to manage their to-do items, which are stored in DynamoDB. Authentication is handled via Google Sign-In, integrated with AWS Cognito.

## Project Structure

The repository is organized into two main directories:

-   `infra/`: Contains all Terraform configuration for the AWS backend infrastructure.
-   `ui/`: Contains the React/TypeScript frontend application.

---

## Infrastructure (`infra/`)

The backend infrastructure is managed using Terraform.

### Key AWS Resources:

-   **Amazon DynamoDB:** A `TodoTable` stores the to-do items. It uses a composite primary key (`userId` and `todoId`).
-   **Amazon Cognito:** A `todo-identity-pool` manages user identities, enabling login with Google.
-   **Amazon API Gateway:** A REST API (`/todo`) provides an endpoint for creating tasks. It's secured with AWS IAM and integrates directly with DynamoDB.
-   **AWS IAM:** An IAM role for authenticated users grants necessary permissions for API and database access.
-   **AWS Secrets Manager:** Used to store the Google Client ID.

### Commands:

-   Initialize Terraform: `terraform init`
-   Plan changes: `terraform plan`
-   Apply changes: `terraform apply -auto-approve`

---

## User Interface (`ui/`)

The frontend is a single-page application built with React and TypeScript.

### Key Features:

-   Google Sign-In for authentication.
-   Fetches and displays a user's to-do list after login.
-   Allows users to mark tasks as complete.
-   New tasks can be created and are associated with the user's identity.

### Key Dependencies:

-   `react` & `react-dom`
-   `typescript`
-   `@react-oauth/google` for Google authentication.
-   `@aws-sdk/*` v3 packages for interacting with AWS services.
-   `uuid` for generating unique IDs for to-do items.

### Commands:

-   Install dependencies: `npm install`
-   Start the development server: `npm start`
-   Run tests: `npm test`
-   Build for production: `npm run build`

---

## Development Workflow

1.  **Backend Changes:**
    -   Modify the Terraform files in the `infra/` directory.
    -   Run `terraform plan` to review changes.
    -   Run `terraform apply` to deploy the infrastructure.

2.  **Frontend Changes:**
    -   Navigate to the `ui/` directory.
    -   Run `npm install` if new dependencies were added.
    -   Make changes to the React components in `ui/src/`.
    -   Use `npm start` to test locally.
    -   Run `npm run build` to create a production build.

## Conventions

-   **Infrastructure:** Adhere to standard Terraform best practices and the existing structure in the `infra/` directory.
-   **Frontend:** Follow standard React and TypeScript conventions. Maintain the component-based architecture.
-   **Commits:** Write clear and concise commit messages that explain the "why" behind the changes.
