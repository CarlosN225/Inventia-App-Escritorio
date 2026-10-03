import { Routes, Route, Navigate } from 'react-router-dom'
import RutaProtegida from './components/RutaProtegida.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Movimientos from './pages/Movimientos.jsx'
import Alertas from './pages/Alertas.jsx'
import Configuracion from './pages/Configuracion.jsx'
import ProductoForm from './pages/ProductoForm.jsx'
import EnConstruccion from './pages/EnConstruccion.jsx'
import RegistrarVenta from './pages/RegistrarVenta.jsx'
import RegistrarCompra from './pages/RegistrarCompra.jsx'

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
          <Route path="/registrar-venta" element={<RegistrarVenta />} />
                   <Route path="/registrar-compra" element={<RegistrarCompra />} />
           <Route
            path="/registrar-merma"
            element={
              <EnConstruccion
                titulo="Registrar merma"
                descripcion="Aquí registrarás lo que se caduca, se daña o se consume en el negocio."
              />
            }
          />
          <Route
            path="/correccion-inventario"
            element={
              <EnConstruccion
                titulo="Corrección de inventario"
                descripcion="Aquí ajustarás el inventario cuando el conteo físico no cuadre con el sistema."
              />
            }
          />
          <Route
            path="/ayuda"
            element={
              <EnConstruccion
                titulo="Ayuda"
                descripcion="Aquí encontrarás guías rápidas para usar INVENTIA."
              />
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}