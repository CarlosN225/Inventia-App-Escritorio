import { useNavigate, useParams } from 'react-router-dom'

export default function ProductoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const esEdicion = Boolean(id)

  function handleSubmit(event) {
    event.preventDefault()
    // El guardado real se conecta cuando el backend esté listo.
    navigate('/catalogo')
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 className="card__title">{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" placeholder="Ej. Paleta payaso" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria">
              <option>Dulces</option><option>Chocolates</option><option>Piñatas</option><option>Fiestas</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="unidad">Unidad de medida</label>
            <select id="unidad"><option>Pieza</option><option>Paquete</option><option>Gramo</option></select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="stockInicial">Stock inicial</label>
            <input id="stockInicial" type="number" min="0" defaultValue={0} />
          </div>
          <div className="field">
            <label htmlFor="stockMinimo">Stock mínimo</label>
            <input id="stockMinimo" type="number" min="0" defaultValue={0} />
          </div>
          <div className="field">
            <label htmlFor="stockMaximo">Stock máximo (opcional)</label>
            <input id="stockMaximo" type="number" min="0" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="codigoBarras">Código de barras (opcional)</label>
          <input id="codigoBarras" />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="submit" className="btn btn--primary">Guardar</button>
          <button type="button" className="btn btn--outline" onClick={() => navigate('/catalogo')}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}