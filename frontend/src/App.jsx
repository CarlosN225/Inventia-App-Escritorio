import { Routes, Route, Navigate } from 'react-router-dom'
import RutaProtegida from './components/RutaProtegida.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import AsistenteInicial from './pages/AsistenteInicial.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Movimientos from './pages/Movimientos.jsx'
import Alertas from './pages/Alertas.jsx'
import Configuracion from './pages/Configuracion.jsx'
import ProductoForm from './pages/ProductoForm.jsx'
import EnConstruccion from './pages/EnConstruccion.jsx'
import RegistrarVenta from './pages/RegistrarVenta.jsx'
import RegistrarCompra from './pages/RegistrarCompra.jsx'
import RegistrarMerma from './pages/RegistrarMerma.jsx'
import CorreccionInventario from './pages/CorreccionInventario.jsx'
import MiPerfil from './pages/MiPerfil.jsx'
import Ayuda from './pages/Ayuda.jsx'

export default function App() {
  return (
    <Routes>
      {/* Sin sidebar y sin protección: el login y el asistente de la primera vez */}
      <Route path="/" element={<Login />} />
      <Route path="/bienvenida" element={<AsistenteInicial />} />

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
          <Route path="/registrar-venta" element={<RegistrarVenta />} />
          <Route path="/registrar-compra" element={<RegistrarCompra />} />
          <Route path="/registrar-merma" element={<RegistrarMerma />} />
          <Route path="/correccion-inventario" element={<CorreccionInventario />} />
          <Route path="/perfil" element={<MiPerfil />} />
          <Route path="/ayuda" element={<Ayuda />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}