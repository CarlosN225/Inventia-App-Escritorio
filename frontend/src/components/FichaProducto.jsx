import { useEffect } from 'react'
import {
  X,
  Candy,
  Pencil,
  History,
  Truck,
  BadgeDollarSign,
  Warehouse,
  PackageOpen,
  CalendarClock,
  Tag,
  Barcode,
  Clock,
  TrendingUp,
} from 'lucide-react'

import { textoUnidad } from '../utils/unidades'
import '../styles/ficha-producto.css'

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const MARGEN_BAJO = 25

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : ''
}

function estadoStock(p) {
  if (p.stock === 0) return { clase: 'rojo', texto: 'Agotado' }
  if (p.stock < p.minimo) return { clase: 'ambar', texto: `Bajo · faltan ${p.minimo - p.stock}` }
  if (p.maximo && p.stock > p.maximo) return { clase: 'ambar', texto: 'Arriba del máximo' }
  return { clase: 'verde', texto: 'Bien surtido' }
}

// 53 piezas en bolsas de 25 -> "2 bolsas y 3 piezas"
function enEmpaques(p) {
  if (!p.piezasEmpaque || p.piezasEmpaque < 2 || p.stock === 0) return null
  const empaques = Math.floor(p.stock / p.piezasEmpaque)
  const sueltas = p.stock % p.piezasEmpaque
  const partes = []
  if (empaques > 0) partes.push(`${empaques} ${textoUnidad(p.empaque ?? 'caja', empaques)}`)
  if (sueltas > 0) partes.push(`${sueltas} ${textoUnidad(p.unidad, sueltas)}`)
  return partes.join(' y ')
}

function Dato({ etiqueta, children, clase = '' }) {
  return (
    <div className="fp-dato">
      <dt>{etiqueta}</dt>
      <dd className={clase}>{children}</dd>
    </div>
  )
}

/* La ficha del producto: todo de un vistazo, sin tener que abrir el formulario */
export default function FichaProducto({
  producto: p,
  esPropietario,
  conCaducidad,
  conMayoreo,
  conPromos,
  conCodigo,
  aviso,
  vendidas30,
  onCerrar,
  onEditar,
  onVerMovimientos,
  onComprar,
}) {
  // Esc cierra
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  const unidad1 = textoUnidad(p.unidad, 1)
  const margen = p.costo !== null && p.precio ? Math.round(((p.precio - p.costo) / p.precio) * 100) : null
  const stock = estadoStock(p)
  const empaqueTexto = textoUnidad(p.empaque ?? 'caja', 1)
  const empaqueCompleto =
    (p.empaque ?? 'caja') === 'paquete' ? `El ${empaqueTexto} completo` : `La ${empaqueTexto} completa`
  const tieneMayoreo = conMayoreo && p.precioMayoreo && p.minimoMayoreo
  const promo = conPromos ? p.promocion : null
  const precioPromo = promo
    ? promo.tipo === 'porcentaje'
      ? p.precio * (1 - promo.valor / 100)
      : Math.max(0, p.precio - promo.valor)
    : null
  const codigo = p.codigoBarras ?? p.codigo_barras ?? ''
  const cadUrgente = p.diasCaducar !== null && p.diasCaducar <= 7
  const cadAviso = p.diasCaducar !== null && p.diasCaducar <= aviso

  return (
    <div className="fp" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <article className="fp-caja" role="dialog" aria-modal="true" aria-labelledby="fp-titulo">
        {/* ============ ENCABEZADO ============ */}
        <header className="fp-cabecera">
          <span className="fp-foto" aria-hidden="true">
            {p.imagen ? <img src={p.imagen} alt="" /> : <Candy size={26} />}
          </span>

          <div className="fp-titulos">
            <h2 id="fp-titulo" className="fp-nombre">
              {p.nombre}
              {p.gramaje && <span className="gramaje">{p.gramaje}</span>}
            </h2>
            <p className="fp-sub">
              {p.marca && <span>{p.marca}</span>}
              <span className="fp-chip">{p.categoria}</span>
            </p>
            {p.descripcion && <p className="fp-desc">{p.descripcion}</p>}
          </div>

          <span className={'fp-estado ' + (p.activo ? 'is-activo' : 'is-inactivo')}>
            <span aria-hidden="true" />
            {p.activo ? 'Activo' : 'Desactivado'}
          </span>

          <button type="button" className="fp-cerrar" aria-label="Cerrar" onClick={onCerrar}>
            <X size={18} />
          </button>
        </header>

        {/* ============ LO PRINCIPAL ============ */}
        <section className={'fp-kpis' + (esPropietario ? '' : ' fp-kpis--dos')}>
          <div className="fp-kpi">
            <span>Precio de venta</span>
            <strong>{moneda.format(p.precio)}</strong>
            <small>por {unidad1}</small>
          </div>

          {esPropietario && (
            <div className="fp-kpi">
              <span>Último costo</span>
              <strong>{p.costo !== null ? moneda.format(p.costo) : '—'}</strong>
              <small>{p.costo !== null ? `por ${unidad1}` : 'Llega con la primera compra'}</small>
            </div>
          )}

          {esPropietario && (
            <div className={'fp-kpi' + (margen !== null && margen < MARGEN_BAJO ? ' is-rojo' : '')}>
              <span>Margen</span>
              <strong>{margen !== null ? `${margen}%` : '—'}</strong>
              <small>
                {margen !== null ? `Ganas ${moneda.format(p.precio - p.costo)} por ${unidad1}` : 'Sin costo registrado'}
              </small>
            </div>
          )}

          <div className={`fp-kpi is-${stock.clase}`}>
            <span>Stock</span>
            <strong>
              {p.stock} {textoUnidad(p.unidad, p.stock)}
            </strong>
            <small>{stock.texto}</small>
          </div>
        </section>

        {/* ============ DETALLES EN 3 COLUMNAS ============ */}
        <section className="fp-columnas">
          {/* --- Venta --- */}
          <div className="fp-bloque">
            <h3>
              <BadgeDollarSign size={15} aria-hidden="true" />
              Venta
            </h3>
            <dl>
              {conMayoreo && (
                <Dato etiqueta="Mayoreo">
                  {tieneMayoreo
                    ? `${moneda.format(p.precioMayoreo)} desde ${p.minimoMayoreo} ${textoUnidad(p.unidad, p.minimoMayoreo)}`
                    : 'No aplica'}
                </Dato>
              )}
              {tieneMayoreo && p.piezasEmpaque > 1 && p.minimoMayoreo === p.piezasEmpaque && (
                <Dato etiqueta={empaqueCompleto} clase="is-fuerte">
                  {moneda.format(p.precioMayoreo * p.piezasEmpaque)}
                </Dato>
              )}
              {conPromos && (
                <Dato etiqueta="Promoción" clase={promo ? 'is-azul' : 'is-tenue'}>
                  {promo ? (
                    <>
                      <Tag size={12} aria-hidden="true" /> −
                      {promo.tipo === 'porcentaje' ? `${promo.valor}%` : moneda.format(promo.valor)} ={' '}
                      {moneda.format(precioPromo)} hasta {formatoFecha.format(new Date(`${promo.fechaFin}T00:00`))}
                    </>
                  ) : (
                    'Sin promoción vigente'
                  )}
                </Dato>
              )}
              <Dato etiqueta="Vendidas en 30 días">
                <TrendingUp size={12} aria-hidden="true" /> {vendidas30} {textoUnidad(p.unidad, vendidas30)}
              </Dato>
            </dl>
          </div>

          {/* --- Inventario --- */}
          <div className="fp-bloque">
            <h3>
              <Warehouse size={15} aria-hidden="true" />
              Inventario
            </h3>
            <dl>
              <Dato etiqueta="Mínimo · Máximo">
                {p.minimo} · {p.maximo ?? 'sin máximo'} {textoUnidad(p.unidad, 2)}
              </Dato>
              {enEmpaques(p) && <Dato etiqueta="Equivale a">{enEmpaques(p)}</Dato>}
              {p.stock < p.minimo && (
                <Dato etiqueta="Para surtir" clase="is-ambar">
                  Faltan {p.minimo - p.stock} para el mínimo
                </Dato>
              )}
              {conCodigo && (
                <Dato etiqueta="Código de barras" clase={codigo ? '' : 'is-tenue'}>
                  {codigo ? (
                    <>
                      <Barcode size={12} aria-hidden="true" /> {codigo}
                    </>
                  ) : (
                    'Sin código'
                  )}
                </Dato>
              )}
            </dl>
          </div>

          {/* --- Empaque y caducidad --- */}
          <div className="fp-bloque">
            <h3>
              <PackageOpen size={15} aria-hidden="true" />
              Empaque{conCaducidad ? ' y caducidad' : ''}
            </h3>
            <dl>
              <Dato etiqueta="Lo mínimo que vendes">{capitalizar(unidad1)}</Dato>
              <Dato etiqueta="Te llega en">
                {p.piezasEmpaque > 1
                  ? `${capitalizar(empaqueTexto)} de ${p.piezasEmpaque} ${textoUnidad(p.unidad, p.piezasEmpaque)}`
                  : 'Suelto'}
              </Dato>
              {conCaducidad && (
                <Dato
                  etiqueta="Caducidad"
                  clase={p.caducidad ? (cadUrgente ? 'is-rojo' : cadAviso ? 'is-ambar' : '') : 'is-tenue'}
                >
                  {p.caducidad ? (
                    <>
                      <CalendarClock size={12} aria-hidden="true" /> {p.caducidad}
                      {p.diasCaducar !== null &&
                        (p.diasCaducar < 0
                          ? ` · caducó hace ${Math.abs(p.diasCaducar)} días`
                          : ` · en ${p.diasCaducar} días`)}
                    </>
                  ) : (
                    'Sin fecha registrada'
                  )}
                </Dato>
              )}
            </dl>
          </div>
        </section>

        {/* ============ PIE ============ */}
        <footer className="fp-pie">
          <span className="fp-editado">
            <Clock size={13} aria-hidden="true" />
            {p.actualizadoEn
              ? `Última edición: ${formatoFechaHora.format(new Date(p.actualizadoEn))}`
              : 'Sin ediciones registradas'}
          </span>

          <div className="fp-botones">
            <button type="button" className="fp-boton" onClick={onVerMovimientos}>
              <History size={15} aria-hidden="true" />
              Ver movimientos
            </button>
            {p.activo && (
              <button type="button" className="fp-boton" onClick={onComprar}>
                <Truck size={15} aria-hidden="true" />
                Registrar compra
              </button>
            )}
            {esPropietario && p.activo && (
              <button type="button" className="fp-boton fp-boton--primario" onClick={onEditar}>
                <Pencil size={15} aria-hidden="true" />
                Editar
              </button>
            )}
          </div>
        </footer>
      </article>
    </div>
  )
}