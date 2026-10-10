import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Plus,
  Minus,
  Check,
  CheckCircle2,
  AlertCircle,
  Candy,
  Info,
  Lock,
  ArrowLeft,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Package,
  Hash,
  Loader2,
  RotateCcw,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { getUsuarioActual } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { registrarMovimiento, mensajeDelBackend } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'
import '../styles/correccion-inventario.css'
import { notificar } from '../services/notificar'

const POR_PAGINA = 15

const MOTIVOS = [
  'Conteo físico de fin de mes',
  'Conteo semanal',
  'Revisión por descuadre',
  'Error en una captura anterior',
  'Otro',
]

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redondear(n) {
  return Math.round(n * 100) / 100
}

// Números de página con puntos suspensivos: 1 … 4 5 6 … 40
function paginasVisibles(total, actual) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const paginas = [1]
  const desde = Math.max(2, actual - 1)
  const hasta = Math.min(total - 1, actual + 1)

  if (desde > 2) paginas.push('…')
  for (let n = desde; n <= hasta; n++) paginas.push(n)
  if (hasta < total - 1) paginas.push('…')

  paginas.push(total)
  return paginas
}

function Diferencia({ fila }) {
  if (!fila.contado) return <span className="ci-dif ci-dif--vacio">—</span>
  if (fila.diferencia === 0) return <span className="ci-dif ci-dif--igual">Sin diferencia</span>

  const unidad = textoUnidad(fila.unidad, fila.diferencia)
  if (fila.diferencia < 0) {
    return (
      <span className="ci-dif ci-dif--falta">
        {fila.diferencia} {unidad}
      </span>
    )
  }
  return (
    <span className="ci-dif ci-dif--sobra">
      +{fila.diferencia} {unidad}
    </span>
  )
}

export default function CorreccionInventario() {
  const navigate = useNavigate()
  const inputsRef = useRef({}) // primer campo de cada renglón (conteo o "cerradas")
  const sueltasRef = useRef({}) // campo "sueltas" de la calculadora

  const [usuario, setUsuario] = useState(null)
  const [cargandoUsuario, setCargandoUsuario] = useState(true)

  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [soloDiferencia, setSoloDiferencia] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [enfocarId, setEnfocarId] = useState(null)
  const [conteos, setConteos] = useState({}) // { idProducto: '102' } en la unidad de venta
  const [abiertos, setAbiertos] = useState({}) // { idProducto: true } si se cuenta por empaque
  const [partes, setPartes] = useState({}) // { idProducto: { cerradas: '3', sueltas: '12' } }
  const [notas, setNotas] = useState({})
  const [motivo, setMotivo] = useState('')
  const [motivoOtro, setMotivoOtro] = useState('')
  const [intento, setIntento] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [aplicada, setAplicada] = useState(null) // { ok, fallidos: [{ nombre, mensaje }], motivo }

  async function cargarProductos() {
    setCargando(true)
    setErrorCarga(null)

    try {
      const lista = await listarProductos()
      setProductos(lista.filter((p) => p.activo))
    } catch (e) {
      setErrorCarga(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }

  // Solo el propietario puede usar esta pantalla
  useEffect(() => {
    getUsuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargandoUsuario(false))

    cargarProductos()
  }, [])

  // Categorías con productos, en el orden fijo de la lista de 16
  const categoriasConProductos = useMemo(() => {
    const porNombre = new Map()
    productos.forEach((p) => porNombre.set(p.categoria, p.categoriaId))
    return [...porNombre.entries()].sort((a, b) => a[1] - b[1]).map(([nombre]) => nombre)
  }, [productos])

  /* ---------- Filas y cálculos ---------- */

  const filas = productos.map((p) => {
    const sistema = p.stock
    const texto = conteos[p.id] ?? ''
    const contado = texto !== ''
    const fisico = contado ? Number(texto) : null
    const diferencia = contado ? fisico - sistema : null

    return {
      ...p,
      sistema,
      texto,
      contado,
      fisico,
      diferencia,
      porEmpaque: p.piezasEmpaque ?? null,
      empaqueNombre: p.empaque ?? 'caja',
    }
  })

  const textoBusqueda = normalizar(busqueda.trim())
  const visibles = filas.filter((f) => {
    if (textoBusqueda && !normalizar(`${f.nombre} ${f.marca}`).includes(textoBusqueda)) return false
    if (categoria !== 'Todas' && f.categoria !== categoria) return false
    if (soloDiferencia && !f.diferencia) return false
    return true
  })

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const enPagina = visibles.slice(inicio, inicio + POR_PAGINA)

  // Resumen (por productos, porque no se pueden sumar bolsas con piezas)
  const contadas = filas.filter((f) => f.contado)
  const conDiferencia = filas.filter((f) => f.diferencia) // distinto de 0 y de null
  const conFaltante = conDiferencia.filter((f) => f.diferencia < 0).length
  const conSobrante = conDiferencia.filter((f) => f.diferencia > 0).length
  const impacto = redondear(conDiferencia.reduce((suma, f) => suma + f.diferencia * (f.costo ?? 0), 0))

  const motivoFinal = motivo === 'Otro' ? motivoOtro.trim() : motivo
  const puedeAplicar = conDiferencia.length > 0 && !!motivoFinal
  const errorMotivo = intento && !motivoFinal

  // Enfoca un campo en cuanto se dibuja (Enter entre páginas o al abrir la calculadora)
  useEffect(() => {
    if (enfocarId === null) return
    inputsRef.current[enfocarId]?.focus()
    setEnfocarId(null)
  }, [enfocarId, paginaActual])

  /* ---------- Filtros (regresan a la página 1) ---------- */

  function cambiarBusqueda(valor) {
    setBusqueda(valor)
    setPagina(1)
  }

  function cambiarCategoria(valor) {
    setCategoria(valor)
    setPagina(1)
  }

  function alternarSoloDiferencia() {
    setSoloDiferencia((v) => !v)
    setPagina(1)
  }

  /* ---------- Captura del conteo ---------- */

  function ponerConteo(id, texto) {
    setConteos((c) => ({ ...c, [id]: texto }))
    setAplicada(null)
  }

  function cambiarConteo(id, valor) {
    ponerConteo(id, valor.replace(/\D/g, ''))
  }

  function ajustar(fila, delta) {
    const base = fila.contado ? fila.fisico : fila.sistema
    ponerConteo(fila.id, String(Math.max(0, base + delta)))
  }

  function repartir(fila, total) {
    return {
      cerradas: String(Math.floor(total / fila.porEmpaque)),
      sueltas: String(total % fila.porEmpaque),
    }
  }

  function coincide(fila) {
    if (abiertos[fila.id] && fila.porEmpaque) {
      setPartes((p) => ({ ...p, [fila.id]: repartir(fila, fila.sistema) }))
    }
    ponerConteo(fila.id, String(fila.sistema))
  }

  function alternarEmpaque(fila) {
    const abierto = !!abiertos[fila.id]

    if (!abierto) {
      setPartes((p) => ({
        ...p,
        [fila.id]: fila.contado ? repartir(fila, fila.fisico) : { cerradas: '', sueltas: '' },
      }))
    }

    setAbiertos((a) => ({ ...a, [fila.id]: !abierto }))
    setEnfocarId(fila.id)
  }

  function cambiarParte(fila, campo, valor) {
    const limpio = valor.replace(/\D/g, '')
    const actuales = { cerradas: '', sueltas: '', ...partes[fila.id], [campo]: limpio }

    setPartes((p) => ({ ...p, [fila.id]: actuales }))

    if (actuales.cerradas === '' && actuales.sueltas === '') {
      ponerConteo(fila.id, '')
    } else {
      const total = Number(actuales.cerradas || 0) * fila.porEmpaque + Number(actuales.sueltas || 0)
      ponerConteo(fila.id, String(total))
    }
  }

  // Enter salta al siguiente producto, aunque esté en la siguiente página
  function teclaConteo(event, id) {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const indice = visibles.findIndex((f) => f.id === id)
    const siguiente = visibles[indice + 1]
    if (!siguiente) return

    const paginaSiguiente = Math.floor((indice + 1) / POR_PAGINA) + 1

    if (paginaSiguiente !== paginaActual) {
      setPagina(paginaSiguiente)
      setEnfocarId(siguiente.id)
    } else {
      inputsRef.current[siguiente.id]?.focus()
    }
  }

  /* ---------- Aplicar ---------- */

  function pedirAplicar() {
    setIntento(true)
    if (puedeAplicar) setConfirmar(true)
  }

  async function aplicarCorreccion() {
    setConfirmar(false)
    if (!puedeAplicar) return

    setAplicando(true)

    const fallidos = []
    let ok = 0

    // Una corrección por producto; si una falla, las demás sí se guardan
    for (const f of conDiferencia) {
      const nota = (notas[f.id] ?? '').trim()

      try {
        await registrarMovimiento({
          producto: f.id,
          tipo_movimiento: 'correccion',
          cantidad: f.diferencia, // con signo: + sobrante, - faltante
          motivo: nota ? `${motivoFinal} · ${nota}` : motivoFinal,
        })
        ok += 1
      } catch (e) {
        fallidos.push({ id: f.id, nombre: f.nombre, mensaje: mensajeDelBackend(e) ?? mensajeDeError(e) })
      }
    }

    // Conserva el conteo solo de los que fallaron, para reintentar
    const idsFallidos = new Set(fallidos.map((x) => x.id))
    setConteos((c) => Object.fromEntries(Object.entries(c).filter(([id]) => idsFallidos.has(Number(id)))))
    setNotas((n) => Object.fromEntries(Object.entries(n).filter(([id]) => idsFallidos.has(Number(id)))))
    setAbiertos({})
    setPartes({})

    if (fallidos.length === 0) {
      setMotivo('')
      setMotivoOtro('')
    }

    setIntento(false)
    setAplicada({ ok, fallidos, motivo: motivoFinal })
    if (ok > 0) {
      notificar({ texto: `Corrección aplicada · ${ok} ${ok === 1 ? 'producto ajustado' : 'productos ajustados'}` })
    }
    setAplicando(false)

    // Trae el stock ya corregido
    cargarProductos()
  }

  function descartar() {
    setConteos({})
    setAbiertos({})
    setPartes({})
    setNotas({})
    setMotivo('')
    setMotivoOtro('')
    setIntento(false)
  }

  /* ---------- Sin permiso ---------- */

  if (cargandoUsuario) return null

  if (usuario?.rol !== 'propietario') {
    return (
      <div className="ci">
        <div className="ci-panel ci-bloqueado">
          <span className="ci-bloqueado__icono" aria-hidden="true">
            <Lock size={26} />
          </span>
          <h1>Solo el propietario puede corregir el inventario</h1>
          <p>Si el conteo físico no cuadra con el sistema, avísale al dueño del negocio para que lo revise.</p>
          <button type="button" className="ci-boton ci-boton--secundario" onClick={() => navigate('/panel')}>
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al panel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ci">
      {/* ============ ENCABEZADO ============ */}
      <header className="ci-encabezado">
        <h1 className="ci-titulo">Corrección de inventario</h1>
        <span className="ci-propietario">
          <Lock size={13} aria-hidden="true" />
          Solo propietario
        </span>
        {!cargando && !errorCarga && (
          <span className="ci-progreso">
            Contados <strong>{contadas.length}</strong> de <strong>{filas.length}</strong>
          </span>
        )}
      </header>

      <p className="ci-info">
        <Info size={17} aria-hidden="true" />
        <span>
          Captura lo que contaste físicamente, en la unidad en que vendes cada producto. Si te llegó en caja o bolsa y la
          tienes cerrada, usa <strong>"Contar por caja"</strong>: no hace falta abrirla. Lo que dejes en blanco{' '}
          <strong>no cambia</strong>.
        </span>
      </p>

      {aplicada && aplicada.fallidos.length > 0 && (
        <div className="ci-fallidos" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>
              {aplicada.fallidos.length === 1
                ? 'Un producto no se pudo corregir:'
                : `${aplicada.fallidos.length} productos no se pudieron corregir:`}
            </strong>
            <ul>
              {aplicada.fallidos.map((x) => (
                <li key={x.id}>
                  {x.nombre}: {x.mensaje}
                </li>
              ))}
            </ul>
            <span>Su conteo sigue capturado para que lo revises y vuelvas a aplicar.</span>
          </div>
        </div>
      )}

      {/* ============ FILTROS ============ */}
      <section className="ci-panel">
        <div className="ci-filtros">
          <div className="ci-buscador">
            <Search size={16} className="ci-buscador__icono" aria-hidden="true" />
            <input
              type="text"
              placeholder="Busca por nombre o marca…"
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              aria-label="Buscar producto"
            />
            {busqueda && (
              <button
                type="button"
                className="ci-buscador__limpiar"
                onClick={() => cambiarBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="ci-categorias">
            <button
              type="button"
              className={'ci-categoria' + (categoria === 'Todas' ? ' is-activa' : '')}
              onClick={() => cambiarCategoria('Todas')}
            >
              Todas
            </button>
            {categoriasConProductos.map((c) => (
              <button
                key={c}
                type="button"
                className={'ci-categoria' + (categoria === c ? ' is-activa' : '')}
                onClick={() => cambiarCategoria(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={soloDiferencia}
            className={'ci-interruptor' + (soloDiferencia ? ' is-on' : '')}
            onClick={alternarSoloDiferencia}
          >
            <span className="ci-interruptor__pista" aria-hidden="true" />
            Solo con diferencia
          </button>
        </div>
      </section>

      {/* ============ TABLA ============ */}
      <section className="ci-panel ci-panel--tabla">
        {cargando ? (
          <div className="ci-sin-resultados">
            <Loader2 size={26} className="ci-girando" aria-hidden="true" />
            Cargando productos…
          </div>
        ) : errorCarga ? (
          <div className="ci-sin-resultados">
            <AlertCircle size={26} aria-hidden="true" />
            {errorCarga}
            <button type="button" className="ci-boton ci-boton--secundario" onClick={cargarProductos}>
              <RotateCcw size={15} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <div className="ci-sin-resultados">
            <SearchX size={26} aria-hidden="true" />
            {soloDiferencia && conDiferencia.length === 0
              ? 'Todavía no hay productos con diferencia.'
              : 'No encontramos productos con esos filtros.'}
          </div>
        ) : (
          <>
            <table className="ci-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>En sistema</th>
                  <th>Conteo físico</th>
                  <th>Diferencia</th>
                  <th>Nota (opcional)</th>
                </tr>
              </thead>
              <tbody>
                {enPagina.map((f) => {
                  const claseFila = f.diferencia < 0 ? 'ci-fila--falta' : f.diferencia > 0 ? 'ci-fila--sobra' : ''
                  const abierto = !!abiertos[f.id] && !!f.porEmpaque
                  const partesFila = partes[f.id] ?? { cerradas: '', sueltas: '' }

                  return (
                    <tr key={f.id} className={claseFila}>
                      <td>
                        <div className="ci-producto">
                          <span className="ci-placeholder" aria-hidden="true">
                            <Candy size={16} />
                          </span>
                          <div>
                            <p className="ci-producto__nombre">{f.nombre}</p>
                            <p className="ci-producto__marca">{f.marca ? `${f.marca} · ${f.categoria}` : f.categoria}</p>
                          </div>
                        </div>
                      </td>

                      <td className="ci-sistema">
                        {f.sistema}
                        <span>{textoUnidad(f.unidad, f.sistema)}</span>
                      </td>

                      <td>
                        <div className="ci-conteo-celda">
                          {abierto ? (
                            <div className="ci-empaque">
                              <input
                                ref={(el) => {
                                  inputsRef.current[f.id] = el
                                }}
                                type="text"
                                inputMode="numeric"
                                className="ci-empaque__input"
                                placeholder="0"
                                value={partesFila.cerradas}
                                onChange={(e) => cambiarParte(f, 'cerradas', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    sueltasRef.current[f.id]?.focus()
                                  }
                                }}
                                aria-label={`${textoUnidad(f.empaqueNombre, 2, true)} cerradas de ${f.nombre}`}
                              />
                              <span className="ci-empaque__texto">
                                {textoUnidad(f.empaqueNombre, 2, true)} × {f.porEmpaque}
                              </span>
                              <span className="ci-empaque__signo">+</span>
                              <input
                                ref={(el) => {
                                  sueltasRef.current[f.id] = el
                                }}
                                type="text"
                                inputMode="numeric"
                                className="ci-empaque__input"
                                placeholder="0"
                                value={partesFila.sueltas}
                                onChange={(e) => cambiarParte(f, 'sueltas', e.target.value)}
                                onKeyDown={(e) => teclaConteo(e, f.id)}
                                aria-label={`Sueltas de ${f.nombre}`}
                              />
                              <span className="ci-empaque__texto">sueltas</span>
                              <span className="ci-empaque__signo">=</span>
                              <strong className="ci-empaque__total">{f.contado ? f.fisico : '—'}</strong>
                            </div>
                          ) : (
                            <div className="ci-conteo">
                              <div className="ci-conteo__grupo">
                                <button type="button" onClick={() => ajustar(f, -1)} aria-label={`Una menos de ${f.nombre}`}>
                                  <Minus size={14} />
                                </button>
                                <input
                                  ref={(el) => {
                                    inputsRef.current[f.id] = el
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Contar"
                                  value={f.texto}
                                  onChange={(e) => cambiarConteo(f.id, e.target.value)}
                                  onKeyDown={(e) => teclaConteo(e, f.id)}
                                  aria-label={`Conteo físico de ${f.nombre}`}
                                />
                                <button type="button" onClick={() => ajustar(f, 1)} aria-label={`Una más de ${f.nombre}`}>
                                  <Plus size={14} />
                                </button>
                              </div>

                              {!f.contado && (
                                <button
                                  type="button"
                                  className="ci-coincide"
                                  onClick={() => coincide(f)}
                                  title="Coincide con el sistema"
                                  aria-label={`${f.nombre} coincide con el sistema`}
                                >
                                  <Check size={15} />
                                </button>
                              )}
                            </div>
                          )}

                          {f.porEmpaque && (
                            <button type="button" className="ci-modo" onClick={() => alternarEmpaque(f)}>
                              {abierto ? (
                                <>
                                  <Hash size={12} aria-hidden="true" />
                                  Contar por {textoUnidad(f.unidad, 1, true)}
                                </>
                              ) : (
                                <>
                                  <Package size={12} aria-hidden="true" />
                                  Contar por {f.empaqueNombre}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        <Diferencia fila={f} />
                      </td>

                      <td>
                        <input
                          type="text"
                          className="ci-nota"
                          placeholder={f.diferencia ? 'Ej. bolsa rota en bodega' : 'Opcional…'}
                          maxLength={120}
                          value={notas[f.id] ?? ''}
                          disabled={!f.diferencia}
                          onChange={(e) => setNotas((n) => ({ ...n, [f.id]: e.target.value }))}
                          aria-label={`Nota de ${f.nombre}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* ============ PAGINACIÓN ============ */}
            <div className="ci-paginacion">
              <span>
                Mostrando{' '}
                <strong>
                  {inicio + 1}–{Math.min(inicio + POR_PAGINA, visibles.length)}
                </strong>{' '}
                de <strong>{visibles.length}</strong> productos
              </span>

              {totalPaginas > 1 && (
                <div className="ci-paginacion__botones">
                  <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                    <ChevronLeft size={15} aria-hidden="true" />
                    Anterior
                  </button>

                  {paginasVisibles(totalPaginas, paginaActual).map((n, i) =>
                    n === '…' ? (
                      <span key={`puntos-${i}`} className="ci-paginacion__puntos">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        className={'ci-pagina' + (n === paginaActual ? ' is-activa' : '')}
                        onClick={() => setPagina(n)}
                        aria-current={n === paginaActual ? 'page' : undefined}
                      >
                        {n}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPagina(paginaActual + 1)}
                  >
                    Siguiente
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ============ BARRA FIJA ============ */}
      <footer className="ci-barra">
        <div className="ci-resumen">
          <p className="ci-resumen__titulo">
            {conDiferencia.length} {conDiferencia.length === 1 ? 'producto' : 'productos'} con diferencia
          </p>
          <div className="ci-resumen__fila">
            <span className="ci-falta">{conFaltante} con faltante</span>
            <span className="ci-sobra">{conSobrante} con sobrante</span>
          </div>
          <span className="ci-resumen__impacto">
            Impacto estimado
            <strong className={impacto < 0 ? 'ci-impacto--negativo' : impacto > 0 ? 'ci-impacto--positivo' : ''}>
              {impacto > 0 ? '+' : ''}
              {moneda.format(impacto)}
            </strong>
          </span>
        </div>

        <div className="ci-motivo">
          <label className="ci-etiqueta" htmlFor="ci-motivo">
            Motivo de la corrección <span className="ci-requerido">*</span>
          </label>
          <div className="ci-motivo__campos">
            <select
              id="ci-motivo"
              className={errorMotivo && !motivo ? 'is-error' : ''}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="">Elige un motivo</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {motivo === 'Otro' && (
              <input
                type="text"
                className={errorMotivo ? 'is-error' : ''}
                placeholder="Escribe el motivo"
                maxLength={60}
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                aria-label="Motivo de la corrección"
              />
            )}
          </div>
          {errorMotivo && (
            <p className="ci-error">
              <AlertCircle size={13} aria-hidden="true" />
              {motivo === 'Otro' ? 'Escribe el motivo' : 'Elige el motivo de la corrección'}
            </p>
          )}
        </div>

        <div className="ci-botones">
          <button
            type="button"
            className="ci-boton ci-boton--secundario"
            disabled={contadas.length === 0 || aplicando}
            onClick={descartar}
          >
            Descartar conteo
          </button>
          <button
            type="button"
            className="ci-boton ci-boton--primario"
            disabled={conDiferencia.length === 0 || aplicando}
            onClick={pedirAplicar}
          >
            {aplicando ? (
              <Loader2 size={17} className="ci-girando" aria-hidden="true" />
            ) : (
              <Check size={17} aria-hidden="true" />
            )}
            {aplicando ? 'Aplicando…' : 'Aplicar corrección'}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmar}
        title="¿Aplicar la corrección?"
        message={`Se ajustará el stock de ${conDiferencia.length} ${
          conDiferencia.length === 1 ? 'producto' : 'productos'
        } (${conFaltante} con faltante, ${conSobrante} con sobrante). Quedará registrado en el historial a tu nombre y ya no se podrá borrar.`}
        confirmText="Sí, aplicar"
        cancelText="Revisar"
        tone="danger"
        onConfirm={aplicarCorreccion}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}