import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { authBootstrap, authBootstrapStatus } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta del ADMINISTRADOR INICIAL (bootstrap).
 * Solo funciona mientras no exista ningún usuario; después, los usuarios se
 * crean desde Administración (solo superadmin).
 */
export default function SignupPage() {
  const { isAuthenticated, login, pushFlash } = useAppContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("checking"); // checking | open | closed
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    password2: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authBootstrapStatus()
      .then((data) => {
        if (!cancelled) setStatus(data?.needs_bootstrap ? "open" : "closed");
      })
      .catch(() => {
        if (!cancelled) setStatus("closed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Introduce un email válido.";
    if ((form.password || "").length < 8) next.password = "Mínimo 8 caracteres.";
    if (form.password !== form.password2) next.password2 = "Las contraseñas no coinciden.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSubmitting(true);
      const data = await authBootstrap({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
      });
      login({
        email: data.user?.email || form.email.trim(),
        token: data.token,
        remember: true,
        user: data.user || null,
      });
      pushFlash("message", "Administrador inicial creado. ¡Bienvenido!");
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setErrors({ submit: submitError.message || "No se pudo crear el administrador." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card auth-card">
      <h1 className="h1">Crear administrador inicial</h1>

      {status === "checking" ? <p className="muted">Comprobando...</p> : null}

      {status === "closed" ? (
        <>
          <p className="muted">
            El sistema ya tiene usuarios. Los nuevos usuarios los crea un
            administrador desde la sección Administración.
          </p>
          <Link className="btn" to="/login">Ir a iniciar sesión</Link>
        </>
      ) : null}

      {status === "open" ? (
        <>
          <p className="muted">
            Todavía no existe ningún usuario: crea la cuenta de administrador
            general (acceso total a todas las empresas).
          </p>

          {errors.submit ? <div className="error-box">{errors.submit}</div> : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="bs-name">Nombre completo</label>
              <input
                id="bs-name"
                className="input"
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="bs-email">Email</label>
              <input
                id="bs-email"
                className={`input${errors.email ? " invalid" : ""}`}
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="username"
              />
              {errors.email ? <div className="field-error-text">{errors.email}</div> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="bs-pass">Contraseña</label>
              <input
                id="bs-pass"
                className={`input${errors.password ? " invalid" : ""}`}
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {errors.password ? (
                <div className="field-error-text">{errors.password}</div>
              ) : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="bs-pass2">Repite la contraseña</label>
              <input
                id="bs-pass2"
                className={`input${errors.password2 ? " invalid" : ""}`}
                type="password"
                name="password2"
                value={form.password2}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {errors.password2 ? (
                <div className="field-error-text">{errors.password2}</div>
              ) : null}
            </div>

            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={submitting}>
                {submitting ? "Creando..." : "Crear administrador"}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  );
}
