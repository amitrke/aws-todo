import React, { useEffect, useState, ChangeEvent } from "react";
import {
  fromCognitoIdentityPool
} from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { FetchHttpHandler } from "@aws-sdk/fetch-http-handler";
import { Sha256 } from "@aws-crypto/sha256-js";
import { v4 as uuidv4 } from "uuid";
import { HttpRequest } from "@smithy/protocol-http";
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google";

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  idToken: string;
};

const config = {
  region: "us-east-1",
  userPoolDomain: "https://amrke-myapp.auth.us-east-1.amazoncognito.com",
  userPoolClientId: "7hhnoqsa1n6m4f6c5g5iat844f",
  userPoolId: "us-east-1_udPTILGXc",
  identityPoolId: "us-east-1:e23ff60b-aaed-415a-95f9-e0a30528866b",
  apiEndpoint: "https://hgme670fp1.execute-api.us-east-1.amazonaws.com/prod/todo",
  googleClientId: "665813907165-ag9scpreoqoq3krqt12q1e4lh2vb4f2l.apps.googleusercontent.com" // <-- Replace with your Google client ID
};

export default function TodoApp() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [todo, setTodo] = useState<string>("");

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
    setCreds({
      accessKeyId: awsCreds.accessKeyId,
      secretAccessKey: awsCreds.secretAccessKey,
      sessionToken: awsCreds.sessionToken ?? "",
      idToken: googleIdToken
    });
  };

  const submitTodo = async () => {
    if (!creds) return;
    if (!todo.trim()) {
      alert("Todo cannot be empty");
      return;
    }
    try {
      const todoId = uuidv4();
      const request = new HttpRequest({
        method: "POST",
        protocol: "https:",
        hostname: config.apiEndpoint.replace("https://", "").split("/")[0],
        path: "/prod/todo",
        headers: {
          "Content-Type": "application/json",
          host: config.apiEndpoint.replace("https://", "").split("/")[0],
        },
        body: JSON.stringify({ todoId, content: todo }),
      });

      const signer = new SignatureV4({
        credentials: creds,
        service: "execute-api",
        region: config.region,
        sha256: Sha256,
      });

      const signedRequest = await signer.sign(request);

      const handler = new FetchHttpHandler();
      const { response } = await handler.handle(signedRequest as any);
      const responseBody = await new Response(response.body).text();
      alert("Response: " + responseBody);
    } catch (err) {
      alert("Error: " + (err as Error).message);
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
