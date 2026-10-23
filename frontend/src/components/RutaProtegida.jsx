import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { getUsuarioActual } from '../services/auth'

/* Le pregunta al backend si hay sesión. Si no la hay (por ejemplo, porque se
   reinició la base o se cerró la sesión en otro lado), regresa al login. */
export default function RutaProtegida() {
  const [estado, setEstado] = useState('revisando') // revisando | ok | sin-sesion

  useEffect(() => {
    let sigueMontado = true

    getUsuarioActual()
      .then(() => sigueMontado && setEstado('ok'))
      .catch(() => sigueMontado && setEstado('sin-sesion'))

    return () => {
      sigueMontado = false
    }
  }, [])

  if (estado === 'revisando') return null
  if (estado === 'sin-sesion') return <Navigate to="/" replace />

  return <Outlet />
}