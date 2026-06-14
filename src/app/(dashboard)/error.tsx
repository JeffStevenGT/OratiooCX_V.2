'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-red-600 dark:text-red-400 mb-4">500</h1>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error del servidor</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 max-w-md">
        {error.message || 'Ocurrió un error inesperado al cargar esta página.'}
      </p>
      <p className="text-xs text-gray-400 mb-6">Si el problema persiste, contacta a soporte.</p>
      <button
        onClick={reset}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
