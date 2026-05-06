import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { probeAdminToken } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLoginForm(form) {
  const errors = {};

  if (!form.email.trim()) {
    errors.email = "El email es obligatorio.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = "Introduce un email válido.";
  }

  if (!form.token.trim()) {
    errors.token = "El token de administrador es obligatorio.";
  } else if (form.token.trim().length < 8) {
    errors.token = "El token debe tener al menos 8 caracteres.";
  }

  return errors;
}

export default function LoginPage() {
  const {
    isAuthenticated,
    login,
    tenantId,
    vacancyId,
    pushFlash,
  } = useAppContext();

  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    token: "",
    remember: true,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

  function renderError(name) {
    return errors[name] ? <div className="field-error">{errors[name]}</div> : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateLoginForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);

      const probe = await probeAdminToken({
        tenantId,
        vacancyId,
        token: form.token,
      });

      login({
        email: form.email,
        token: form.token,
        remember: form.remember,
      });

      pushFlash("message", probe.message || "Sesión iniciada correctamente.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrors({
        submit: error.message || "No se pudo iniciar sesión.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="card auth-card">
        <h1 className="h1">Iniciar sesión</h1>

        <p className="muted">
          Esta pantalla replica el patrón de Volunteerm, pero adaptado a un
          backend con Bearer token: el frontend guarda el token y el backend lo
          valida cuando se invocan rutas protegidas.
        </p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="label">
            Email
            <input
              className="input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              autoComplete="username"
            />
          </label>
          {renderError("email")}

          <label className="label">
            Token de administrador
            <input
              className="input"
              type="password"
              name="token"
              value={form.token}
              onChange={handleChange}
              placeholder="Pega aquí tu Bearer token"
              autoComplete="current-password"
            />
          </label>
          {renderError("token")}

          <label className="checkbox-row">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
            />
            <span>Recordarme en este navegador</span>
          </label>

          <p className="help-text">
            Si ya has definido `tenant_id` y `vacancy_id`, el login intentará
            verificar el token contra el endpoint protegido de ranking antes de
            redirigirte.
          </p>

          {renderError("submit")}

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Validando..." : "Entrar"}
            </button>
          </div>
        </form>

        <p className="muted">
          ¿No tienes sesión local todavía? <Link to="/signup">Crear acceso local</Link>
        </p>
      </div>
    </section>
  );
}
