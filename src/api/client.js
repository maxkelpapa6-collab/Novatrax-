// Client de l'API NOVATRAX (serveur maison : server/index.ts).
// Interface : api.auth, api.entities.<Entité>, api.functions.invoke,
// api.integrations.Core (envoi de fichiers).

const TOKEN_KEY = "novatrax_token";

function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // stockage indisponible (navigation privée) : session limitée à l'onglet
  }
}

// Erreur au format attendu par les pages : err.message, err.status et
// err.response.data.error.
function apiError(status, data) {
  const err = new Error((data && data.error) || "Erreur " + status);
  err.status = status;
  err.response = { status, data };
  err.data = data;
  return err;
}

async function request(method, path, body, { raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = raw ? text : { error: text };
  }
  if (!res.ok) throw apiError(res.status, data);
  return data;
}

// Rafraîchissement périodique à la place d'un abonnement temps réel.
const SUBSCRIBE_INTERVAL_MS = 15000;

function entity(name) {
  const base = "/api/entities/" + encodeURIComponent(name);
  return {
    filter: (query = {}, options = {}) => request("POST", base + "/filter", { query, options }),
    list: (sort, limit) => request("POST", base + "/filter", { query: {}, options: { sort, limit } }),
    get: (id) => request("GET", base + "/" + encodeURIComponent(id)),
    count: async (query = {}) => (await request("POST", base + "/count", { query })).count,
    aggregate: (spec = {}) => request("POST", base + "/aggregate", spec),
    create: (data) => request("POST", base, data),
    update: (id, data) => request("PATCH", base + "/" + encodeURIComponent(id), data),
    updateMany: (query, update) => request("POST", base + "/updateMany", { query, update }),
    delete: (id) => request("DELETE", base + "/" + encodeURIComponent(id)),
    subscribe(callback) {
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") callback({ type: "refresh" });
      }, SUBSCRIBE_INTERVAL_MS);
      return () => clearInterval(timer);
    }
  };
}

function loginUrl(returnTo) {
  return "/login" + (returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : "");
}

const auth = {
  isAuthenticated: async () => !!getToken(),
  me: () => request("GET", "/api/auth/me"),
  updateMe: (data) => request("PUT", "/api/auth/me", data),
  register: ({ email, password }) => request("POST", "/api/auth/register", { email, password }),
  verifyOtp: ({ email, otpCode }) => request("POST", "/api/auth/verify-otp", { email, otpCode }),
  resendOtp: (email) => request("POST", "/api/auth/resend-otp", { email }),
  async loginViaEmailPassword(email, password) {
    const res = await request("POST", "/api/auth/login", { email, password });
    setToken(res.access_token);
    return res;
  },
  setToken: (token) => setToken(token),
  resetPasswordRequest: (email) => request("POST", "/api/auth/reset-request", { email }),
  resetPassword: ({ resetToken, newPassword }) => request("POST", "/api/auth/reset", { resetToken, newPassword }),
  logout(redirectUrl) {
    setToken(null);
    if (redirectUrl) window.location.href = loginUrl();
  },
  redirectToLogin(returnTo) {
    const path = returnTo ? new URL(returnTo, window.location.origin) : null;
    window.location.href = loginUrl(path ? path.pathname + path.search : "");
  }
};

async function upload(path, file) {
  const form = new FormData();
  form.append("file", file);
  return request("POST", path, form);
}

export const api = {
  auth,
  entities: new Proxy({}, { get: (_t, name) => (typeof name === "string" ? entity(name) : undefined) }),
  functions: {
    invoke: async (name, body = {}) => ({ data: await request("POST", "/api/functions/" + encodeURIComponent(name), body) })
  },
  integrations: {
    Core: {
      UploadPublicFile: ({ file }) => upload("/api/files/public", file),
      UploadPrivateFile: ({ file }) => upload("/api/files/private", file)
    }
  }
};

export const hasStoredToken = () => !!getToken();
