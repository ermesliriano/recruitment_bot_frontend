import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { probeAdminToken } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignupForm(form) {
  const errors = {};

  if (!form.email.trim()) {
    errors.email = "El email es obligatorio.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = "Introduce un email válido.";
  }

  if (!form.token.trim()) {
    errors.token = "El token es obligatorio.";
  } else if (form.token.trim().length < 8) {
    errors.token = "El token debe tener al menos 8 caracteres.";
  }

  if (!form.tokenRepeat.trim()) {
    errors.tokenRepeat = "Debes repetir el token.";
  } else if (form.tokenRepeat !== form.token) {
    errors.tokenRepeat = "Los tokens no coinciden.";
  }

  return errors;
}

export default function SignupPage() {
  const {
    isAuthenticated,
    signup,
    tenantId,
    vacancyId,
    pushFlash,
  } = useAppContext();

  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    token: "",
    tokenRepeat: "",
    remember: true,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

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

    const nextErrors = validateSignupForm(form);
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

      signup({
        email: form.email,
        token: form.token,
        remember: form.remember,
      });

      pushFlash(
        "message",
        probe.message ||
          "Acceso local creado. El backend seguirá siendo quien valida el token."
      );

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrors({
        submit: error.message || "No se pudo crear el acceso local.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="card auth-card">
        <h1 className="h1">Crear acceso local</h1>

        <div className="warning-box">
          Tu backend actual no expone un endpoint real de signup. Esta pantalla
          imita la experiencia de alta de Volunteerm, pero solo guarda email +
          token en el navegador.
        </div>

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
              autoComplete="new-password"
            />
          </label>
          {renderError("token")}

          <label className="label">
            Repite el token
            <input
              className="input"
              type="password"
              name="tokenRepeat"
              value={form.tokenRepeat}
              onChange={handleChange}
              placeholder="Repite el mismo token"
              autoComplete="new-password"
            />
          </label>
          {renderError("tokenRepeat")}

          <label className="checkbox-row">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
            />
            <span>Guardar sesión de forma persistente</span>
          </label>

          {renderError("submit")}

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear acceso local"}
            </button>
          </div>
        </form>

        <p className="muted">
          ¿Ya tienes el token? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </section>
  );
}
