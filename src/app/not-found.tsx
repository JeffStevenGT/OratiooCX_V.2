import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-[#481163] mb-4">404</h1>
      <h2 className="text-xl font-semibold text-[#1a1030] mb-2">Página no encontrada</h2>
      <p className="text-sm text-[#7c757c] mb-6">La página que buscás no existe o fue movida.</p>
      <Link href="/inicio" className="btn-primary text-sm px-6 py-2">
        Volver al inicio
      </Link>
    </div>
  );
}
