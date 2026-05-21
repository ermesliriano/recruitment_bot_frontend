import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

function getNavLinkClassName({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

export default function Topbar() {
  const {
    authState,
    currentUserLabel,
    isAuthenticated,
    logout,
    pushFlash,
  } = useAppContext();

  const navigate = useNavigate();

  function handleLogout() {
    logout();
    pushFlash("message", "Sesión cerrada.");
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link className="brand" to={isAuthenticated ? "/dashboard" : "/login"}>
          Recruitment Bot
        </Link>

        <nav className="nav">
          {isAuthenticated ? (
            <>
              <NavLink
                end
                className={getNavLinkClassName}
                to="/dashboard"
              >
                Dashboard
              </NavLink>

              <NavLink className={getNavLinkClassName} to="/ranking">
                Ranking
              </NavLink>

              <NavLink className={getNavLinkClassName} to="/tenant-questions">
                Preguntas genéricas
              </NavLink>

              <NavLink className={getNavLinkClassName} to="/vacancies/new">
                Nueva vacante
              </NavLink>

              <span className="pill">
                {authState.isEnvToken ? "Token .env" : "Token guardado"}
              </span>

              <span className="pill secondary">{currentUserLabel}</span>

              <button className="linklike" type="button" onClick={handleLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <NavLink className={getNavLinkClassName} to="/login">
                Login
              </NavLink>

              <NavLink className={getNavLinkClassName} to="/signup">
                Alta local
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
