import { Component } from 'react';

const CHUNK_RELOAD_KEY = 'sipref_chunk_reload_at';

function esErrorDeChunk(error) {
  const msg = String(error?.message || error || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    error?.name === 'ChunkLoadError'
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || '' };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó:', error, info?.componentStack);

    // Si es un error por chunk desactualizado tras un despliegue en Vercel,
    // recargar automáticamente una sola vez para obtener el index.html y bundles nuevos.
    if (esErrorDeChunk(error)) {
      try {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (Date.now() - lastReload > 15000) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // Ignorar errores de sessionStorage
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#faf9fc] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full border border-[#c5c6cf]/30 shadow-sm text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-red-400 block">error</span>
            <h1 className="text-xl font-bold text-[#1b1c1e]">Algo salió mal</h1>
            <p className="text-sm text-[#75777f]">
              Ocurrió un error inesperado en la aplicación. Por favor, recarga la página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#1c355e] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all text-sm cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
