// =====================================================================
// AUTH — password gate local + OAuth2 PKCE contre le SSO EVE Online
// =====================================================================

const AUTH_KEY = "eve_espionage_session_v1";
const PW_OK_KEY = "eve_espionage_pw_ok";

const SSO_AUTHORIZE = "https://login.eveonline.com/v2/oauth/authorize";
const SSO_TOKEN = "https://login.eveonline.com/v2/oauth/token";
const SSO_VERIFY = "https://esi.evetech.net/verify/";

// ---------- Password gate ----------
function checkPassword(pw) {
  if (pw === CONFIG.ACCESS_PASSWORD) {
    sessionStorage.setItem(PW_OK_KEY, "1");
    return true;
  }
  return false;
}
function isPasswordUnlocked() {
  return sessionStorage.getItem(PW_OK_KEY) === "1";
}

// ---------- PKCE helpers ----------
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(str) {
  const data = new TextEncoder().encode(str);
  return await crypto.subtle.digest("SHA-256", data);
}
function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

async function startLogin() {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomString(16);

  sessionStorage.setItem("pkce_verifier", verifier);
  sessionStorage.setItem("pkce_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: CONFIG.REDIRECT_URI,
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    state: state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  window.location.href = `${SSO_AUTHORIZE}?${params.toString()}`;
}

// Appelé depuis callback.html
async function completeLogin(code, state) {
  const savedState = sessionStorage.getItem("pkce_state");
  const verifier = sessionStorage.getItem("pkce_verifier");
  if (!verifier || state !== savedState) {
    throw new Error("State PKCE invalide — relance le login.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    client_id: CONFIG.CLIENT_ID,
    code_verifier: verifier
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  // Si un client_secret est fourni (app "confidential"), on l'ajoute en Basic auth
  if (CONFIG.CLIENT_SECRET && CONFIG.CLIENT_SECRET !== "COLLE_TON_CLIENT_SECRET_ICI") {
    headers["Authorization"] = "Basic " + btoa(`${CONFIG.CLIENT_ID}:${CONFIG.CLIENT_SECRET}`);
  }

  const res = await fetch(SSO_TOKEN, { method: "POST", headers, body });
  if (!res.ok) throw new Error("Échec de l'échange du code OAuth (" + res.status + ")");
  const tok = await res.json();
  await storeToken(tok);
  return tok;
}

async function refreshToken() {
  const session = getSession();
  if (!session || !session.refresh_token) throw new Error("Pas de refresh_token disponible.");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refresh_token,
    client_id: CONFIG.CLIENT_ID
  });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (CONFIG.CLIENT_SECRET && CONFIG.CLIENT_SECRET !== "COLLE_TON_CLIENT_SECRET_ICI") {
    headers["Authorization"] = "Basic " + btoa(`${CONFIG.CLIENT_ID}:${CONFIG.CLIENT_SECRET}`);
  }

  const res = await fetch(SSO_TOKEN, { method: "POST", headers, body });
  if (!res.ok) throw new Error("Échec du refresh token (" + res.status + ")");
  const tok = await res.json();
  await storeToken(tok, session.refresh_token);
  return tok;
}

async function storeToken(tok, fallbackRefresh = null) {
  // Décoder le JWT access_token pour récupérer character_id / scopes / nom
  const payload = JSON.parse(atob(tok.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const characterId = parseInt(payload.sub.split(":").pop(), 10);
  const scopes = (payload.scp ? (Array.isArray(payload.scp) ? payload.scp : [payload.scp]) : []);

  const session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || fallbackRefresh,
    expires_at: Date.now() + (tok.expires_in || 1200) * 1000,
    character_id: characterId,
    character_name: payload.name,
    scopes: scopes
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function getValidAccessToken() {
  let session = getSession();
  if (!session) throw new Error("Non connecté.");
  if (Date.now() > session.expires_at - 30000) {
    await refreshToken();
    session = getSession();
  }
  return session.access_token;
}

function hasScope(scope) {
  const session = getSession();
  if (!session) return false;
  return session.scopes.includes(scope);
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(PW_OK_KEY);
  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("pkce_state");
  window.location.href = "index.html";
}
