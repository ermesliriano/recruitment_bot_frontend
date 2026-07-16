import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Table from "../components/Table";
import VacancySelector from "../components/VacancySelector";
import { useAppContext } from "../context/AppContext";
import { getRanking } from "../lib/api";
import { formatOrigin } from "../lib/labels";

/**
 * Ranking de candidaturas.
 * Filtros, ordenamiento y presentación son 100% de cliente: la lógica de
 * ranking del backend (orden por clasificación + score) no se altera.
 */

const STATE_LABELS = {
  shortlist: { label: "Preseleccionado", tone: "shortlist" },
  interview: { label: "Entrevista", tone: "interview" },
  review: { label: "En revisión", tone: "review" },
  reject: { label: "Descartado", tone: "reject" },
  rejected: { label: "Descartado", tone: "reject" },
  hired: { label: "Contratado", tone: "shortlist" },
  pending: { label: "Pendiente", tone: "pending" },
};

const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
};

const SORTS = [
  { value: "ranking", label: "Ranking (por defecto)" },
  { value: "score_desc", label: "Mayor puntaje" },
  { value: "score_asc", label: "Menor puntaje" },
  { value: "date_desc", label: "Aplicación más reciente" },
  { value: "date_asc", label: "Aplicación más antigua" },
  { value: "name_asc", label: "Nombre A–Z" },
];

const EMPTY_FILTERS = {
  q: "",
  estado: "",
  origen: "",
  canal: "",
  minScore: "",
  sort: "ranking",
};

function stateBadge(estado) {
  const info = STATE_LABELS[(estado || "").toLowerCase()] || {
    label: estado || "—",
    tone: "pending",
  };
  return <span className={`state-badge ${info.tone}`}>{info.label}</span>;
}

function channelLabel(channel) {
  return CHANNEL_LABELS[(channel || "").toLowerCase()] || channel || "—";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function pendingSince(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

function affinity(scoreTotal) {
  const value = Number(scoreTotal) || 0;
  if (value >= 80) return { cls: "affinity-high", label: "Alta afinidad" };
  if (value >= 60) return { cls: "affinity-mid", label: "Afinidad media" };
  return { cls: "affinity-low", label: "Afinidad baja" };
}

function formatPair(value, max) {
  if (value === null || value === undefined) return "—";
  const v = Math.round(Number(value) * 10) / 10;
  if (max === null || max === undefined) return String(v);
  return `${v} / ${Math.round(Number(max))}`;
}

function normalize(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function RankingPage() {
  const { tenantId, vacancyId, setSelection } = useAppContext();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [incomplete, setIncomplete] = useState([]);
  const [incompleteTotal, setIncompleteTotal] = useState(0);
  const [budget, setBudget] = useState({ cv: null, questions: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const requestIdRef = useRef(0);

  // URL -> contexto (solo depende de searchParams; ver nota histórica del ping-pong).
  useEffect(() => {
    const queryVacancyId = String(searchParams.get("vacancyId") || "").trim();
    if (queryVacancyId && queryVacancyId !== vacancyId) {
      setSelection({ vacancyId: queryVacancyId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSelection]);

  useEffect(() => {
    if (!vacancyId) return;
    const current = String(searchParams.get("vacancyId") || "").trim();
    if (current === vacancyId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("vacancyId", vacancyId);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, vacancyId]);

  const loadRanking = useCallback(async () => {
    if (!tenantId || !vacancyId) {
      setRows([]);
      setTotal(0);
      setIncomplete([]);
      setIncompleteTotal(0);
      setBudget({ cv: null, questions: null });
      setError("");
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError("");
      const data = await getRanking(tenantId, vacancyId);
      if (requestId !== requestIdRef.current) return;

      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0));
      setIncomplete(Array.isArray(data?.incomplete) ? data.incomplete : []);
      setIncompleteTotal(
        data?.incomplete_total ?? (Array.isArray(data?.incomplete) ? data.incomplete.length : 0)
      );
      setBudget({
        cv: data?.cv_max_score ?? null,
        questions: data?.questions_max_score ?? null,
      });
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setRows([]);
      setTotal(0);
      setIncomplete([]);
      setIncompleteTotal(0);
      setError(loadError.message || "No se pudo cargar el ranking.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [tenantId, vacancyId]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  // ── Filtros y orden (cliente) ──────────────────────────────────────────
  const positions = useMemo(() => {
    const map = new Map();
    rows.forEach((row, index) => map.set(row.application_id, index + 1));
    return map;
  }, [rows]);

  const filterOptions = useMemo(() => {
    const all = [...rows, ...incomplete];
    return {
      estados: [...new Set(rows.map((r) => (r.estado || "").toLowerCase()).filter(Boolean))],
      origenes: [...new Set(all.map((r) => r.origin).filter(Boolean))],
      canales: [...new Set(all.map((r) => (r.channel || "").toLowerCase()).filter(Boolean))],
    };
  }, [rows, incomplete]);

  const applyCommonFilters = useCallback(
    (list) => {
      const q = normalize(filters.q);
      return list.filter((row) => {
        if (q) {
          const haystack = normalize(`${row.nombre || ""} ${row.telefono || ""}`);
          if (!haystack.includes(q)) return false;
        }
        if (filters.origen && row.origin !== filters.origen) return false;
        if (filters.canal && (row.channel || "").toLowerCase() !== filters.canal) return false;
        return true;
      });
    },
    [filters]
  );

  const filteredRows = useMemo(() => {
    let list = applyCommonFilters(rows);
    if (filters.estado) {
      list = list.filter((r) => (r.estado || "").toLowerCase() === filters.estado);
    }
    if (filters.minScore !== "" && !Number.isNaN(Number(filters.minScore))) {
      list = list.filter((r) => Number(r.score_total || 0) >= Number(filters.minScore));
    }
    const sorted = [...list];
    switch (filters.sort) {
      case "score_desc":
        sorted.sort((a, b) => Number(b.score_total || 0) - Number(a.score_total || 0));
        break;
      case "score_asc":
        sorted.sort((a, b) => Number(a.score_total || 0) - Number(b.score_total || 0));
        break;
      case "date_desc":
        sorted.sort((a, b) => new Date(b.applied_at || 0) - new Date(a.applied_at || 0));
        break;
      case "date_asc":
        sorted.sort((a, b) => new Date(a.applied_at || 0) - new Date(b.applied_at || 0));
        break;
      case "name_asc":
        sorted.sort((a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre)));
        break;
      default:
        break; // "ranking": orden del backend
    }
    return sorted;
  }, [rows, filters, applyCommonFilters]);

  const filteredIncomplete = useMemo(
    () => applyCommonFilters(incomplete),
    [incomplete, applyCommonFilters]
  );

  const filtersActive = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS),
    [filters]
  );

  const lastApplication = useMemo(() => {
    const dates = [...rows, ...incomplete]
      .map((r) => r.applied_at)
      .filter(Boolean)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [rows, incomplete]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  // ── Celdas ─────────────────────────────────────────────────────────────
  const renderNameCell = (row) => (
    <button
      type="button"
      onClick={() => navigate(`/applications/${row.application_id}`)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "var(--primary-strong)",
        cursor: "pointer",
        textDecoration: "underline",
        font: "inherit",
        textAlign: "left",
      }}
    >
      {row.nombre || "—"}
      <span className="cell-sub">{row.vacante}</span>
    </button>
  );

  const renderDateCell = (row) => (
    <span>
      {formatDate(row.applied_at)}
      <span className="cell-sub">{formatTime(row.applied_at)}</span>
    </span>
  );

  const renderTotalCell = (row) => {
    const value = Number(row.score_total || 0);
    const info = affinity(value);
    return (
      <div
        className={`score-total-cell ${info.cls}`}
        title="El puntaje combina respuestas, CV y criterios configurados para la vacante."
      >
        <span className="score-total-number">{formatPair(row.score_total, 100)}</span>
        <div className="score-total-track">
          <div
            className="score-total-fill"
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
        <span className="affinity-label">{info.label}</span>
      </div>
    );
  };

  const columns = [
    {
      key: "position",
      label: "#",
      cell: (row) => <span className="cell-center">{positions.get(row.application_id) ?? "—"}</span>,
    },
    { key: "nombre", label: "Nombre", cell: renderNameCell },
    { key: "telefono", label: "Teléfono" },
    { key: "applied_at", label: "Fecha de aplicación", cell: renderDateCell },
    { key: "origin", label: "Origen", cell: (row) => formatOrigin(row.origin) },
    { key: "channel", label: "Canal", cell: (row) => channelLabel(row.channel) },
    {
      key: "score_rules",
      label: "Score preguntas",
      cell: (row) => <span className="cell-right">{formatPair(row.score_rules, budget.questions)}</span>,
    },
    {
      key: "score_cv",
      label: "Score CV",
      cell: (row) => <span className="cell-right">{formatPair(row.score_cv, budget.cv)}</span>,
    },
    { key: "score_total", label: "Score total", cell: renderTotalCell },
    {
      key: "estado",
      label: "Estado",
      cell: (row) => <span className="cell-center">{stateBadge(row.estado)}</span>,
    },
    {
      key: "actions",
      label: "Acciones",
      cell: (row) => (
        <button
          className="btn small"
          type="button"
          onClick={() => navigate(`/applications/${row.application_id}`)}
        >
          Ver detalle
        </button>
      ),
    },
  ];

  const incompleteColumns = [
    { key: "nombre", label: "Nombre", cell: renderNameCell },
    { key: "telefono", label: "Teléfono" },
    { key: "applied_at", label: "Fecha de aplicación", cell: renderDateCell },
    { key: "origin", label: "Origen", cell: (row) => formatOrigin(row.origin) },
    { key: "channel", label: "Canal", cell: (row) => channelLabel(row.channel) },
    {
      key: "stage",
      label: "Punto del flujo",
      cell: (row) => <span className="q-badge stage">⚠ {row.stage || "—"}</span>,
    },
    {
      key: "pending_time",
      label: "Tiempo pendiente",
      cell: (row) => pendingSince(row.applied_at),
    },
    {
      key: "actions",
      label: "Acciones",
      cell: (row) => (
        <span className="row" style={{ gap: 6 }}>
          <button
            className="btn small"
            type="button"
            onClick={() => navigate("/conversations")}
          >
            Contactar
          </button>
          <button
            className="btn small"
            type="button"
            onClick={() => navigate(`/applications/${row.application_id}`)}
          >
            Ver detalle
          </button>
        </span>
      ),
    },
  ];

  // ── Cards móviles ──────────────────────────────────────────────────────
  function MobileCards({ list, pending }) {
    if (list.length === 0) return null;
    return (
      <div className="rank-cards">
        {list.map((row) => (
          <div className="rank-card" key={row.application_id}>
            <div className="rank-card-top">
              <div>
                {renderNameCell(row)}
                <div className="cell-sub" style={{ marginTop: 4 }}>
                  {formatDate(row.applied_at)} · {channelLabel(row.channel)}
                </div>
              </div>
              {pending ? (
                <span className="q-badge stage">⚠ {row.stage || "—"}</span>
              ) : (
                <div style={{ textAlign: "right" }}>
                  {renderTotalCell(row)}
                  <div style={{ marginTop: 4 }}>{stateBadge(row.estado)}</div>
                </div>
              )}
            </div>
            <details>
              <summary>Más detalles</summary>
              <div className="rank-card-detail">
                <span>Teléfono: {row.telefono || "—"}</span>
                <span>Origen: {formatOrigin(row.origin)}</span>
                {!pending ? (
                  <>
                    <span>Score preguntas: {formatPair(row.score_rules, budget.questions)}</span>
                    <span>Score CV: {formatPair(row.score_cv, budget.cv)}</span>
                  </>
                ) : (
                  <span>Tiempo pendiente: {pendingSince(row.applied_at)}</span>
                )}
                <span className="row" style={{ gap: 6, marginTop: 4 }}>
                  {pending ? (
                    <button className="btn small" type="button" onClick={() => navigate("/conversations")}>
                      Contactar
                    </button>
                  ) : null}
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => navigate(`/applications/${row.application_id}`)}
                  >
                    Ver detalle
                  </button>
                </span>
              </div>
            </details>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <section className="card">
        <div className="breadcrumb">Reclutamiento / Ranking</div>
        <h1 className="h1">Ranking de candidaturas</h1>
        <p className="muted">
          Consulta, compara y prioriza candidaturas según su evaluación, estado y
          fecha de aplicación.
        </p>
      </section>

      <VacancySelector
        title="Contexto del ranking"
        description="Busca la vacante por nombre o código para cargar su ranking."
      />

      {tenantId && vacancyId && !loading && !error ? (
        <p className="muted" style={{ margin: "-6px 4px 0" }}>
          {total} evaluadas · {incompleteTotal} pendientes
          {lastApplication ? ` · última aplicación ${formatDate(lastApplication)}` : ""}
        </p>
      ) : null}

      {!tenantId || !vacancyId ? (
        <div className="warning-box">
          Selecciona una vacante para consultar el ranking.
        </div>
      ) : null}

      {error ? <div className="error-box">{error}</div> : null}

      {tenantId && vacancyId ? (
        <>
          <section className="card compact-card">
            <div className="filters-bar">
              <label className="label">
                Buscar candidato
                <input
                  className="input"
                  type="search"
                  placeholder="Nombre o teléfono..."
                  value={filters.q}
                  onChange={(e) => setFilter("q", e.target.value)}
                />
              </label>
              <label className="label">
                Estado
                <select className="input" value={filters.estado} onChange={(e) => setFilter("estado", e.target.value)}>
                  <option value="">Todos</option>
                  {filterOptions.estados.map((estado) => (
                    <option key={estado} value={estado}>
                      {STATE_LABELS[estado]?.label || estado}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Origen
                <select className="input" value={filters.origen} onChange={(e) => setFilter("origen", e.target.value)}>
                  <option value="">Todos</option>
                  {filterOptions.origenes.map((origen) => (
                    <option key={origen} value={origen}>{formatOrigin(origen)}</option>
                  ))}
                </select>
              </label>
              <label className="label">
                Canal
                <select className="input" value={filters.canal} onChange={(e) => setFilter("canal", e.target.value)}>
                  <option value="">Todos</option>
                  {filterOptions.canales.map((canal) => (
                    <option key={canal} value={canal}>{channelLabel(canal)}</option>
                  ))}
                </select>
              </label>
              <label className="label">
                Puntaje mínimo
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={filters.minScore}
                  onChange={(e) => setFilter("minScore", e.target.value)}
                />
              </label>
              <label className="label">
                Ordenar por
                <select className="input" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {filtersActive ? (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn small" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpiar filtros
                </button>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="row-space">
              <div>
                <h2 className="h2">
                  Candidaturas evaluadas{" "}
                  <span className="state-badge shortlist">{total} completas</span>
                </h2>
                <p className="muted">
                  Candidaturas que completaron el proceso y cuentan con puntuación final.
                </p>
              </div>
              <button className="btn" type="button" onClick={loadRanking} aria-label="Recargar ranking">
                ⟳
              </button>
            </div>

            {!loading && rows.length > 0 && filteredRows.length === 0 ? (
              <div className="warning-box">No encontramos candidatos con estos filtros.</div>
            ) : null}

            <div className="rank-table-wrap">
              <Table
                columns={columns}
                rows={filteredRows}
                loading={loading}
                emptyText="No hay candidaturas evaluadas para esta vacante."
              />
            </div>
            <MobileCards list={filteredRows} pending={false} />
          </section>

          {incomplete.length > 0 ? (
            <section className="card pending-section">
              <h2 className="h2">
                Candidaturas pendientes de completar{" "}
                <span className="state-badge review">
                  {incompleteTotal} {incompleteTotal === 1 ? "pendiente" : "pendientes"}
                </span>
              </h2>
              <p className="muted">
                Estas personas todavía no han finalizado el flujo y aún no tienen
                puntuación definitiva.
              </p>

              {filteredIncomplete.length === 0 ? (
                <div className="warning-box">No encontramos candidatos con estos filtros.</div>
              ) : null}

              <div className="rank-table-wrap">
                <Table
                  columns={incompleteColumns}
                  rows={filteredIncomplete}
                  emptyText="No hay candidaturas pendientes para esta vacante."
                />
              </div>
              <MobileCards list={filteredIncomplete} pending />
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
