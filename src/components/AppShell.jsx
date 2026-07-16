import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import FlashMessage from "./FlashMessage";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/**
 * AppShell (identidad CESAR IA Suite):
 * - Autenticado: sidebar lateral fija (colapsable en móvil con hamburguesa +
 *   overlay) + header superior compacto + área de contenido.
 * - No autenticado (login / alta): cabecera simple reutilizando el Topbar.
 */
export default function AppShell() {
  const { flashes, removeFlash, isAuthenticated } = useAppContext();
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
          <div className="suite-header-right" />
        </header>

        <main className="suite-content">
          <FlashMessage items={flashes} onDismiss={removeFlash} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
