import { Routes, Route, Navigate } from 'react-router-dom'
import RutaProtegida from './components/RutaProtegida.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Catalogo from './pages/Catalogo'
import Movimientos from './pages/Movimientos'
import Alertas from './pages/Alertas'
import Configuracion from './pages/Configuracion'
import ProductoForm from './pages/ProductoForm'

export default function App() {
  return (
    <Routes>
      {/* Login sin sidebar y sin protección */}
      <Route path="/" element={<Login />} />

      {/* Todo lo interno requiere sesión activa */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/panel" element={<Dashboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/nuevo" element={<ProductoForm />} />
          <Route path="/catalogo/:id/editar" element={<ProductoForm />} />
          <Route path="/movimientos" element={<Movimientos />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}