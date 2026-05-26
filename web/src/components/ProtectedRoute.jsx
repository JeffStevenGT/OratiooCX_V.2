import { Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem('oratioo_session')
    if (session) {
      setAuthorized(true)
    }
    setChecking(false)
  }, [])

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
