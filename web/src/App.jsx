import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Proxies from './pages/Proxies'
import Maquinas from './pages/Maquinas'
import Documentos from './pages/Documentos'
import Workers from './pages/Workers'

import ConfigurarBot from './pages/ConfigurarBot'
import Usuarios from './pages/Usuarios'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/proxies': 'Proxies',
  '/maquinas': 'Máquinas',
  '/documentos': 'Documentos',
  '/workers': 'Workers',
}

function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileSidebar, setMobileSidebar] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('oratioo_session')
    navigate('/login', { replace: true })
  }

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebar) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileSidebar])

  const currentPage = pageTitles[location.pathname] || ''

  return (
    <div className="flex min-h-screen bg-[#f5f5fa]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar onLogout={handleLogout} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
          mobileSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onLogout={handleLogout} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-[#e0e0f0] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setMobileSidebar(true)}
            className="p-1.5 rounded-lg hover:bg-[#f0f0f8] text-[#868686]"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-[#0a6ea9]">
            Oratioo CX
          </span>
          <div className="w-8" />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Small delay to allow CSS transitions to settle
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <Layout>
              <Clientes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configurar-bot"
        element={
          <ProtectedRoute>
            <Layout>
              <ConfigurarBot />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proxies"
        element={
          <ProtectedRoute>
            <Layout>
              <Proxies />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/maquinas"
        element={
          <ProtectedRoute>
            <Layout>
              <Maquinas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentos"
        element={
          <ProtectedRoute>
            <Layout>
              <Documentos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workers"
        element={
          <ProtectedRoute>
            <Layout>
              <Workers />
            </Layout>
          </ProtectedRoute>
        }
      />


      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <Layout>
              <Usuarios />
            </Layout>
          </ProtectedRoute>
        }
      />


      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
