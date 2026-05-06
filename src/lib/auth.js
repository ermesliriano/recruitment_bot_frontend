// Gestión muy simple de sesión en cliente.
// El backend sigue siendo quien valida el Bearer token en cada petición protegida.

const LOCAL_KEY = "recruitment_bot.auth.local";
const SESSION_KEY = "recruitment_bot.auth.session";
const ENV_DISABLED_KEY = "recruitment_bot.auth.env.disabled";

const DEFAULT_EMAIL = String(
  import.meta.env.VITE_DEFAULT_EMAIL || "admin@local.dev"
).trim();

const ENV_TOKEN = String(import.meta.env.VITE_ADMIN_TOKEN || "").trim();

function getStorage(kind) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJsonFromStorage(kind, key) {
  const storage = getStorage(kind);
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function writeJsonToStorage(kind, key, value) {
  const storage = getStorage(kind);
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function removeFromStorage(kind, key) {
  const storage = getStorage(kind);
  if (!storage) {
    return;
  }

  storage.removeItem(key);
}

function clearStoredAuth() {
  removeFromStorage("local", LOCAL_KEY);
  removeFromStorage("session", SESSION_KEY);
}

function setEnvTokenDisabled(disabled) {
  const storages = [getStorage("local"), getStorage("session")].filter(Boolean);

  storages.forEach((storage) => {
    if (disabled) {
      storage.setItem(ENV_DISABLED_KEY, "1");
    } else {
      storage.removeItem(ENV_DISABLED_KEY);
    }
  });
}

function isEnvTokenDisabled() {
  const storages = [getStorage("local"), getStorage("session")].filter(Boolean);

  return storages.some((storage) => storage.getItem(ENV_DISABLED_KEY) === "1");
}

function normalizeAuthState({ email, token, lastLoginAt }, source) {
  return {
    email: String(email || DEFAULT_EMAIL || "").trim(),
    token: String(token || "").trim(),
    remember: source === "local",
    source,
    isEnvToken: source === "env",
    lastLoginAt: lastLoginAt || null,
  };
}

export function isEnvTokenConfigured() {
  return Boolean(ENV_TOKEN);
}

export function getInitialAuthState() {
  const sessionState = readJsonFromStorage("session", SESSION_KEY);
  if (sessionState?.token) {
    return normalizeAuthState(sessionState, "session");
  }

  const localState = readJsonFromStorage("local", LOCAL_KEY);
  if (localState?.token) {
    return normalizeAuthState(localState, "local");
  }

  if (ENV_TOKEN && !isEnvTokenDisabled()) {
    return normalizeAuthState(
      {
        email: DEFAULT_EMAIL,
        token: ENV_TOKEN,
        lastLoginAt: null,
      },
      "env"
    );
  }

  return {
    email: "",
    token: "",
    remember: false,
    source: null,
    isEnvToken: false,
    lastLoginAt: null,
  };
}

export function persistAuthState({ email, token, remember }) {
  clearStoredAuth();
  setEnvTokenDisabled(false);

  const payload = {
    email: String(email || DEFAULT_EMAIL).trim().toLowerCase(),
    token: String(token || "").trim(),
    lastLoginAt: new Date().toISOString(),
  };

  if (remember) {
    writeJsonToStorage("local", LOCAL_KEY, payload);
  } else {
    writeJsonToStorage("session", SESSION_KEY, payload);
  }

  return normalizeAuthState(payload, remember ? "local" : "session");
}

export function clearAuthState() {
  clearStoredAuth();

  if (ENV_TOKEN) {
    setEnvTokenDisabled(true);
  }

  return getInitialAuthState();
}

export function getAuthToken() {
  return getInitialAuthState().token || "";
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}
