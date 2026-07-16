import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import MariaAvatar from "./MariaAvatar";

/**
 * Sidebar principal de la aplicación (identidad CESAR IA Suite).
 *
 * Nota de mapa de navegación (Fase 1): "Vacantes" y "Candidatos" como vistas
 * independientes están planificadas para la Fase 2; hoy el listado de vacantes
 * vive en el Dashboard y los candidatos en el Ranking.
 */
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", end: true },
  // El detalle de aplicación (/applications/:id) depende del ranking, así que
  // mantiene resaltada la opción Ranking en el menú.
  { to: "/ranking", label: "Ranking", alsoActiveOn: ["/applications"] },
  { to: "/cv-imports", label: "Carga de CV" },
  { to: "/tenant-questions", label: "Preguntas" },
  { to: "/conversations", label: "Conversaciones" },
  { to: "/company-info", label: "Empresa" },
  { to: "/conversation-flow", label: "Configuración" },
];

export default function Sidebar({ onNavigate }) {
  const { authState, currentUserLabel, logout, pushFlash } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    pushFlash("message", "Sesión cerrada.");
    navigate("/login", { replace: true });
  }

  function handleCreateVacancy() {
    onNavigate?.();
    navigate("/vacancies/new");
  }

  return (
    <aside className="suite-sidebar" aria-label="Navegación principal">
      <div className="suite-brand">
        <span className="suite-brand-parent">CESAR IA Suite</span>
        <NavLink
          className="suite-brand-module"
          to="/dashboard"
          onClick={() => onNavigate?.()}
        >
          <MariaAvatar size={40} />
          <span>
            <span className="suite-brand-name">María</span>
            <span className="suite-brand-descriptor" style={{ display: "block" }}>
              Reclutamiento Inteligente
            </span>
          </span>
        </NavLink>
      </div>

      <div className="suite-sidebar-cta">
        <button className="btn primary" type="button" onClick={handleCreateVacancy}>
          Crear vacante
        </button>
      </div>

      <nav className="suite-nav">
        {NAV_ITEMS.map((item) => {
          const forceActive = (item.alsoActiveOn || []).some((prefix) =>
            location.pathname.startsWith(prefix)
          );
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive || forceActive ? "suite-nav-link active" : "suite-nav-link"
              }
              onClick={() => onNavigate?.()}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="suite-sidebar-footer">
        <span>{currentUserLabel}</span>
        <span className="pill">
          {authState.isEnvToken ? "Token .env" : "Token guardado"}
        </span>
        <button className="linklike" type="button" onClick={handleLogout}>
          Salir
        </button>
      </div>
    </aside>
  );
}
