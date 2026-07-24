import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import MariaAvatar from "./MariaAvatar";

/**
 * Sidebar principal de la aplicación (identidad CESAR IA Suite).
 *
 * Soporta modo contraído (solo iconos) en escritorio: el estado vive en
 * AppShell (persistido en localStorage) y aquí se reciben `collapsed` y
 * `onToggleCollapse`. En móvil el menú deslizante siempre se muestra completo.
 *
 * Nota de mapa de navegación (Fase 1): "Vacantes" y "Candidatos" como vistas
 * independientes están planificadas para la Fase 2; hoy el listado de vacantes
 * vive en el Dashboard y los candidatos en el Ranking.
 */

function Icon({ children }) {
  return (
    <svg
      className="suite-nav-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  ranking: (
    <Icon>
      <path d="M5 20v-6" />
      <path d="M12 20V6" />
      <path d="M19 20v-9" />
      <path d="M3.5 20h17" />
    </Icon>
  ),
  cv: (
    <Icon>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 20h14" />
    </Icon>
  ),
  questions: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1 .9-1 1.6" />
      <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  ),
  conversations: (
    <Icon>
      <path d="M4.5 5.5h15v10.5H9l-4.5 3.8z" />
    </Icon>
  ),
  company: (
    <Icon>
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M10 7h1.5M13.5 7H15M10 11h1.5M13.5 11H15M10 15h1.5M13.5 15H15" />
      <path d="M4 21h16" />
    </Icon>
  ),
  settings: (
    <Icon>
      <path d="M4.5 8h15" />
      <path d="M4.5 16h15" />
      <circle cx="9.5" cy="8" r="2" fill="var(--graphite)" />
      <circle cx="14.5" cy="16" r="2" fill="var(--graphite)" />
    </Icon>
  ),
  admin: (
    <Icon>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M16.5 5.5l1 .3a1 1 0 0 1 .6 1.4l-.4.9.7.8 1-.2a1 1 0 0 1 1.1 1l-.1 1-.9.5v1l.9.5a1 1 0 0 1 .1 1l-1.1 1-1-.2-.7.8.4.9" />
    </Icon>
  ),
};

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", end: true },
  // El detalle de aplicación (/applications/:id) depende del ranking, así que
  // mantiene resaltada la opción Ranking en el menú.
  { to: "/ranking", label: "Ranking", icon: "ranking", alsoActiveOn: ["/applications"] },
  { to: "/cv-imports", label: "Carga de CV", icon: "cv" },
  { to: "/tenant-questions", label: "Preguntas", icon: "questions" },
  { to: "/conversations", label: "Conversaciones", icon: "conversations" },
  { to: "/company-info", label: "Empresa", icon: "company" },
  // Solo administradores generales:
  { to: "/conversation-flow", label: "Configuración", icon: "settings", superadminOnly: true },
  { to: "/admin", label: "Administración", icon: "admin", superadminOnly: true },
];

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }) {
  const { currentUserLabel, isSuperadmin, logout, pushFlash } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.superadminOnly || isSuperadmin
  );

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
        <span className="suite-brand-parent suite-collapsible">CESAR IA Suite</span>
        <NavLink
          className="suite-brand-module"
          to="/dashboard"
          onClick={() => onNavigate?.()}
          title={collapsed ? "María · Reclutamiento Inteligente" : undefined}
        >
          <MariaAvatar size={40} />
          <span className="suite-collapsible">
            <span className="suite-brand-name">María</span>
            <span className="suite-brand-descriptor" style={{ display: "block" }}>
              Reclutamiento Inteligente
            </span>
          </span>
        </NavLink>
      </div>

      {onToggleCollapse ? (
        <button
          className="suite-collapse-btn"
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          aria-expanded={!collapsed}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={collapsed ? { transform: "scaleX(-1)" } : undefined}
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>
      ) : null}

      <div className="suite-sidebar-cta">
        <button
          className="btn primary"
          type="button"
          onClick={handleCreateVacancy}
          title={collapsed ? "Crear vacante" : undefined}
          aria-label="Crear vacante"
        >
          {collapsed ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          ) : (
            "Crear vacante"
          )}
        </button>
      </div>

      <nav className="suite-nav">
        {visibleItems.map((item) => {
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
              title={collapsed ? item.label : undefined}
            >
              {ICONS[item.icon]}
              <span className="suite-nav-label suite-collapsible">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="suite-sidebar-footer">
        <span className="suite-collapsible">{currentUserLabel}</span>
        <button
          className="linklike"
          type="button"
          onClick={handleLogout}
          title={collapsed ? "Salir" : undefined}
          aria-label="Cerrar sesión"
        >
          {collapsed ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 4h5v16h-5" />
              <path d="M10 12H3m0 0l3-3m-3 3l3 3" />
            </svg>
          ) : (
            "Salir"
          )}
        </button>
      </div>
    </aside>
  );
}
