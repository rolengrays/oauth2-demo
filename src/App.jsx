import { useState } from 'react'
import * as client from 'openid-client'
import * as jose from 'jose'
import './App.css'

async function getServerConfig() {
  const serverUrl = new URL('http://localhost:8080/realms/myrealm');
  const clientId = 'oidcdemo';
  const clientSecret = 'ouRb2YYsK6nn1y1zTMZGK7xglhoUFzgH';
  const config = await client.discovery(
    serverUrl,
    clientId,
    null,
    client.ClientSecretBasic(clientSecret),
    {
      execute: [client.allowInsecureRequests],
    },
  );
  return config;
}

function App() {
  const [serverConfig, setServerConfig] = useState(null);
  const [codeVerifier, setCodeVerifier] = useState(null);
  const [codeChallenge, setCodeChallenge] = useState(null);
  const [state, setState] = useState(null);
  const [nonce, setNonce] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  const [afterAuthParams, setAfterAuthParams] = useState(null);
  const [tokens, setTokens] = useState(null);

  const onClickCodeVerifier = async () => {
    const v = client.randomPKCECodeVerifier();
    const c = await client.calculatePKCECodeChallenge(v);
    const s = client.randomState();
    const n = client.randomNonce();
    setCodeVerifier(v);
    setCodeChallenge(c);
    setState(s);
    setNonce(n);
    sessionStorage.setItem("code_verifier", v);
    sessionStorage.setItem("nonce", n);
    sessionStorage.setItem("state", s);
  };

  const onClickAuth = () => {
    const r = client.buildAuthorizationUrl(serverConfig, {
      redirect_uri: 'http://localhost:5173/',
      scope: 'openid',
      code_challenge: codeChallenge,
      state: state,
      nonce: nonce,
      code_challenge_method: 'S256'
    });
    setRedirectTo(r);
  };

  const onClickAfterAuth = () => {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    const params = {};
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    setAfterAuthParams(params);
  };

  const onClickToken = async () => {
    const currentUrl = new URL(window.location.href);
    const tokens = await client.authorizationCodeGrant(
      serverConfig,
      currentUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce
      },
    );
    setTokens(tokens);
  };

  const onClickRefreshToken = async () => {
    const refreshToken = tokens.refresh_token;

    const refreshedTokens = await client.refreshTokenGrant(
      serverConfig,
      refreshToken,
    );

    setTokens(refreshedTokens);
  };

  const jwtToString = (jwt) => {
    const header = jose.decodeProtectedHeader(jwt);
    const body = jose.decodeJwt(jwt);
    return `${JSON.stringify(header, null, '\t')}\n${JSON.stringify(body, null, '\t')}`
  };

  const onClickVerifyToken = async () => {
    await verifyToken(tokens.access_token);
    await verifyToken(tokens.id_token);
  };

  const verifyToken = async (jwt) => {
    const JWKS = jose.createRemoteJWKSet(new URL(serverConfig.serverMetadata().jwks_uri))
    const { payload, protectedHeader } = await jose.jwtVerify(jwt, JWKS);
    console.log(protectedHeader);
    console.log(payload);
  };

  {
    if (serverConfig === null) {
      getServerConfig().then(c => setServerConfig(c));
    }

    const storedState = sessionStorage.getItem("state");
    if (storedState && state === null) {
      setState(storedState);
    }

    const storedNonce = sessionStorage.getItem("nonce");
    if (storedNonce && nonce === null) {
      setNonce(storedNonce);
    }

    const storedCodeVerifier = sessionStorage.getItem("code_verifier");
    if (storedCodeVerifier && nonce === null) {
      setCodeVerifier(storedCodeVerifier);
    }
  }

  return (
    <>
      <h1>OIDC demo</h1>
      <div className="card">
        <h2>Server Config</h2>
        <textarea id={'config'} readOnly={true} value={serverConfig !== null ? JSON.stringify(serverConfig.serverMetadata(), null, '\t') : ''} />
        <h2>Authorization Code flow</h2>
        <div>
          <button onClick={onClickCodeVerifier}>code verifier</button>
          <h3>code verifier</h3>
          <div>{codeVerifier}</div>
          <h3>code challenge</h3>
          <div>{codeChallenge}</div>
        </div>
        <h2>Begin Authentication</h2>
        <div>
          <button onClick={onClickAuth}>Auth</button>
          <h3>begin auth</h3>
          <a href={redirectTo ? redirectTo.toString() : ''}>{redirectTo ? redirectTo.toString() : ''}</a>
        </div>
        <h2>After Authentication</h2>
        <div>
          <button onClick={onClickAfterAuth}>After Authentication</button>
          <textarea id={'afterauth'} readOnly={true} value={afterAuthParams !== null ? JSON.stringify(afterAuthParams, null, '\t') : ''} />
        </div>
        <h2>Token Response</h2>
        <div>
          <button onClick={onClickToken}>Get Token</button>
          <button onClick={onClickRefreshToken}>Refresh</button>
          <textarea id={'token'} readOnly={true} value={tokens !== null ? JSON.stringify(tokens, null, '\t') : ''} />
        </div>
        <h2>Access Token</h2>
        <div>
          <textarea id={'access_token'} readOnly={true} value={tokens !== null ? jwtToString(tokens.access_token) : ''} />
        </div>
        <h2>ID Token</h2>
        <div>
          <textarea id={'id_token'} readOnly={true} value={tokens !== null ? jwtToString(tokens.id_token) : ''} />
        </div>
        <button onClick={onClickVerifyToken}>Verify ID Token</button>
      </div>
    </>
  )
}

export default App
