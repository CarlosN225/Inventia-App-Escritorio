import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import Login from '../pages/Login.jsx'
import { estadoInicial } from '../services/auth'

/* Al abrir la app: si todavía no hay dueño, manda al Asistente; si ya hay, muestra el Login con el nombre del negocio */
export default function PuertaDeEntrada() {
  const [destino, setDestino] = useState('revisando') // revisando | asistente | login
  const [nombreNegocio, setNombreNegocio] = useState(null)

  useEffect(() => {
    estadoInicial()
      .then((r) => {
        setNombreNegocio(r.nombre_negocio ?? null)
        setDestino(r.necesita_configuracion ? 'asistente' : 'login')
      })
      .catch(() => setDestino('login')) // si el backend no contesta, el Login ya avisa
  }, [])

  if (destino === 'revisando') return null
  if (destino === 'asistente') return <Navigate to="/bienvenida" replace />

  return <Login nombreNegocio={nombreNegocio} />
}