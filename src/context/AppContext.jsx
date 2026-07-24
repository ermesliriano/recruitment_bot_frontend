import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuthState,
  getInitialAuthState,
  persistAuthState,
} from "../lib/auth";
import { authMe } from "../lib/api";

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

  const pushFlash = useCallback((type, text) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setFlashes((current) => [...current, { id, type, text }]);

    setTimeout(() => {
      setFlashes((current) => current.filter((item) => item.id !== id));
    }, 6000);

    return id;
  }, []);

  const removeFlash = useCallback((id) => {
    setFlashes((current) => current.filter((item) => item.id !== id));
  }, []);

  const setSelection = useCallback((patch) => {
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
  }, []);

  const login = useCallback(({ email, token, remember, user }) => {
    const nextAuthState = persistAuthState({ email, token, remember, user });
    setAuthState(nextAuthState);
    return nextAuthState;
  }, []);

  const signup = useCallback(({ email, token, remember, user }) => {
    const nextAuthState = persistAuthState({ email, token, remember, user });
    setAuthState(nextAuthState);
    return nextAuthState;
  }, []);

  const logout = useCallback(() => {
    const nextAuthState = clearAuthState();
    setAuthState(nextAuthState);
    return nextAuthState;
  }, []);

  // Restaura/valida la sesión de usuario al cargar la app: refresca el perfil
  // (rol, empresa) y cierra la sesión si el token caducó. Las sesiones por
  // token (env/legado) no pasan por aquí.
  useEffect(() => {
    let cancelled = false;
    const { token, isEnvToken, user, email, remember } = authState;
    if (!token || isEnvToken || user !== null) return undefined;

    // Sesión guardada sin perfil: puede ser token legado pegado a mano o un
    // token de usuario de una versión previa. Intentamos hidratar.
    authMe(token)
      .then((data) => {
        if (cancelled || !data?.user) return;
        const next = persistAuthState({ email, token, remember, user: data.user });
        setAuthState(next);
      })
      .catch((error) => {
        // 401 en /auth/me con token legado válido para admin: lo dejamos estar.
        if (!cancelled && error?.status === 401) {
          // Token de usuario caducado/ inválido → no cerramos por si es el
          // ADMIN_TOKEN legado (que /auth/me no reconoce); el resto de la API
          // decidirá. No-op consciente.
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.token]);

  const user = authState.user;
  const isSuperadmin = Boolean(
    authState.isEnvToken || user?.role === "superadmin" || (authState.token && !user)
  );

  // Rol company: fuerza SU empresa como selección activa en todo momento.
  useEffect(() => {
    if (user?.role === "company" && user.tenant_id && selectionState.tenantId !== user.tenant_id) {
      setSelection({ tenantId: user.tenant_id, vacancyId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectionState.tenantId]);

  const value = useMemo(
    () => ({
      authState,
      user,
      isSuperadmin,
      currentUserLabel: user?.full_name || authState.email || "Operador local",
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
    }),
    [
      authState,
      user,
      isSuperadmin,
      flashes,
      selectionState,
      login,
      signup,
      logout,
      pushFlash,
      removeFlash,
      setSelection,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext debe usarse dentro de AppProvider.");
  }

  return context;
}
