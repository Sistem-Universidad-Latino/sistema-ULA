import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TimeProvider } from './components/TimeContext';
import { UserProvider } from './components/UserContext';
import ErrorBoundary from './components/ErrorBoundary';
import TimeTravelDebugger from './components/TimeTravelDebugger';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';

// Helper para imports lazy tolerantes a despliegues nuevos en Vercel (evita ChunkLoadError al navegar tras login)
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      const key = 'sipref_lazy_reload_at';
      try {
        const lastReload = Number(sessionStorage.getItem(key) || 0);
        if (Date.now() - lastReload > 15000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return new Promise(() => {});
        }
      } catch {
        // Ignorar errores de sessionStorage
      }
      throw err;
    })
  );
}

// Code splitting: cada página se carga solo cuando se navega a ella
const VisualBd            = lazyWithRetry(() => import('./pages/VisualBd'));
const GestionHorarios     = lazyWithRetry(() => import('./pages/GestionHorarios'));
const GestionAulas        = lazyWithRetry(() => import('./pages/GestionAulas'));
const GestionDocentes     = lazyWithRetry(() => import('./pages/GestionDocentes'));
const Calendarios         = lazyWithRetry(() => import('./pages/Calendarios'));
const ReporteIncidencias  = lazyWithRetry(() => import('./pages/ReporteIncidencias'));
const ConfiguracionPerfil = lazyWithRetry(() => import('./pages/ConfiguracionPerfil'));
const ManualUsuario       = lazyWithRetry(() => import('./pages/ManualUsuario'));
const SoporteTecnico      = lazyWithRetry(() => import('./pages/SoporteTecnico'));

// Variable para activar el modo de mantenimiento
const EN_MANTENIMIENTO = false;

function MantenimientoPagina() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <span className="material-symbols-outlined text-6xl text-amber-500 mb-4 block">construction</span>
        <h1 className="text-2xl font-bold text-[#1c355e] mb-2">Sitio en Mantenimiento</h1>
        <p className="text-gray-600 leading-relaxed text-lg">
          🚧 SIPREF se encuentra en mantenimiento. Estaremos de regreso pronto.
        </p>
      </div>
    </div>
  );
}


function obtenerFechaLocalYYYYMMDD() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function RutaProtegida({ children }) {
  const usuario = localStorage.getItem('usuarioLogueado');
  const sesionFecha = localStorage.getItem('sesionFecha');
  const hoyLocal = obtenerFechaLocalYYYYMMDD();
  const hoyUtc = new Date().toISOString().slice(0, 10);

  // Aceptar fecha local o UTC del día en curso para no expulsar sesiones recién creadas en el cambio de zona horaria
  if (!usuario || !sesionFecha || (sesionFecha !== hoyLocal && sesionFecha !== hoyUtc)) {
    // Sesión inexistente, expirada (otro día), o sin fecha → limpiar y redirigir
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('sesionFecha');
    return <Navigate to="/login" replace />;
  }

  return children;
}

function CargandoPagina() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <span className="material-symbols-outlined animate-spin text-3xl text-[#1c355e]">sync</span>
    </div>
  );
}

export default function App() {
  if (EN_MANTENIMIENTO) {
    return <MantenimientoPagina />;
  }

  return (
    <ErrorBoundary>
      <TimeProvider>
        <UserProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Rutas Públicas */}
              <Route path="/login"    element={<Login />} />
              <Route path="/registro" element={<Registro />} />

              {/* Rutas Privadas */}
              <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={
                  <Suspense fallback={<CargandoPagina />}><VisualBd /></Suspense>
                } />
                <Route path="horarios" element={
                  <Suspense fallback={<CargandoPagina />}><GestionHorarios /></Suspense>
                } />
                <Route path="gestion-aulas" element={
                  <Suspense fallback={<CargandoPagina />}><GestionAulas /></Suspense>
                } />
                <Route path="gestion-docentes" element={
                  <Suspense fallback={<CargandoPagina />}><GestionDocentes /></Suspense>
                } />
                <Route path="calendarios" element={
                  <Suspense fallback={<CargandoPagina />}><Calendarios /></Suspense>
                } />
                <Route path="incidencias" element={
                  <Suspense fallback={<CargandoPagina />}><ReporteIncidencias /></Suspense>
                } />
                <Route path="configuracion-perfil" element={
                  <Suspense fallback={<CargandoPagina />}><ConfiguracionPerfil /></Suspense>
                } />
                <Route path="manual" element={
                  <Suspense fallback={<CargandoPagina />}><ManualUsuario /></Suspense>
                } />
                <Route path="soporte" element={
                  <Suspense fallback={<CargandoPagina />}><SoporteTecnico /></Suspense>
                } />
              </Route>

              {/* Ruta comodín */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </UserProvider>
        {import.meta.env.DEV && <TimeTravelDebugger />}
      </TimeProvider>
    </ErrorBoundary>
  );
}
