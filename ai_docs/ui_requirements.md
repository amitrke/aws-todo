# UI Requirements

## Framework
- **React**

## Language
- **TypeScript**

## Functionality
- A simple single-page application (SPA).
- Users can sign in using their Google account.
- Once signed in, users can create new "todo" items.
- Each todo item has a unique ID and content.

## Authentication
- Uses the `@react-oauth/google` library for Google Sign-In.
- After a successful Google login, the application exchanges the Google ID token for temporary AWS credentials using a Cognito Identity Pool.

## AWS Integration
- Uses the AWS SDK for JavaScript v3.
- Interacts with DynamoDB to store todo items.
- Each todo item is associated with the user's Cognito Identity ID to ensure that users can only access their own todos.

## Dependencies
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/credential-providers`
- `@aws-sdk/lib-dynamodb`
- `@react-oauth/google`
- `react`
- `react-dom`
- `typescript`
- `uuid` (for generating unique todo IDs)