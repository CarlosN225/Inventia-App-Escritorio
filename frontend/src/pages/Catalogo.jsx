import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card.jsx'
import LinkButton from '../components/LinkButton.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StockBar from '../components/StockBar.jsx'

const productos = [
  { id: 1, nombre: 'Paleta payaso', categoria: 'Dulces', stock: 3, minimo: 10 },
  { id: 2, nombre: 'Chocolate turín', categoria: 'Chocolates', stock: 5, minimo: 15 },
  { id: 3, nombre: 'Piñata estrella', categoria: 'Piñatas', stock: 1, minimo: 3 },
  { id: 4, nombre: 'Bolsa de confeti', categoria: 'Fiestas', stock: 22, minimo: 8 },
]

export default function Catalogo() {
  const [busqueda, setBusqueda] = useState('')
  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <>
      <PageHeader title="Catálogo de productos" subtitle={`${productos.length} productos registrados`} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="field" style={{ margin: 0, flex: 1, maxWidth: 320 }}>
          <label htmlFor="buscar" className="sr-only">Buscar producto</label>
          <input id="buscar" type="search" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <LinkButton to="/catalogo/nuevo" variant="primary">+ Nuevo producto</LinkButton>
      </div>

      <Card>
        <table>
          <thead><tr><th>Nombre</th><th>Categoría</th><th>Existencia</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.categoria}</td>
                <td><StockBar stock={p.stock} minimo={p.minimo} /></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <Link to={`/catalogo/${p.id}/editar`} className="btn btn--outline btn--sm">Editar</Link>
                  <Link to="/movimientos" className="btn btn--outline btn--sm">Movimiento</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}