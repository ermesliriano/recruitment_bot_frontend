import { createContext, useContext, useState } from "react";
import {
  clearAuthState,
  getInitialAuthState,
  persistAuthState,
} from "../lib/auth";

const AppContext = createContext(null);

const SELECTION_KEY = "recruitment_bot.selection";
const ENV_TENANT_ID = String(import.meta.env.VITE_TENANT_ID || "").trim();
const ENV_VACANCY_ID = String(import.meta.env.VITE_VACANCY_ID || "").trim();

function parseJsonSafely(rawValue, fallbackValue) {
  try {
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function getSelectionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialSelection() {
  const storage = getSelectionStorage();
  const savedSelection = storage
    ? parseJsonSafely(storage.getItem(SELECTION_KEY), {})
    : {};

  return {
    tenantId: String(savedSelection.tenantId || ENV_TENANT_ID || "").trim(),
    vacancyId: String(savedSelection.vacancyId || ENV_VACANCY_ID || "").trim(),
  };
}

function persistSelection(nextSelection) {
  const storage = getSelectionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SELECTION_KEY, JSON.stringify(nextSelection));
}

export function AppProvider({ children }) {
  const [authState, setAuthState] = useState(() => getInitialAuthState());
  const [selectionState, setSelectionState] = useState(() =>
    readInitialSelection()
  );
  const [flashes, setFlashes] = useState([]);

  function pushFlash(type, text) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setFlashes((current) => [...current, { id, type, text }]);

    setTimeout(() => {
      setFlashes((current) => current.filter((item) => item.id !== id));
    }, 6000);

    return id;
  }

  function removeFlash(id) {
    setFlashes((current) => current.filter((item) => item.id !== id));
  }

  function setSelection(patch) {
    setSelectionState((current) => {
      const nextSelection = {
        tenantId: Object.prototype.hasOwnProperty.call(patch, "tenantId")
          ? String(patch.tenantId || "").trim()
          : current.tenantId,
        vacancyId: Object.prototype.hasOwnProperty.call(patch, "vacancyId")
          ? String(patch.vacancyId || "").trim()
          : current.vacancyId,
      };

      persistSelection(nextSelection);
      return nextSelection;
    });
  }

  function login({ email, token, remember }) {
    const nextAuthState = persistAuthState({ email, token, remember });
    setAuthState(nextAuthState);
    return nextAuthState;
  }

  function signup({ email, token, remember }) {
    const nextAuthState = persistAuthState({ email, token, remember });
    setAuthState(nextAuthState);
    return nextAuthState;
  }

  function logout() {
    const nextAuthState = clearAuthState();
    setAuthState(nextAuthState);
    return nextAuthState;
  }

  const value = {
    authState,
    currentUserLabel: authState.email || "Operador local",
    isAuthenticated: Boolean(authState.token),
    login,
    signup,
    logout,
    flashes,
    pushFlash,
    removeFlash,
    tenantId: selectionState.tenantId,
    vacancyId: selectionState.vacancyId,
    setSelection,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext debe usarse dentro de AppProvider.");
  }

  return context;
}
