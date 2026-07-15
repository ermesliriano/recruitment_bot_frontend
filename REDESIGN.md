# REDESIGN — María · Reclutamiento Inteligente (CESAR IA Suite)

Documento de entrega del rediseño UI/UX. Fase 1 implementada; fases siguientes
planificadas al final. Regla de oro respetada: **cero cambios de backend,
endpoints, contratos o lógica de negocio**.

---

## 1. Auditoría del frontend actual

- **Stack**: React 18 + Vite, JavaScript (no TypeScript), react-router-dom v6,
  estado global vía Context (`src/context/AppContext.jsx`), API centralizada en
  `src/lib/api.js` (bearer ADMIN_TOKEN), **CSS propio en un único fichero**
  (`src/styles/volunteerm.css`, ~1.600 líneas) — sin Tailwind ni librería de
  componentes. No se introdujo ninguna librería nueva.
- **Estructura previa**: Topbar horizontal cargada de enlaces + pills, páginas
  como pilas de `card`, dashboard con 4 StatCard genéricas y una fila de 5
  botones de navegación; marca "Recruitment Bot".
- **Fortaleza aprovechada**: el CSS ya tenía tokens semánticos (`--bg`, `--card`,
  `--primary`…) mapeados sobre variables de marca, lo que permitió re-skinear
  toda la aplicación editando solo `:root`.

## 2. Lista de pantallas

| Ruta | Pantalla | Estado rediseño |
|---|---|---|
| /login, /signup | Acceso | Re-skin por tokens (layout original) |
| /dashboard | Dashboard de Reclutamiento | ✅ Rediseñada (Fase 1) |
| /ranking | Ranking de candidaturas + incompletas | Re-skin por tokens; mejoras Fase 2 |
| /applications/:id | Detalle de candidatura | Re-skin por tokens |
| /vacancies/new, /:id/edit | Formulario de vacante | Re-skin; wizard 4 pasos = Fase 2 |
| /vacancies/:id/questions | Preguntas de vacante | Re-skin |
| /tenant-questions | Preguntas genéricas | Re-skin; vista previa = Fase 2 |
| /cv-imports | Carga de CV (canales, programación) | Re-skin; drag&drop = Fase 2 |
| /conversations | Conversaciones (tipo WhatsApp) | Re-skin; 3ª columna perfil = Fase 2 |
| /company-info | Datos de la empresa + canal email | Re-skin |
| /conversation-flow | Configuración (modo IA, prompts) | Re-skin |

## 3. Mapa de navegación (Fase 1)

Sidebar fija (desktop) / colapsable con hamburguesa y overlay (≤860px):

- CTA **Crear vacante** → /vacancies/new
- Dashboard → /dashboard
- Ranking → /ranking
- Carga de CV → /cv-imports
- Preguntas → /tenant-questions
- Conversaciones → /conversations
- Empresa → /company-info
- Configuración → /conversation-flow
- Footer: usuario, tipo de token, Salir.

Nota: "Vacantes" y "Candidatos" como vistas independientes del menú (spec §4)
quedan para Fase 2; hoy el listado de vacantes vive en el Dashboard y los
candidatos en Ranking.

## 4. Design system aplicado

Paleta oficial en `:root` de `volunteerm.css`:
`--graphite(#262729)/-hover/-soft`, `--accent(#F8AF4B)/-hover/-soft`,
`--background #F4F4F2`, `--surface #FFFFFF`, `--surface-muted`, `--border
#E3E3E0`, `--text-primary/secondary/inverse`, estados `--success/-bg`,
`--warning/-bg`, `--error/-bg`, `--info/-bg`.

Decisiones documentadas:
- El token semántico **`--primary` = color de CTA** y apunta a `--accent`
  (naranja), conforme a la regla "naranja solo para CTA/activos". El grafito
  oficial (`--primary` de la spec) vive como `--graphite` para no romper los
  ~40 usos existentes de `--primary` como color de acción.
- Capa de **alias de compatibilidad** (`--primary-dark`, `--primary-gold`,
  `--light-bg`…) para que el CSS heredado adopte la paleta sin tocar cada regla.
- Distribución 70/20/10: fondo y superficies neutros, sidebar grafito, naranja
  reservado a CTA, ítem activo del menú, borde de la vacante activa y focos.

## 5. Componentes creados / modificados

Nuevos: `Sidebar.jsx`, `MariaAvatar.jsx` (avatar oficial con fallback "M"),
`KpiCard.jsx`.
Modificados: `AppShell.jsx` (layout sidebar + header compacto + Escape/overlay
en móvil), `DashboardPage.jsx` (hero con María, 4 KPI, card de vacante activa,
accesos rápidos, tabla limpia).
Sin cambios pero re-skineados por tokens: Table, Modal, badges, chat, etc.
`Topbar.jsx` queda solo para sesiones no autenticadas. `StatCard.jsx` queda sin
uso en dashboard (se conserva por si otras vistas lo requieren).

## 6. Archivos modificados (Fase 1)

- `src/styles/volunteerm.css` — tokens oficiales + estilos suite (sidebar,
  header, kpi, quick actions, vacante activa, avatar, responsive).
- `src/components/AppShell.jsx` — reescrito.
- `src/components/Sidebar.jsx` — nuevo.
- `src/components/MariaAvatar.jsx` — nuevo.
- `src/components/KpiCard.jsx` — nuevo.
- `src/pages/DashboardPage.jsx` — rediseñado (sin tocar handlers ni API).
- `index.html` — título, descripción y favicon.

**Backend/API**: sin cambios. Los KPI se calculan de datos ya expuestos
(`status`, `applications_count`, ranking `total`).

## 7. Flujos validados (sin cambios funcionales)

Los flujos A–E de la spec conservan sus rutas y handlers exactos; solo cambió
la envoltura visual y la ubicación de la navegación (sidebar en lugar de
topbar/botonera). La botonera eliminada del dashboard está cubierta 1:1 por el
menú lateral y los accesos rápidos.

## 8. Assets pendientes de recibir (colocar en `public/`)

- `public/maria-avatar.png` — imagen oficial de María (mientras no exista se
  muestra el placeholder "M").
- `public/favicon.png` — isotipo oficial (referenciado ya en index.html).
- Logo horizontal oficial (para login y sidebar si se desea sustituir el texto).

## 9. Pendientes técnicos (roadmap Fase 2+)

1. **Vista Vacantes independiente** con filtros, badges y menú contextual (§6).
2. **Wizard de 4 pasos** para crear/editar vacante con stepper y borrador (§7).
3. **Uploader drag & drop** con progreso por archivo en Carga de CV (§8).
4. **Panel lateral de candidato** en Ranking con barras de puntuación y CTAs
   (§9) + bloque "Recomendación de María" (§13) reutilizando `MariaAvatar`.
5. **3ª columna de perfil** y filtros/búsqueda en Conversaciones (§11), más
   "tomar control humano" (requiere flag backend: pausar bot por sesión —
   único punto que necesitaría backend, documentado).
6. **KPIs avanzados** (evaluados totales, preseleccionados, pendientes, tiempo
   medio de evaluación): requieren un endpoint agregado de solo lectura
   (`GET /admin/v1/tenants/{id}/dashboard-stats`) — propuesto, no implementado.
7. Paginación/loading skeletons en tablas grandes (§15) y catálogo completo de
   empty/error states (§16).
8. Migrar textos residuales con "tenant" y auditoría AA de contraste completa.

## 10. Validación pendiente del lado del propietario

- `npm run build` local (no ejecutable desde este entorno) y despliegue.
- Capturas de las pantallas y verificación responsive en 390/768/1024/1366/
  1440/1920 (la base responsive está implementada: sidebar colapsable, grids
  1-2-4 columnas, chat apilado).
