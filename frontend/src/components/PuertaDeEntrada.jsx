import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import Login from '../pages/Login.jsx'
import { estadoInicial } from '../services/auth'
import { limpiarMemoria } from '../services/memoria'

/* Al abrir la app: si todavía no hay dueño, manda al Asistente; si ya hay, muestra el Login con el nombre del negocio */
export default function PuertaDeEntrada() {
  const [destino, setDestino] = useState('revisando') // revisando | asistente | login
  const [nombreNegocio, setNombreNegocio] = useState(null)

  useEffect(() => {
    // Al volver a la entrada (cerrar sesión), el aviso de "Atención" vuelve a salir en la siguiente sesión
    // Al cerrar sesión se olvida lo que se tenía en memoria (el siguiente usuario carga lo suyo)
    limpiarMemoria()
    try {
      Object.keys(sessionStorage)
        .filter((clave) => clave.startsWith('inventia_atencion_'))
        .forEach((clave) => sessionStorage.removeItem(clave))
    } catch {
      // nada
    }

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