import React, { useState, ChangeEvent, useEffect } from "react";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  idToken: string;
  cognitoIdentityId: string;
};

type TodoItem = {
  todoId: string;
  content: string;
  completed: boolean;
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
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [dynamoClient, setDynamoClient] = useState<DynamoDBDocumentClient | null>(null);

  useEffect(() => {
    if (dynamoClient) {
      fetchTodos();
    }
  }, [dynamoClient]);

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

  const fetchTodos = async () => {
    if (!dynamoClient || !creds) return;

    const command = new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": creds.cognitoIdentityId,
      },
    });

    try {
      const { Items } = await dynamoClient.send(command);
      setTodos(Items as TodoItem[]);
    } catch (err) {
      console.error("Error fetching todos:", err);
      alert("Error fetching todos.");
    }
  };

  const handleToggleComplete = async (todoId: string, currentStatus: boolean) => {
    if (!dynamoClient || !creds) return;

    const command = new UpdateCommand({
      TableName: config.tableName,
      Key: {
        userId: creds.cognitoIdentityId,
        todoId: todoId,
      },
      UpdateExpression: "set completed = :completed",
      ExpressionAttributeValues: {
        ":completed": !currentStatus,
      },
      ReturnValues: "UPDATED_NEW",
    });

    try {
      await dynamoClient.send(command);
      setTodos(
        todos.map((item) =>
          item.todoId === todoId ? { ...item, completed: !currentStatus } : item
        )
      );
    } catch (err) {
      console.error("Error updating todo:", err);
      alert("Error updating todo.");
    }
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
          content: todo,
          completed: false
        }
      });

      // Send the command to DynamoDB
      await dynamoClient.send(command);
      alert("Todo added successfully!");
      setTodo("");
      fetchTodos(); // Refresh the list
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

            <hr style={{ margin: "20px 0" }} />

            <h2>Todo List</h2>
            {todos.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {todos.map((item) => (
                  <li key={item.todoId} style={{ textDecoration: item.completed ? "line-through" : "none" }}>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleComplete(item.todoId, item.completed)}
                      style={{ marginRight: 10 }}
                    />
                    {item.content}
                  </li>
                ))}
              </ul>
            ) : (
              <p>You have no tasks yet.</p>
            )}
          </>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
