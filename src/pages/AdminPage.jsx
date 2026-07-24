import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Table from "../components/Table";
import { useAppContext } from "../context/AppContext";
import {
  createTenant,
  createUserAdmin,
  listTenantsAdmin,
  listUsersAdmin,
} from "../lib/api";

/**
 * Administración (solo superadmin): empresas y usuarios del sistema.
 */
export default function AdminPage() {
  const { isSuperadmin, pushFlash, setSelection } = useAppContext();

  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tenantForm, setTenantForm] = useState({ name: "", slug: "" });
  const [creatingTenant, setCreatingTenant] = useState(false);

  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "company",
    tenantId: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [tenantsData, usersData] = await Promise.all([
        listTenantsAdmin(),
        listUsersAdmin(),
      ]);
      setTenants(Array.isArray(tenantsData?.items) ? tenantsData.items : []);
      setUsers(Array.isArray(usersData?.items) ? usersData.items : []);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la administración.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin, load]);

  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    if (!tenantForm.name.trim()) {
      pushFlash("error", "El nombre de la empresa es obligatorio.");
      return;
    }
    try {
      setCreatingTenant(true);
      const created = await createTenant({
        name: tenantForm.name.trim(),
        slug: tenantForm.slug.trim() || null,
      });
      pushFlash("message", `Empresa "${created.name}" creada.`);
      setTenantForm({ name: "", slug: "" });
      await load();
      // Activa la empresa recién creada para empezar a configurarla.
      setSelection({ tenantId: created.id, vacancyId: "" });
    } catch (createError) {
      pushFlash("error", createError.message || "No se pudo crear la empresa.");
    } finally {
      setCreatingTenant(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!userForm.email.trim() || userForm.password.length < 8) {
      pushFlash("error", "Email válido y contraseña de al menos 8 caracteres.");
      return;
    }
    if (userForm.role === "company" && !userForm.tenantId) {
      pushFlash("error", "Los usuarios de empresa requieren una empresa asignada.");
      return;
    }
    try {
      setCreatingUser(true);
      await createUserAdmin({
        email: userForm.email.trim(),
        password: userForm.password,
        role: userForm.role,
        tenantId: userForm.role === "company" ? userForm.tenantId : null,
        fullName: userForm.fullName.trim(),
      });
      pushFlash("message", "Usuario creado.");
      setUserForm({ fullName: "", email: "", password: "", role: "company", tenantId: "" });
      await load();
    } catch (createError) {
      pushFlash("error", createError.message || "No se pudo crear el usuario.");
    } finally {
      setCreatingUser(false);
    }
  }

  const tenantColumns = [
    { key: "name", label: "Empresa" },
    { key: "slug", label: "Identificador" },
    {
      key: "is_active",
      label: "Estado",
      cell: (row) => (
        <span className={`state-badge ${row.is_active ? "shortlist" : "pending"}`}>
          {row.is_active ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Acciones",
      cell: (row) => (
        <button
          className="btn small"
          type="button"
          onClick={() => {
            setSelection({ tenantId: row.id, vacancyId: "" });
            pushFlash("message", `Trabajando con "${row.name}".`);
          }}
        >
          Trabajar con esta empresa
        </button>
      ),
    },
  ];

  const userColumns = [
    { key: "email", label: "Email" },
    { key: "full_name", label: "Nombre", cell: (row) => row.full_name || "—" },
    {
      key: "role",
      label: "Rol",
      cell: (row) => (
        <span className={`state-badge ${row.role === "superadmin" ? "interview" : "pending"}`}>
          {row.role === "superadmin" ? "Administrador general" : "Empresa"}
        </span>
      ),
    },
    { key: "tenant_name", label: "Empresa", cell: (row) => row.tenant_name || "—" },
    {
      key: "is_active",
      label: "Estado",
      cell: (row) => (row.is_active ? "Activo" : "Inactivo"),
    },
  ];

  return (
    <>
      <section className="card">
        <div className="breadcrumb">Administración</div>
        <h1 className="h1">Administración del sistema</h1>
        <p className="muted">
          Gestiona las empresas de la plataforma y los usuarios que acceden al
          panel. Solo visible para administradores generales.
        </p>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="card">
        <h2 className="h2">Empresas</h2>
        <form className="row" onSubmit={handleCreateTenant} style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label className="field-label" htmlFor="ta-name">Nombre de la nueva empresa</label>
            <input
              id="ta-name"
              className="input"
              type="text"
              value={tenantForm.name}
              placeholder="Ej. Transportes Caribe S.R.L."
              onChange={(e) => setTenantForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label className="field-label" htmlFor="ta-slug">Identificador (opcional)</label>
            <input
              id="ta-slug"
              className="input"
              type="text"
              value={tenantForm.slug}
              placeholder="se genera automáticamente"
              onChange={(e) => setTenantForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <button className="btn primary" type="submit" disabled={creatingTenant}>
            {creatingTenant ? "Creando..." : "Crear empresa"}
          </button>
        </form>

        <div style={{ marginTop: 14 }}>
          <Table
            columns={tenantColumns}
            rows={tenants}
            loading={loading}
            emptyText="No hay empresas registradas."
          />
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Usuarios</h2>
        <form onSubmit={handleCreateUser}>
          <div className="detail-grid">
            <div className="field">
              <label className="field-label" htmlFor="ua-name">Nombre completo</label>
              <input
                id="ua-name"
                className="input"
                type="text"
                value={userForm.fullName}
                onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ua-email">Email</label>
              <input
                id="ua-email"
                className="input"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ua-pass">Contraseña (mín. 8)</label>
              <input
                id="ua-pass"
                className="input"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ua-role">Rol</label>
              <select
                id="ua-role"
                className="input"
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="company">Empresa (solo su empresa)</option>
                <option value="superadmin">Administrador general (todo)</option>
              </select>
            </div>
            {userForm.role === "company" ? (
              <div className="field">
                <label className="field-label" htmlFor="ua-tenant">Empresa asignada</label>
                <select
                  id="ua-tenant"
                  className="input"
                  value={userForm.tenantId}
                  onChange={(e) => setUserForm((f) => ({ ...f, tenantId: e.target.value }))}
                >
                  <option value="">Selecciona una empresa...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={creatingUser}>
              {creatingUser ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 14 }}>
          <Table
            columns={userColumns}
            rows={users}
            loading={loading}
            emptyText="No hay usuarios registrados."
          />
        </div>
      </section>
    </>
  );
}
