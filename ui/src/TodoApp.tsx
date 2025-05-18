import React, { useState, ChangeEvent } from "react";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  idToken: string;
  cognitoIdentityId: string;
};

const config = {
  region: "us-east-1",
  identityPoolId: "us-east-1:a991f7f5-859e-41c7-b4fc-cf5f527886f8",
  tableName: "TodoTable", // Your DynamoDB table name
  googleClientId: "665813907165-ag9scpreoqoq3krqt12q1e4lh2vb4f2l.apps.googleusercontent.com"
};

export default function TodoApp() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [todo, setTodo] = useState<string>("");
  const [dynamoClient, setDynamoClient] = useState<DynamoDBDocumentClient | null>(null);

  // Handle Google login success
  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      alert("Google login failed");
      return;
    }
    const googleIdToken = credentialResponse.credential;

    // Exchange Google token for AWS credentials via Cognito Identity Pool
    const logins: Record<string, string> = {
      "accounts.google.com": googleIdToken,
    };

    const credentialProvider = fromCognitoIdentityPool({
      identityPoolId: config.identityPoolId,
      clientConfig: { region: config.region },
      logins,
    });

    const awsCreds = await credentialProvider();

    // Get User Identity ID
    const identityId = awsCreds.identityId;
    console.log("Identity ID:", identityId); // Log it to verify
    if (!awsCreds) {
      alert("Failed to get AWS credentials");
      return;
    }

    // Set up DynamoDB client
    const client = new DynamoDBClient({
      region: config.region,
      credentials: awsCreds
    });
    
    const docClient = DynamoDBDocumentClient.from(client);
    setDynamoClient(docClient);

    setCreds({
      accessKeyId: awsCreds.accessKeyId,
      secretAccessKey: awsCreds.secretAccessKey,
      sessionToken: awsCreds.sessionToken ?? "",
      idToken: googleIdToken,
      cognitoIdentityId: identityId ?? "",
    });
  };

  const submitTodo = async () => {
    if (!dynamoClient) return;
    if (!todo.trim()) {
      alert("Todo cannot be empty");
      return;
    }
    
    try {
      const todoId = uuidv4();
      
      // Get the identity ID - this is important for per-user isolation
      const identityId = creds?.cognitoIdentityId
      
      // Create a PutCommand to add an item to DynamoDB
      const command = new PutCommand({
        TableName: config.tableName,
        Item: {
          userId: identityId,
          todoId: todoId,
          content: todo
        }
      });

      // Send the command to DynamoDB
      const result = await dynamoClient.send(command);
      alert("Todo added successfully!");
      setTodo("");
    } catch (err) {
      alert("Error: " + (err as Error).message);
      console.error(err);
    }
  };

  return (
    <GoogleOAuthProvider clientId={config.googleClientId}>
      <div style={{ padding: 20 }}>
        {!creds ? (
          <GoogleLogin
            onSuccess={handleGoogleLogin}
            onError={() => alert("Google login failed")}
            useOneTap
          />
        ) : (
          <>
            <h2>Create Todo</h2>
            <input
              type="text"
              placeholder="Enter todo"
              value={todo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTodo(e.target.value)}
            />
            <button onClick={submitTodo}>Submit</button>
          </>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
