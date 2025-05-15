import React, { useEffect, useState, ChangeEvent } from "react";
import {
  fromCognitoIdentityPool
} from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { FetchHttpHandler } from "@aws-sdk/fetch-http-handler";
import { Sha256 } from "@aws-crypto/sha256-js";
import { v4 as uuidv4 } from "uuid";
import { HttpRequest } from "@smithy/protocol-http";

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  idToken: string;
};

const config = {
  region: "us-west-2",
  userPoolDomain: "https://your-user-pool-domain.auth.us-west-2.amazoncognito.com",
  userPoolClientId: "your-client-id",
  identityPoolId: "your-identity-pool-id",
  apiEndpoint: "https://your-api-id.execute-api.us-west-2.amazonaws.com/prod/todo"
};

export default function TodoApp() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [todo, setTodo] = useState<string>("");

  const login = () => {
    const redirectUri = window.location.origin;
    const loginUrl = `${config.userPoolDomain}/oauth2/authorize?identity_provider=Google&response_type=token&client_id=${config.userPoolClientId}&redirect_uri=${redirectUri}&scope=email openid profile`;
    window.location.assign(loginUrl);
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("id_token")) {
      const params = new URLSearchParams(hash.slice(1));
      const idToken = params.get("id_token");

      const logins: Record<string, string> = {
        [`cognito-idp.${config.region}.amazonaws.com/${config.userPoolDomain.split("//")[1].split(".")[0]}`]: idToken!,
      };

      const credentialProvider = fromCognitoIdentityPool({
        identityPoolId: config.identityPoolId,
        clientConfig: { region: config.region },
        logins,
      });

      credentialProvider().then((creds) => {
        setCreds({
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken ?? "",
          idToken: idToken!
        });
      });
    }
  }, []);

  const submitTodo = async () => {
    if (!creds) return;

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
    alert("Response: " + responseBody);
  };

  return (
    <div style={{ padding: 20 }}>
      {!creds ? (
        <button onClick={login}>Login with Google</button>
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
  );
}
