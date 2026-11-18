# Análisis de Limpieza y Optimización — SIPREF (Sistema ULA)

**Rama de análisis:** `analisis/limpieza-optimizacion`  
**Fecha:** 2026-11-17  
**Alcance:** Solo lectura y diagnóstico. No se modificó ni eliminó ningún archivo de código, configuración, dependencia ni registro en base de datos.

---

## 1. Resumen Ejecutivo

- **Total de candidatos a eliminar/depurar:** **13**
  - **Riesgo BAJO:** 7 (scripts sueltos de depuración/documentación y copias duplicadas de `logo.png`).
  - **Riesgo MEDIO:** 1 (`TimeTravelDebugger.jsx`, útil solo en desarrollo).
  - **Riesgo ALTO:** 5 (rutas HTTP duplicadas en `src/backend/main.py`).
- **Hallazgos más importantes:**
  1. **Seguridad (Prioridad Crítica):** La contraseña de aplicación SMTP (`'from lcxt muzd wugb'`) y el correo remitente están escritos en texto plano dentro de archivos versionados en Git (`scripts/build-vercel-output.mjs`, `src/backend/main.py` y `src/backend/modulo_incidencias.py`). Los archivos `.env` y `src/backend/.env` sí están excluidos correctamente en `.gitignore`.
  2. **Rutas FastAPI duplicadas en `src/backend/main.py`:** Existen **5 pares de rutas con el mismo método y URL** (por ejemplo `/api/archivos` y `/api/calendario-institucional/evento`). FastAPI registra la primera definición y oculta silenciosamente la segunda, lo que puede generar confusión y código muerto difícil de rastrear.
  3. **Monolito y consultas sin filtrado SQL:** `src/backend/main.py` supera las 12,180 líneas en un solo archivo, y consultas como `_consultar_reservas_como_eventos` traen todos los registros de `reservas_reservaciones` para filtrarlos en Python en lugar de usar `WHERE` con índices en BD.

---

## 2. Mapeo del Proyecto (Paso 1)

### Estructura principal
- **Frontend (`src/`):** React 18 + Vite 5 + Tailwind CSS 3 + React Router DOM 6 + SweetAlert2 (`package.json`).
  - **Punto de entrada:** `src/main.jsx` → `src/App.jsx` (con `lazy()` code splitting por página, `ErrorBoundary`, `TimeProvider`, `UserProvider` y `RutaProtegida`).
  - **Páginas (`src/pages/`):**
    - Públicas: `Login.jsx` (`/login`), `Registro.jsx` (`/registro`).
    - Privadas (`Layout.jsx`): `VisualBd.jsx` (`/dashboard`), `GestionHorarios.jsx` (`/horarios`), `GestionAulas.jsx` (`/gestion-aulas`), `GestionDocentes.jsx` (`/gestion-docentes`), `Calendarios.jsx` (`/calendarios`), `ReporteIncidencias.jsx` (`/incidencias`), `ConfiguracionPerfil.jsx` (`/configuracion-perfil`), `ManualUsuario.jsx` (`/manual`), `SoporteTecnico.jsx` (`/soporte`).
  - **Componentes (`src/components/`):** `Layout.jsx`, `AgendaEventos.jsx` (usado en `Calendarios.jsx`), `AgendarEventoModal.jsx` (usado en `AgendaEventos.jsx` y `GestionAulas.jsx`), `TimeContext.jsx`, `UserContext.jsx`, `ErrorBoundary.jsx`, `useToast.jsx`, `TimeTravelDebugger.jsx` (solo `import.meta.env.DEV`).
  - **Utilidades (`src/utils/`):** `timeUtils.js` (usado en `GestionAulas.jsx`).
- **Backend (`src/backend/`):** FastAPI 0.111 + Uvicorn + PyMySQL + Pydantic + `pdfplumber` + `openpyxl` + `reportlab` + `pillow` (`src/backend/requirements.txt`).
  - **Punto de entrada:** `src/backend/main.py` (12,182 líneas) + `src/backend/modulo_incidencias.py`.
- **Despliegue:**
  - Frontend en Vercel (`vercel.json` + `scripts/build-vercel-output.mjs` con Build Output API v3 y función `/api/send-email`).
  - Backend en Render (`https://sistema-ula-backend-18ld.onrender.com`).
  - Base de datos compartida en TiDB Cloud (`test`).

---

## 3. Candidatos a Eliminar o Depurar (Paso 2)

| Ruta / Símbolo | Motivo | Evidencia | Riesgo |
| :--- | :--- | :--- | :--- |
| `src/backend/test_parser.py` | Script de prueba puntual no importado por la app | `rg` en `src/`: 0 referencias | **BAJO** |
| `src/backend/reextract.py` | Script puntual de re-extracción no importado | `rg` en `src/`: 0 referencias | **BAJO** |
| `src/backend/update_exports.py` | Script auxiliar puntual no importado | `rg` en `src/`: 0 referencias | **BAJO** |
| `src/backend/create_bitacora_table.py` | Script DDL puntual (ya cubierto en `main.py`) | `rg` en `src/`: 0 referencias | **BAJO** |
| `src/backend/generar_imagen_er.py` | Generador de diagrama ER para documentación | Solo importado por `generar_pdf_documentacion.py` | **BAJO** |
| `src/backend/generar_pdf_documentacion.py` | Generador de PDF de documentación técnica | No importado por `main.py` | **BAJO** |
| `logo.png` (raíz) / `src/backend/logo.png` | Copias duplicadas de `src/components/logo.png` | Verificar si `generar_pdf_documentacion.py` las usa | **BAJO** |
| `src/components/TimeTravelDebugger.jsx` | Herramienta de depuración de reloj (`DEV` only) | En `App.jsx:115` solo se monta con `import.meta.env.DEV` | **MEDIO** |
| `@app.get("/api/archivos")` (líneas 3539 y 4293 de `main.py`) | Ruta GET duplicada (la 2ª queda sombreada) | `rg "@app\." main.py` | **ALTO** |
| `@app.get("/api/archivos/{nombre_archivo}/horarios")` (3593 y 4387) | Ruta GET duplicada | `rg "@app\." main.py` | **ALTO** |
| `@app.delete("/api/archivos/{nombre_archivo}")` (3617 y 4585) | Ruta DELETE duplicada | `rg "@app\." main.py` | **ALTO** |
| `@app.post("/api/calendario-institucional/evento")` (2079 y 2509) | Ruta POST duplicada | `rg "@app\." main.py` | **ALTO** |
| `@app.delete("/api/calendario-institucional/evento/{evento_id}")` (2137 y 2537) | Ruta DELETE duplicada | `rg "@app\." main.py` | **ALTO** |

> **Carpetas generadas:** `dist/`, `node_modules/`, `.venv/`, `.env` y `src/backend/.env` **sí** están en `.gitignore` y **no** están rastreadas por Git (`git ls-files` devolvió vacío para todas ellas).

---

## 4. Hallazgos de Seguridad (Prioridad Alta)

| Archivo | Líneas | Hallazgo | Acción recomendada |
| :--- | :--- | :--- | :--- |
| `scripts/build-vercel-output.mjs` | 69–70 | `DEFAULT_SMTP_USER` y `DEFAULT_SMTP_PASS` (`'from lcxt muzd wugb'`) hardcodeados | Mover 100% a variables de entorno en Vercel y rotar la contraseña de aplicación en Gmail |
| `src/backend/main.py` | 10511, 10798 | Fallback hardcodeado de `SMTP_PASSWORD` en texto plano | Eliminar el literal de respaldo y exigir `os.getenv("SMTP_PASSWORD")` en Render |
| `src/backend/modulo_incidencias.py` | 1006 | Fallback hardcodeado de `SMTP_PASSWORD` en texto plano | Eliminar el literal de respaldo y exigir variable de entorno |

---

## 5. Oportunidades de Optimización (Paso 3)

| Área / Archivo | Oportunidad detectada | Impacto estimado | Esfuerzo |
| :--- | :--- | :--- | :--- |
| `src/backend/main.py` (`_consultar_reservas_como_eventos`) | Trae todas las filas de `reservas_reservaciones` y filtra en Python; mover filtros (`estado`, `inicio`, `espacio_nombre`) a SQL `WHERE` | **Alto** (menos memoria y latencia al crecer el historial) | Medio |
| Base de datos TiDB (`eventos_aulas`, `reservas_reservaciones`) | Verificar/agregar índices compuestos en `(fecha, aula_nombre, estado)` y `(estado, inicio)` | **Alto** (acelera agenda y verificación de disponibilidad) | Bajo |
| `src/backend/main.py` (12,182 líneas) | Modularizar en `APIRouter` por dominio (`eventos`, `horarios`, `aulas`, `reservas`, `auth`) | **Medio** (mantenibilidad y menor riesgo de rutas duplicadas) | Alto |
| Frontend (`AgendaEventos`, `AgendarEventoModal`, `Layout`, `Calendarios`, `GestionHorarios`) | Centralizar `API_URL` en `src/config/api.js` (hoy repetido en 7+ puntos) | **Bajo** (limpieza y mantenimiento) | Bajo |
| Frontend (`GestionAulas.jsx`, `ConfiguracionPerfil.jsx`) | Agregar `AbortController` en `fetch` dentro de `useEffect` e intervalos para evitar fugas al desmontar | **Medio** (estabilidad en navegación rápida) | Bajo |

---

## 6. Plan de Limpieza por Fases (Paso 4)

- **Fase 1 (Riesgo BAJO):**
  - Eliminar scripts sueltos no referenciados (`test_parser.py`, `reextract.py`, `update_exports.py`, `create_bitacora_table.py`) tras confirmar que ningún cron/proceso externo los ejecuta.
  - Centralizar `API_URL` en `src/config/api.js`.
  - **Reversión:** `git revert <commit>` sobre la rama de trabajo.
- **Fase 2 (Riesgo MEDIO):**
  - Agregar `AbortController` a los `fetch` con polling en `GestionAulas.jsx` y `ConfiguracionPerfil.jsx`.
  - Mover filtros de `_consultar_reservas_como_eventos` a SQL `WHERE`.
  - **Reversión:** `git revert <commit>` o restaurar desde rama de respaldo `main`.
- **Fase 3 (Riesgo ALTO — requiere aprobación explícita y pruebas en staging):**
  - Rotar contraseña SMTP en Google Workspace/Gmail y eliminar los literales hardcodeados en `build-vercel-output.mjs`, `main.py` y `modulo_incidencias.py`.
  - Unificar/eliminar las 5 rutas FastAPI duplicadas en `main.py` verificando cuál de las dos implementaciones es la vigente en producción.
  - **Reversión:** `git revert <commit>` + restaurar variables de entorno previas en Render/Vercel si aplica.

---

## 7. Preguntas Abiertas para el Equipo Responsable

1. ¿Alguno de los scripts `reextract.py`, `update_exports.py` o `generar_pdf_documentacion.py` se ejecuta manualmente o por tarea programada fuera del repositorio?
2. De las rutas duplicadas en `main.py` (`/api/archivos` en línea 3539 vs 4293, y `/api/calendario-institucional/evento` en línea 2079 vs 2509), ¿confirmamos que la primera definición es la que está atendiendo tráfico en producción?
3. ¿Pueden rotar la contraseña de aplicación de `soporte.sipref.software@gmail.com` en cuanto aprobemos la Fase 3?
