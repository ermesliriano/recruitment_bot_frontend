import { getAuthToken } from "./auth";

// Ojo: VITE_ADMIN_TOKEN es útil para demo, pero no es un secreto real.
// Si existe, quedará embebido en el bundle del frontend.

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

const ENV_ADMIN_TOKEN = String(import.meta.env.VITE_ADMIN_TOKEN || "").trim();

console.log("[ENV DEBUG]", {
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_TENANT_ID: import.meta.env.VITE_TENANT_ID,
  VITE_VACANCY_ID: import.meta.env.VITE_VACANCY_ID,
  hasAdminToken: Boolean(import.meta.env.VITE_ADMIN_TOKEN),
});

export class ApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function getNormalizedBaseUrl() {
  if (!API_BASE_URL) {
    throw new ApiError(
      "Falta VITE_API_BASE_URL en el entorno del frontend."
    );
  }

  return `${API_BASE_URL}/`;
}

function buildUrl(path, query = {}) {
  const normalizedPath = String(path || "").replace(/^\//, "");
  const url = new URL(normalizedPath, getNormalizedBaseUrl());

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const parsedValue = String(value).trim();
    if (parsedValue) {
      url.searchParams.set(key, parsedValue);
    }
  });

  return url.toString();
}

function extractErrorMessage(body, response) {
  if (!body) {
    return response.statusText || `Error HTTP ${response.status}`;
  }

  if (typeof body === "string") {
    return body;
  }

  if (Array.isArray(body.detail)) {
    return body.detail.map((item) => item.msg || JSON.stringify(item)).join(" | ");
  }

  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (typeof body.error === "string") {
    return body.error;
  }

  if (typeof body.message === "string") {
    return body.message;
  }

  return JSON.stringify(body);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export async function apiFetch(
  path,
  { method = "GET", token, headers, body, query } = {}
) {
  const finalHeaders = new Headers(headers || {});
  finalHeaders.set("Accept", "application/json");

  const effectiveToken = String(
    token || getAuthToken() || ENV_ADMIN_TOKEN || ""
  ).trim();

  if (effectiveToken) {
    finalHeaders.set("Authorization", `Bearer ${effectiveToken}`);
  }

  const hasBody = body !== undefined && body !== null;
  if (hasBody && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError.message || "No se pudo conectar con la API."
    );
  }

  const parsedBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(parsedBody, response), {
      status: response.status,
      body: parsedBody,
    });
  }

  return parsedBody;
}

export function splitLinesToList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeVacancyListResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

export async function listVacancies(tenantId, options = {}) {
  const response = await apiFetch("/vacancies/", {
    method: "GET",
    query: {
      tenant_id: tenantId,
    },
    token: options.token,
  });

  return normalizeVacancyListResponse(response);
}

export async function getRanking(tenantId, vacancyId, options = {}) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(
      String(tenantId).trim()
    )}/vacancies/${encodeURIComponent(String(vacancyId).trim())}/ranking`,
    {
      method: "GET",
      token: options.token,
    }
  );
}

export async function getApplicationDetail(
  tenantId,
  applicationId,
  options = {}
) {
  return apiFetch(
    `/admin/v1/tenants/${encodeURIComponent(
      String(tenantId).trim()
    )}/applications/${encodeURIComponent(String(applicationId).trim())}`,
    {
      method: "GET",
      token: options.token,
    }
  );
}

export async function createVacancy(payload, options = {}) {
  return apiFetch("/vacancies/", {
    method: "POST",
    body: payload,
    token: options.token,
  });
}

export function buildQuestionPayload({
  code,
  text,
  type,
  required,
  order,
  options,
}) {
  const payload = {
    text: String(text || "").trim(),
    type: String(type || "text").trim(),
    required: Boolean(required),
    order:
      Number.isFinite(Number(order)) && Number(order) > 0
        ? Number(order)
        : 1,
  };

  const normalizedCode = String(code || "").trim();
  if (normalizedCode) {
    payload.code = normalizedCode;
  }

  const normalizedOptions = splitLinesToList(options);
  if (normalizedOptions.length > 0) {
    payload.options = normalizedOptions;
  }

  return payload;
}

export async function createVacancyQuestion(
  vacancyId,
  payload,
  options = {}
) {
  return apiFetch(
    `/vacancies/${encodeURIComponent(String(vacancyId).trim())}/questions`,
    {
      method: "POST",
      body: payload,
      token: options.token,
    }
  );
}

export async function probeAdminToken({
  tenantId,
  vacancyId,
  token,
} = {}) {
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) {
    throw new ApiError("Debes informar un token de administrador.");
  }

  if (!tenantId || !vacancyId) {
    return {
      ok: true,
      deferred: true,
      message:
        "Sesión guardada. La verificación real se hará cuando invoques el primer endpoint protegido.",
    };
  }

  try {
    await getRanking(tenantId, vacancyId, { token: normalizedToken });

    return {
      ok: true,
      deferred: false,
      message:
        "Token verificado correctamente contra el endpoint protegido de ranking.",
    };
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      throw error;
    }

    return {
      ok: true,
      deferred: true,
      message:
        "Sesión guardada. No se pudo completar la verificación previa, pero el backend seguirá validando el token en cada operación protegida.",
    };
  }
}
