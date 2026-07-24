import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { authBootstrapStatus, authLogin, probeAdminToken } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Acceso al panel.
 * - Modo "user" (principal): email + contraseña contra /auth/login (roles).
 * - Modo "token" (secundario, legado): email + ADMIN_TOKEN para integraciones
 *   o recuperación.
 * Si aún no existe ningún usuario, ofrece crear el administrador inicial.
 */
export default function LoginPage() {
  const { isAuthenticated, login, pushFlash } = useAppContext();

  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState("user"); // user | token
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    token: "",
    remember: true,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authBootstrapStatus()
      .then((data) => {
        if (!cancelled) setNeedsBootstrap(Boolean(data?.needs_bootstrap));
      })
      .catch(() => {
        // Backend antiguo sin /auth: se ignora (queda el modo token).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const from = location.state?.from;
  const redirectTo = from
    ? `${from.pathname || ""}${from.search || ""}${from.hash || ""}`
    : "/dashboard";

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function validate() {
    const next = {};
    if (!form.email.trim()) {
      next.email = "El email es obligatorio.";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      next.email = "Introduce un email válido.";
    }
    if (mode === "user") {
      if (!form.password) next.password = "La contraseña es obligatoria.";
    } else if (!form.token.trim() || form.token.trim().length < 8) {
      next.token = "El token debe tener al menos 8 caracteres.";
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);

      if (mode === "user") {
        const data = await authLogin({
          email: form.email.trim(),
          password: form.password,
        });
        login({
          email: data.user?.email || form.email.trim(),
          token: data.token,
          remember: form.remember,
          user: data.user || null,
        });
        pushFlash("message", `Bienvenido, ${data.user?.full_name || data.user?.email || ""}`.trim());
      } else {
        await probeAdminToken({ token: form.token.trim() });
        login({
          email: form.email.trim(),
          token: form.token.trim(),
          remember: form.remember,
          user: null,
        });
        pushFlash("message", "Sesión iniciada con token de administrador.");
      }

      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      const message =
        submitError?.status === 401
          ? mode === "user"
            ? "Credenciales incorrectas."
            : "El token no es válido."
          : submitError.message || "No se pudo iniciar sesión.";
      setErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card auth-card">
      <h1 className="h1">Iniciar sesión</h1>
      <p className="muted">
        Accede al panel de María · Reclutamiento Inteligente.
      </p>

      {needsBootstrap ? (
        <div className="notice" style={{ borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          Todavía no existe ningún usuario.{" "}
          <Link to="/signup">Crea el administrador inicial</Link> para estrenar
          el sistema de cuentas.
        </div>
      ) : null}

      {errors.submit ? <div className="error-box">{errors.submit}</div> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className={`input${errors.email ? " invalid" : ""}`}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="username"
          />
          {errors.email ? <div className="field-error-text">{errors.email}</div> : null}
        </div>

        {mode === "user" ? (
          <div className="field">
            <label className="field-label" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className={`input${errors.password ? " invalid" : ""}`}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
            {errors.password ? (
              <div className="field-error-text">{errors.password}</div>
            ) : null}
          </div>
        ) : (
          <div className="field">
            <label className="field-label" htmlFor="login-token">Token de administrador</label>
            <input
              id="login-token"
              className={`input${errors.token ? " invalid" : ""}`}
              type="password"
              name="token"
              value={form.token}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.token ? <div className="field-error-text">{errors.token}</div> : null}
          </div>
        )}

        <div className="field">
          <label className="field-label" style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
            />{" "}
            Mantener la sesión iniciada en este equipo
          </label>
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Accediendo..." : "Entrar"}
          </button>
        </div>
      </form>

      <p className="muted" style={{ marginTop: 14, fontSize: "0.85rem" }}>
        {mode === "user" ? (
          <button className="linklike" type="button" onClick={() => setMode("token")}>
            Acceso técnico con token de administrador
          </button>
        ) : (
          <button className="linklike" type="button" onClick={() => setMode("user")}>
            Volver al acceso con usuario y contraseña
          </button>
        )}
      </p>
    </section>
  );
}
