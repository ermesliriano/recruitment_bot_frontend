import { NavLink, useNavigate } from "react-router-dom";
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
  { to: "/ranking", label: "Ranking" },
  { to: "/cv-imports", label: "Carga de CV" },
  { to: "/tenant-questions", label: "Preguntas" },
  { to: "/conversations", label: "Conversaciones" },
  { to: "/company-info", label: "Empresa" },
  { to: "/conversation-flow", label: "Configuración" },
];

function navClassName({ isActive }) {
  return isActive ? "suite-nav-link active" : "suite-nav-link";
}

export default function Sidebar({ onNavigate }) {
  const { authState, currentUserLabel, logout, pushFlash } = useAppContext();
  const navigate = useNavigate();

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
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navClassName}
            onClick={() => onNavigate?.()}
          >
            {item.label}
          </NavLink>
        ))}
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
