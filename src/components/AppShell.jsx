import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { listTenantsAdmin } from "../lib/api";
import FlashMessage from "./FlashMessage";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * AppShell (identidad CESAR IA Suite):
 * - Autenticado: sidebar lateral fija (colapsable en móvil con hamburguesa +
 *   overlay) + header superior compacto + área de contenido.
 * - Header: selector de empresa (solo superadmin) o etiqueta de la empresa
 *   (rol company).
 * - No autenticado (login / alta): cabecera simple reutilizando el Topbar.
 */
export default function AppShell() {
  const {
    flashes,
    removeFlash,
    isAuthenticated,
    isSuperadmin,
    user,
    tenantId,
    setSelection,
  } = useAppContext();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("suiteSidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const location = useLocation();

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("suiteSidebarCollapsed", next ? "1" : "0");
      } catch {
        // localStorage no disponible: el estado vive solo en memoria.
      }
      return next;
    });
  }

  // Cierra el menú móvil al navegar y con la tecla Escape (accesibilidad).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  // Empresas para el selector del header (solo superadmin).
  useEffect(() => {
    if (!isAuthenticated || !isSuperadmin) {
      setTenants([]);
      return undefined;
    }
    let cancelled = false;
    listTenantsAdmin()
      .then((data) => {
        if (!cancelled) setTenants(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        // Token legado contra backend aún sin endpoint: selector oculto.
        if (!cancelled) setTenants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSuperadmin]);

  function handleTenantChange(nextTenantId) {
    // Cambiar de empresa limpia la vacante activa (pertenece a otra empresa).
    setSelection({ tenantId: nextTenantId, vacancyId: "" });
  }

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <Topbar />
        <main className="container page-stack">
          <FlashMessage items={flashes} onDismiss={removeFlash} />
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className={`suite-shell${sidebarOpen ? " sidebar-open" : ""}${
        sidebarCollapsed ? " sidebar-collapsed" : ""
      }`}
    >
      <Sidebar
        onNavigate={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />

      {sidebarOpen ? (
        <button
          className="suite-overlay"
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="suite-main">
        <header className="suite-header">
          <div className="suite-header-left">
            <button
              className="suite-hamburger"
              type="button"
              aria-label="Abrir menú de navegación"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="suite-header-title">
              María · Reclutamiento Inteligente
            </span>
          </div>
          <div className="suite-header-right">
            {isSuperadmin && tenants.length > 0 ? (
              <>
                <label className="muted" htmlFor="tenant-switcher" style={{ fontSize: "0.82rem" }}>
                  Empresa
                </label>
                <select
                  id="tenant-switcher"
                  className="input"
                  style={{ width: "auto", minWidth: 180, padding: "6px 10px" }}
                  value={tenantId || ""}
                  onChange={(e) => handleTenantChange(e.target.value)}
                >
                  <option value="">Selecciona empresa...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.is_active ? "" : " (inactiva)"}
                    </option>
                  ))}
                </select>
                <button
                  className="btn small"
                  type="button"
                  onClick={() => navigate("/admin")}
                  title="Crear nueva empresa"
                >
                  + Nueva empresa
                </button>
              </>
            ) : null}
            {!isSuperadmin && user?.tenant_name ? (
              <span className="pill">{user.tenant_name}</span>
            ) : null}
          </div>
        </header>

        <main className="suite-content">
          <FlashMessage items={flashes} onDismiss={removeFlash} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
