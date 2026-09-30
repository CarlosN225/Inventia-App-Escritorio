import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getUsuarioActual } from '../services/auth'

export default function RutaProtegida() {
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'autenticado' | 'no-autenticado'

  useEffect(() => {
    getUsuarioActual()
      .then(() => setEstado('autenticado'))
      .catch(() => setEstado('no-autenticado'))
  }, [])

  if (estado === 'cargando') {
    return <div style={{ padding: 40 }}>Cargando...</div>
  }

  if (estado === 'no-autenticado') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}