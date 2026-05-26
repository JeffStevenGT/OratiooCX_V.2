import { Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const ROUTE_PERMISSIONS = {
  '/dashboard': ['supervisor', 'back_office', 'it', 'jefe_area', 'desarrollador'],
  '/clientes': ['supervisor', 'back_office', 'it', 'jefe_area', 'desarrollador'],
  '/configurar-bot': ['it', 'jefe_area', 'desarrollador'],
  '/documentos': ['supervisor', 'back_office', 'it', 'jefe_area', 'desarrollador'],
  '/lotes': ['supervisor', 'jefe_area', 'desarrollador'],
  '/dialer': ['asesor', 'supervisor'],
  '/agenda': ['asesor', 'supervisor', 'back_office'],
  '/admin/users': ['jefe_area', 'desarrollador'],
}

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const session = localStorage.getItem('oratioo_session')
    if (session) {
      const parsed = JSON.parse(session)
      const userRol = parsed.rol || 'asesor'
      const path = location.pathname
      const allowed = ROUTE_PERMISSIONS[path]

      if (allowed && !allowed.includes(userRol)) {
        // Redirigir segun el rol
        const destino = userRol === 'asesor' ? '/dialer' : '/dashboard'
        window.location.href = destino
        setAuthorized(false)
      } else {
        setAuthorized(true)
      }
    }
    setChecking(false)
  }, [location.pathname])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f5fa]">
        <div className="w-6 h-6 border-2 border-[#1495e0]/30 border-t-[#1495e0] rounded-full animate-spin" />
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}
