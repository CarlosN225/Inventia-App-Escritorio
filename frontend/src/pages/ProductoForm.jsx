import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAjustes } from '../hooks/useConfiguracion'

import {
  ChevronRight,
  Package,
  Tag,
  Boxes,
  Box,
  Warehouse,
  CalendarDays,
  Barcode,
  Percent,
  Eye,
  BarChart3,
  ImagePlus,
  Save,
  Plus,
  Trash2,
  Candy,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Info,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import {
  obtenerProducto,
  listarCategorias,
  aDatosBackend,
  crearProducto,
  actualizarProducto,
  erroresDeCampos,
  mensajeDeError,
  listarPromociones,
  crearPromocion,
  cambiarActivaPromocion,
  borrarPromocion,
} from '../services/productos'
import '../styles/producto-form.css'


const UNIDADES = [
  { id: 'pieza', label: 'Pieza', plural: 'piezas' },
  { id: 'bolsa', label: 'Bolsa', plural: 'bolsas' },
  { id: 'caja', label: 'Caja', plural: 'cajas' },
  { id: 'paquete', label: 'Paquete', plural: 'paquetes' },
]

const EMPAQUES = [
  { id: 'caja', label: 'Caja' },
  { id: 'bolsa', label: 'Bolsa' },
  { id: 'paquete', label: 'Paquete' },
]

const MAX_NOMBRE = 80
const MAX_IMAGEN_MB = 4
const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp']

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const mesActual = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date())

function aFecha(iso) {
  return new Date(`${iso}T00:00:00`)
}

function diasHasta(iso) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((aFecha(iso) - hoy) / 86400000)
}

function aTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor)
}
// "2026-10-09" de hoy, para que los calendarios no dejen elegir días pasados
function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Arma el formulario a partir de un producto del backend (ya traducido)
function crearFormulario(producto) {
  return {
    nombre: producto?.nombre ?? '',
    marca: producto?.marca ?? '',
    categoria: producto ? String(producto.categoriaId) : '',
    descripcion: producto?.descripcion ?? '',
    precio: aTexto(producto?.precio),
    precioMayoreo: aTexto(producto?.precioMayoreo),
    minimoMayoreo: aTexto(producto?.minimoMayoreo),
    unidad: producto?.unidad ?? 'pieza',
    piezasEmpaque: aTexto(producto?.piezasEmpaque),
    tipoEmpaque: producto?.empaque ?? 'caja',
    stock: producto ? String(producto.stock) : '0',
    minimo: aTexto(producto?.minimo),
    maximo: aTexto(producto?.maximo),
    fechaCaducidad: producto?.fechaCaducidad ?? '',
    codigoBarras: producto?.codigoBarras ?? '',
  }
}

function validar(f, CONFIG) {
  const errores = {}
  const precio = Number(f.precio)

  if (!f.nombre.trim()) errores.nombre = 'Escribe el nombre del producto'
  if (!f.categoria) errores.categoria = 'Elige una categoría'
  if (f.precio === '' || precio <= 0) errores.precio = 'El precio debe ser mayor a $0'
  if (f.stock === '' || Number(f.stock) < 0) errores.stock = 'El stock no puede ser negativo'
  if (f.minimo === '' || Number(f.minimo) < 0) errores.minimo = 'Indica el stock mínimo'

  if (f.maximo !== '' && Number(f.maximo) <= Number(f.minimo)) {
    errores.maximo = 'Debe ser mayor que el stock mínimo'
  }

  if (f.piezasEmpaque !== '' && Number(f.piezasEmpaque) < 1) {
    errores.piezasEmpaque = 'Debe ser al menos 1'
  }

  // El mayoreo es opcional, pero si se llena se llenan los dos campos
  if (CONFIG.vende_mayoreo && (f.precioMayoreo !== '' || f.minimoMayoreo !== '')) {
    if (f.precioMayoreo === '' || Number(f.precioMayoreo) <= 0) {
      errores.precioMayoreo = 'Indica el precio de mayoreo'
    } else if (precio > 0 && Number(f.precioMayoreo) >= precio) {
      errores.precioMayoreo = 'Debe ser menor al precio normal'
    }

    if (f.minimoMayoreo === '' || Number(f.minimoMayoreo) < 2) {
      errores.minimoMayoreo = 'Mínimo 2 piezas'
    }
  }

  return errores
}

function nivelMargen(porcentaje) {
  if (porcentaje === null) return null
  if (porcentaje < 0) return { clase: 'malo', texto: 'Vendes por debajo del costo' }
  if (porcentaje < 15) return { clase: 'malo', texto: 'Margen bajo' }
  if (porcentaje < 30) return { clase: 'regular', texto: 'Margen ajustado' }
  return { clase: 'bueno', texto: 'Margen saludable' }
}

function estadoPromo(p) {
  if (diasHasta(p.fin) < 0) return { clase: 'gris', texto: 'Terminada' }
  if (diasHasta(p.inicio) > 0) return { clase: 'azul', texto: 'Programada' }
  if (!p.activa) return { clase: 'gris', texto: 'Pausada' }
  return { clase: 'ok', texto: 'Activa' }
}

function textoPromo(p) {
  return p.tipo === 'porcentaje' ? `Descuento ${p.valor}%` : `Descuento de ${moneda.format(p.valor)}`
}

/* ---------- Piezas reutilizables ---------- */

function Seccion({ icono: Icono, titulo, extra, completa, children }) {
  return (
    <section className={'pf-panel' + (completa ? ' pf-seccion--completa' : '')}>
      <header className="pf-seccion__cabecera">
        <h2 className="pf-seccion__titulo">
          <span className="pf-seccion__icono" aria-hidden="true">
            <Icono size={16} />
          </span>
          {titulo}
        </h2>
        {extra}
      </header>
      {children}
    </section>
  )
}

function Campo({ etiqueta, htmlFor, requerido, ayuda, error, contador, children }) {
  return (
    <div className="pf-campo">
      <div className="pf-campo__fila">
        <label className="pf-etiqueta" htmlFor={htmlFor}>
          {etiqueta}
          {requerido && <span className="pf-requerido"> *</span>}
        </label>
        {contador}
      </div>

      {children}

      {error ? (
        <p className="pf-error">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : (
        ayuda && <p className="pf-ayuda">{ayuda}</p>
      )}
    </div>
  )
}

function Pendiente({ texto }) {
  return (
    <p className="pf-pendiente">
      <Info size={14} aria-hidden="true" />
      {texto}
    </p>
  )
}

/* ---------- Pantalla ---------- */

export default function ProductoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const esNuevo = !id
  const CONFIG = useAjustes() // lo que el dueño prendió en Configuración

  // Datos del backend
  const [producto, setProducto] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null) // null | 'no-encontrado' | mensaje

  const [usuarioActual, setUsuarioActual] = useState(null)
  const [cargandoUsuario, setCargandoUsuario] = useState(true)

  // Formulario
  const [form, setForm] = useState(() => crearFormulario(null))
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)

  // Imagen y promociones (todavía no se guardan en el backend)
  const [promociones, setPromociones] = useState([])
  const [nuevaPromo, setNuevaPromo] = useState(null)
  const [errorPromo, setErrorPromo] = useState('')
  const [imagen, setImagen] = useState(null)
  const [errorImagen, setErrorImagen] = useState('')
  const [incluirImagen, setIncluirImagen] = useState(false)

  const inputImagenRef = useRef(null)

  // Usuario con la sesión abierta (para saber si es propietario)
  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))
      .finally(() => setCargandoUsuario(false))
  }, [])

  // Categorías y, si es edición, el producto
  useEffect(() => {
    let sigueMontado = true

    async function cargar() {
      setCargando(true)
      setErrorCarga(null)

      try {
                const [listaCategorias, productoBackend, listaPromos] = await Promise.all([
          listarCategorias(),
          esNuevo ? Promise.resolve(null) : obtenerProducto(id),
          esNuevo ? Promise.resolve([]) : listarPromociones(id),
        ])

        if (sigueMontado) setPromociones(listaPromos)

        setCategorias(listaCategorias)
        setProducto(productoBackend)
        setForm(crearFormulario(productoBackend))
      } catch (e) {
        if (!sigueMontado) return
        setErrorCarga(e.response?.status === 404 ? 'no-encontrado' : mensajeDeError(e))
      } finally {
        if (sigueMontado) setCargando(false)
      }
    }

    cargar()

    return () => {
      sigueMontado = false
    }
  }, [id, esNuevo])

  // Libera la memoria de la imagen anterior cuando se cambia o se quita
  useEffect(() => {
    return () => {
      if (imagen) URL.revokeObjectURL(imagen.url)
    }
  }, [imagen])

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))

    if (errores[campo]) {
      setErrores((e) => {
        const copia = { ...e }
        delete copia[campo]
        return copia
      })
    }
  }

  /* ---------- Imagen ---------- */

  function procesarArchivo(archivo) {
    if (!archivo) return

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      setErrorImagen('Usa una imagen JPG, PNG o WebP')
      return
    }

    if (archivo.size > MAX_IMAGEN_MB * 1024 * 1024) {
      setErrorImagen(`La imagen pesa más de ${MAX_IMAGEN_MB} MB`)
      return
    }

    setErrorImagen('')
    setImagen({ url: URL.createObjectURL(archivo), nombre: archivo.name })
  }

  function elegirImagen(event) {
    procesarArchivo(event.target.files?.[0])
    event.target.value = ''
  }

  function soltarImagen(event) {
    event.preventDefault()
    procesarArchivo(event.dataTransfer.files?.[0])
  }

  function elegirConImagen() {
    setIncluirImagen(true)
    inputImagenRef.current?.click()
  }

  function elegirSinImagen() {
    setIncluirImagen(false)
    setImagen(null)
    setErrorImagen('')
  }

  /* ---------- Promociones (vista previa, aún no se guardan) ---------- */

  function abrirNuevaPromo() {
    setNuevaPromo({ tipo: 'porcentaje', valor: '', inicio: '', fin: '' })
    setErrorPromo('')
  }

  function cambiarPromo(campo, valor) {
    setNuevaPromo((p) => ({ ...p, [campo]: valor }))
    setErrorPromo('')
  }
 
   async function agregarPromo() {
    const valor = Number(nuevaPromo.valor)

    if (!valor || valor <= 0) return setErrorPromo('Escribe el valor del descuento')
    if (nuevaPromo.tipo === 'porcentaje' && valor > 90) return setErrorPromo('El descuento no puede pasar de 90%')
    if (nuevaPromo.tipo === 'monto' && precio > 0 && valor >= precio) {
      return setErrorPromo('El descuento debe ser menor al precio de venta')
    }
    if (nuevaPromo.inicio < hoyISO()) return setErrorPromo('La promoción no puede empezar en una fecha que ya pasó')    
    if (nuevaPromo.fin < nuevaPromo.inicio) return setErrorPromo('La fecha de fin debe ser después del inicio')

    const promo = { tipo: nuevaPromo.tipo, valor, inicio: nuevaPromo.inicio, fin: nuevaPromo.fin, activa: true }

    // Producto nuevo: se guarda junto con el producto. Producto existente: se guarda ya.
    if (esNuevo) {
      setPromociones((lista) => [...lista, { ...promo, id: `nueva-${Date.now()}` }])
      setNuevaPromo(null)
      return
    }

    try {
      const creada = await crearPromocion(producto.id, promo)
      setPromociones((lista) => [...lista, creada])
      setNuevaPromo(null)
    } catch (e) {
      const datos = e.response?.data
      const primero = datos && typeof datos === 'object' ? Object.values(datos)[0] : null
      setErrorPromo(primero ? String([].concat(primero)[0]) : mensajeDeError(e))
    }
  }

  async function alternarPromo(idPromo) {
    const promo = promociones.find((p) => p.id === idPromo)
    if (!promo) return

    if (esNuevo) {
      setPromociones((lista) => lista.map((p) => (p.id === idPromo ? { ...p, activa: !p.activa } : p)))
      return
    }

    try {
      const actualizada = await cambiarActivaPromocion(idPromo, !promo.activa)
      setPromociones((lista) => lista.map((p) => (p.id === idPromo ? actualizada : p)))
    } catch (e) {
      setErrorPromo(mensajeDeError(e))
    }
  }

  async function eliminarPromo(idPromo) {
    if (esNuevo) {
      setPromociones((lista) => lista.filter((p) => p.id !== idPromo))
      return
    }

    try {
      await borrarPromocion(idPromo)
      setPromociones((lista) => lista.filter((p) => p.id !== idPromo))
    } catch (e) {
      setErrorPromo(mensajeDeError(e))
    }
  }

  /* ---------- Guardar ---------- */

  async function guardar(event) {
    event.preventDefault()
    setErrorGuardar(null)

    const nuevosErrores = validar(form, CONFIG)

        // Una caducidad pasada solo se acepta si ya la tenía (para poder editar otras cosas de un producto vencido)
    if (
      form.fechaCaducidad &&
      form.fechaCaducidad < hoyISO() &&
      form.fechaCaducidad !== (producto?.fechaCaducidad ?? '')
    ) {
      nuevosErrores.fechaCaducidad = 'Esa fecha ya pasó; elige una de hoy en adelante'
    }
    setErrores(nuevosErrores)

    if (Object.keys(nuevosErrores).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setGuardando(true)

    try {
      const datos = aDatosBackend(form, esNuevo)

             const resultado = esNuevo
        ? await crearProducto(datos)
        : await actualizarProducto(producto.id, datos)

      // Las promociones que se capturaron en un producto nuevo se guardan ya que existe
      if (esNuevo) {
        for (const promo of promociones) {
          await crearPromocion(resultado.id, promo)
        }
      }

      // TODO: guardar la imagen cuando exista su endpoint
      // Regresa al catálogo con la notificación y el producto resaltado
      navigate('/catalogo', {
        state: {
          aviso: {
            tipo: 'ok',
            texto: esNuevo
              ? `${resultado.nombre} se agregó al catálogo.`
              : `${resultado.nombre} se actualizó.`,
          },
          resaltar: resultado.id,
        },
      })
    } catch (e) {
      const deCampos = erroresDeCampos(e)

      if (deCampos) {
        setErrores(deCampos)
      } else {
        setErrorGuardar(mensajeDeError(e))
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setGuardando(false)
    }
  }

  /* ---------- Cálculos en vivo ---------- */

  const precio = Number(form.precio) || 0
  const costo = producto?.costo ?? null
  const utilidad = costo !== null ? precio - costo : null
  const margenPct = costo !== null && precio > 0 ? Math.round((utilidad / precio) * 100) : null
  const margenInfo = nivelMargen(margenPct)

  const unidad = UNIDADES.find((u) => u.id === form.unidad) ?? UNIDADES[0]
  const empaque = EMPAQUES.find((e) => e.id === form.tipoEmpaque) ?? EMPAQUES[0]
  const piezasEmpaque = Number(form.piezasEmpaque) || 0
  const minimoMayoreo = Number(form.minimoMayoreo) || 0
  const empaquesMayoreo =
    piezasEmpaque > 0 && minimoMayoreo > 0 && minimoMayoreo % piezasEmpaque === 0
      ? minimoMayoreo / piezasEmpaque
      : null

  const stockActual = Number(form.stock) || 0
  const stockMinimo = Number(form.minimo) || 0
  const estadoStock =
    stockActual === 0
      ? { clase: 'error', texto: 'Agotado' }
      : stockActual < stockMinimo
        ? { clase: 'aviso', texto: 'Stock bajo' }
        : { clase: 'ok', texto: 'Existencias saludables' }

  const diasCaducidad = form.fechaCaducidad ? diasHasta(form.fechaCaducidad) : null
  const estadoCaducidad =
    diasCaducidad === null
      ? null
      : diasCaducidad < 0
        ? { clase: 'error', texto: 'Vencido' }
        : diasCaducidad <= 30
          ? { clase: 'aviso', texto: `Caduca en ${diasCaducidad} días` }
          : { clase: 'ok', texto: 'Vigente' }

  const hayErrores = Object.keys(errores).length > 0

  /* ---------- Solo el propietario puede entrar ---------- */

  if (cargandoUsuario) return null

  if (usuarioActual?.rol !== 'propietario') {
    return (
      <div className="pf">
        <div className="pf-panel pf-no-encontrado">
          <h1 className="pf-titulo">Solo el propietario puede dar de alta o editar productos</h1>
          <p>Si necesitas agregar o cambiar un producto, pídeselo al dueño.</p>
          <button type="button" className="pf-boton pf-boton--secundario" onClick={() => navigate('/catalogo')}>
            <ArrowLeft size={15} aria-hidden="true" />
            Volver al catálogo
          </button>
        </div>
      </div>
    )
  }

  /* ---------- Cargando o con error ---------- */

  if (cargando) {
    return (
      <div className="pf">
        <div className="pf-panel pf-no-encontrado">
          <Loader2 size={24} className="pf-girando" aria-hidden="true" />
          <p>{esNuevo ? 'Preparando el formulario…' : 'Cargando producto…'}</p>
        </div>
      </div>
    )
  }

  if (errorCarga) {
    return (
      <div className="pf">
        <div className="pf-panel pf-no-encontrado">
          <h1 className="pf-titulo">
            {errorCarga === 'no-encontrado' ? 'Producto no encontrado' : 'No pudimos cargar el producto'}
          </h1>
          <p>
            {errorCarga === 'no-encontrado'
              ? 'Puede que la dirección esté mal escrita.'
              : errorCarga}
          </p>
          <button type="button" className="pf-boton pf-boton--secundario" onClick={() => navigate('/catalogo')}>
            <ArrowLeft size={15} aria-hidden="true" />
            Volver al catálogo
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="pf" onSubmit={guardar} noValidate>
      {/* ============ ENCABEZADO ============ */}
      <header className="pf-encabezado">
        <div>
          <nav className="pf-migas" aria-label="Ruta">
            <button type="button" onClick={() => navigate('/catalogo')}>
              Catálogo
            </button>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{esNuevo ? 'Nuevo producto' : producto.nombre}</span>
          </nav>

          <div className="pf-titulo-fila">
            <h1 className="pf-titulo">{esNuevo ? 'Nuevo producto' : 'Editar producto'}</h1>
            {!esNuevo &&
              (producto.activo ? (
                <span className="pf-pastilla pf-pastilla--ok">Activo</span>
              ) : (
                <span className="pf-pastilla pf-pastilla--gris">Desactivado</span>
              ))}
          </div>
        </div>
      </header>

     

      {errorGuardar && (
        <div className="pf-aviso pf-aviso--error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {errorGuardar}
        </div>
      )}

      {hayErrores && !errorGuardar && (
        <div className="pf-aviso pf-aviso--error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          Revisa los campos marcados en rojo.
        </div>
      )}

      <div className="pf-grid">
        {/* ============ FORMULARIO ============ */}
        <div className="pf-secciones">
          {/* Información básica */}
          <Seccion icono={Package} titulo="Información básica" completa>
            <div className="pf-info">
              <div className="pf-imagen-bloque">
                <span className="pf-imagen-pregunta">¿Incluir imagen?</span>

                <div className="pf-segmentado pf-segmentado--chico" role="group" aria-label="Incluir imagen">
                  <button
                    type="button"
                    aria-pressed={!incluirImagen}
                    className={'pf-segmentado__opcion' + (!incluirImagen ? ' is-activo' : '')}
                    onClick={elegirSinImagen}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    aria-pressed={incluirImagen}
                    className={'pf-segmentado__opcion' + (incluirImagen ? ' is-activo' : '')}
                    onClick={elegirConImagen}
                  >
                    Sí
                  </button>
                </div>

                {incluirImagen ? (
                  <button
                    type="button"
                    className={'pf-imagen' + (imagen ? ' tiene-imagen' : '')}
                    onClick={() => inputImagenRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={soltarImagen}
                    aria-label="Elegir imagen del producto"
                  >
                    {imagen ? (
                      <img src={imagen.url} alt="" />
                    ) : (
                      <>
                        <ImagePlus size={24} aria-hidden="true" />
                        <span>Haz clic para elegir la imagen</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="pf-imagen pf-imagen--icono" role="img" aria-label="Sin imagen, se usa el icono">
                    <Candy size={44} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                )}

                <input
                  ref={inputImagenRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={elegirImagen}
                />

                {errorImagen ? (
                  <p className="pf-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    {errorImagen}
                  </p>
                ) : !incluirImagen ? (
                  <p className="pf-ayuda">Se mostrará este icono</p>
                ) : (
                  <Pendiente texto="La foto todavía no se guarda; se conecta muy pronto." />
                )}
              </div>

              <div className="pf-info__campos">
                <Campo
                  etiqueta="Nombre"
                  htmlFor="pf-nombre"
                  requerido
                  error={errores.nombre}
                  contador={
                    <span className="pf-contador">
                      {form.nombre.length}/{MAX_NOMBRE}
                    </span>
                  }
                >
                  <input
                    id="pf-nombre"
                    className={'pf-input' + (errores.nombre ? ' is-error' : '')}
                    value={form.nombre}
                    maxLength={MAX_NOMBRE}
                    placeholder="Ej. Mazapán De la Rosa 28g"
                    onChange={(e) => cambiar('nombre', e.target.value)}
                  />
                </Campo>

                <div className="pf-fila pf-fila--2">
                  <Campo etiqueta="Marca" htmlFor="pf-marca" error={errores.marca}>
                    <input
                      id="pf-marca"
                      className="pf-input"
                      value={form.marca}
                      placeholder="Ej. De la Rosa"
                      onChange={(e) => cambiar('marca', e.target.value)}
                    />
                  </Campo>

                  <Campo etiqueta="Categoría" htmlFor="pf-categoria" requerido error={errores.categoria}>
                    <select
                      id="pf-categoria"
                      className={'pf-input' + (errores.categoria ? ' is-error' : '')}
                      value={form.categoria}
                      onChange={(e) => cambiar('categoria', e.target.value)}
                    >
                      <option value="">Elige una categoría</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>

                <Campo etiqueta="Descripción (opcional)" htmlFor="pf-descripcion" error={errores.descripcion}>
                  <textarea
                    id="pf-descripcion"
                    className="pf-input"
                    rows={2}
                    value={form.descripcion}
                    placeholder="Tamaño, forma, material o temporada (ej. piñata circular grande)"
                    onChange={(e) => cambiar('descripcion', e.target.value)}
                  />
                </Campo>
              </div>
            </div>
          </Seccion>

          {/* Precio y costo */}
          <Seccion icono={Tag} titulo="Precio y costo" completa>
            <div className="pf-fila pf-fila--3">
              <Campo etiqueta="Precio de venta" htmlFor="pf-precio" requerido error={errores.precio}>
                <div className={'pf-grupo' + (errores.precio ? ' is-error' : '')}>
                  <span className="pf-grupo__extra">$</span>
                  <input
                    id="pf-precio"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.precio}
                    onChange={(e) => cambiar('precio', e.target.value)}
                  />
                  <span className="pf-grupo__extra">MXN</span>
                </div>
              </Campo>

              <Campo
                etiqueta="Último costo"
                htmlFor="pf-costo"
                ayuda={costo !== null && costo > 0 ? 'Se actualiza con cada compra' : 'Se llenará con la primera compra'}
              >
                <div className="pf-grupo is-lectura">
                  <span className="pf-grupo__extra">$</span>
                  <input id="pf-costo" readOnly value={costo !== null && costo > 0 ? costo.toFixed(2) : '—'} />
                  <span className="pf-grupo__extra">MXN</span>
                </div>
              </Campo>

              <div className="pf-campo">
                <span className="pf-etiqueta">Margen calculado</span>
                {margenInfo && costo > 0 ? (
                  <div className={`pf-margen pf-margen--${margenInfo.clase}`}>
                    <p className="pf-margen__valor">
                      <TrendingUp size={15} aria-hidden="true" />
                      {margenPct}% de ganancia
                    </p>
                    <p className="pf-margen__detalle">
                      {utilidad >= 0
                        ? `Ganas ${moneda.format(utilidad)} por ${unidad.label.toLowerCase()}`
                        : `Pierdes ${moneda.format(-utilidad)} por ${unidad.label.toLowerCase()}`}
                      {' · '}
                      {margenInfo.texto}
                    </p>
                  </div>
                ) : (
                  <div className="pf-margen pf-margen--vacio">
                    Se calcula cuando haya precio y un costo de compra
                  </div>
                )}
              </div>
            </div>
          </Seccion>

          {/* Venta a mayoreo */}
          {CONFIG.vende_mayoreo && (
            <Seccion
              icono={Boxes}
              titulo="Venta a mayoreo"
              extra={<span className="pf-pastilla pf-pastilla--gris">Activado en Configuración</span>}
            >
              <div className="pf-pila">
                <div className="pf-fila pf-fila--2">
                  <Campo etiqueta="Precio de mayoreo" htmlFor="pf-precio-mayoreo" error={errores.precioMayoreo}>
                    <div className={'pf-grupo' + (errores.precioMayoreo ? ' is-error' : '')}>
                      <span className="pf-grupo__extra">$</span>
                      <input
                        id="pf-precio-mayoreo"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.precioMayoreo}
                        onChange={(e) => cambiar('precioMayoreo', e.target.value)}
                      />
                    </div>
                  </Campo>

                  <Campo etiqueta="A partir de" htmlFor="pf-minimo-mayoreo" error={errores.minimoMayoreo}>
                    <div className={'pf-grupo' + (errores.minimoMayoreo ? ' is-error' : '')}>
                      <input
                        id="pf-minimo-mayoreo"
                        type="number"
                        min="2"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={form.minimoMayoreo}
                        onChange={(e) => cambiar('minimoMayoreo', e.target.value)}
                      />
                      <span className="pf-grupo__extra">{unidad.plural}</span>
                    </div>
                  </Campo>
                </div>

                <p className="pf-ayuda">
                  Se aplica solo al registrar la venta, cuando se llega a la cantidad mínima.
                  {empaquesMayoreo !== null &&
                    ` ${minimoMayoreo} ${unidad.plural} = ${empaquesMayoreo} ${empaque.label.toLowerCase()}${empaquesMayoreo === 1 ? '' : 's'}.`}
                </p>
              </div>
            </Seccion>
          )}

          {/* Unidad y empaque */}
          <Seccion icono={Box} titulo="Unidad y empaque">
            <div className="pf-pila">
              <div className="pf-campo">
                <span className="pf-etiqueta">
                  Se vende por <span className="pf-requerido">*</span>
                </span>
                <div className="pf-segmentado" role="group" aria-label="Unidad de venta">
                  {UNIDADES.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      aria-pressed={form.unidad === u.id}
                      className={'pf-segmentado__opcion' + (form.unidad === u.id ? ' is-activo' : '')}
                      onClick={() => cambiar('unidad', u.id)}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              <Campo
                etiqueta="¿Cuántas trae cada empaque del proveedor?"
                htmlFor="pf-empaque"
                error={errores.piezasEmpaque}
              >
                <div className={'pf-grupo' + (errores.piezasEmpaque ? ' is-error' : '')}>
                  <input
                    id="pf-empaque"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    placeholder="Ej. 30"
                    value={form.piezasEmpaque}
                    onChange={(e) => cambiar('piezasEmpaque', e.target.value)}
                  />
                  <span className="pf-grupo__extra">{unidad.plural}</span>
                </div>
              </Campo>

              {piezasEmpaque > 0 ? (
                <>
                  <div className="pf-campo">
                    <span className="pf-etiqueta">El proveedor lo manda en</span>
                    <div className="pf-segmentado pf-segmentado--chico" role="group" aria-label="Tipo de empaque">
                      {EMPAQUES.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={form.tipoEmpaque === e.id}
                          className={'pf-segmentado__opcion' + (form.tipoEmpaque === e.id ? ' is-activo' : '')}
                          onClick={() => cambiar('tipoEmpaque', e.id)}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <span className="pf-conversion">
                    1 {empaque.label.toLowerCase()} = {piezasEmpaque} {unidad.plural}
                  </span>
                </>
              ) : (
                <p className="pf-ayuda">Ayuda a registrar compras por caja sin hacer cuentas.</p>
              )}
            </div>
          </Seccion>

          {/* Inventario */}
          <Seccion
            icono={Warehouse}
            titulo="Inventario"
            completa
            extra={<span className={`pf-pastilla pf-pastilla--${estadoStock.clase}`}>{estadoStock.texto}</span>}
          >
            <div className="pf-fila pf-fila--3">
              <div className="pf-campo">
                <label className="pf-etiqueta" htmlFor="pf-stock">
                  {esNuevo ? 'Stock inicial' : 'Stock actual'}
                </label>
                <div className={'pf-grupo' + (esNuevo ? '' : ' is-lectura') + (errores.stock ? ' is-error' : '')}>
                  <input
                    id="pf-stock"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    readOnly={!esNuevo}
                    value={form.stock}
                    onChange={(e) => cambiar('stock', e.target.value)}
                  />
                  <span className="pf-grupo__extra">{unidad.plural}</span>
                </div>
                {errores.stock ? (
                  <p className="pf-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    {errores.stock}
                  </p>
                ) : esNuevo ? (
                  <p className="pf-ayuda">Lo que tienes hoy en el anaquel</p>
                ) : (
                  <button type="button" className="pf-enlace" onClick={() => navigate('/correccion-inventario')}>
                    ¿No cuadra? Corregir inventario
                  </button>
                )}
              </div>

              <Campo
                etiqueta="Stock mínimo"
                htmlFor="pf-minimo"
                requerido
                error={errores.minimo}
                ayuda="Te avisaremos cuando baje de aquí"
              >
                <div className={'pf-grupo' + (errores.minimo ? ' is-error' : '')}>
                  <input
                    id="pf-minimo"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={form.minimo}
                    onChange={(e) => cambiar('minimo', e.target.value)}
                  />
                  <span className="pf-grupo__extra">{unidad.plural}</span>
                </div>
              </Campo>

              <Campo
                etiqueta="Stock máximo (opcional)"
                htmlFor="pf-maximo"
                error={errores.maximo}
                ayuda="Evita comprar de más"
              >
                <div className={'pf-grupo' + (errores.maximo ? ' is-error' : '')}>
                  <input
                    id="pf-maximo"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={form.maximo}
                    onChange={(e) => cambiar('maximo', e.target.value)}
                  />
                  <span className="pf-grupo__extra">{unidad.plural}</span>
                </div>
              </Campo>
            </div>
          </Seccion>

          {/* Caducidad */}
          {CONFIG.maneja_caducidad && (
            <Seccion
              icono={CalendarDays}
              titulo="Caducidad"
              extra={
                estadoCaducidad && (
                  <span className={`pf-pastilla pf-pastilla--${estadoCaducidad.clase}`}>{estadoCaducidad.texto}</span>
                )
              }
            >
              <Campo
                etiqueta="Próxima fecha de caducidad"
                htmlFor="pf-caducidad"
                error={errores.fechaCaducidad}
                ayuda={
                  form.fechaCaducidad ? 'Se actualiza sola al registrar compras' : 'Déjalo vacío si el producto no caduca'
                }
              >
                <input
                  id="pf-caducidad"
                  type="date" min={hoyISO()}
                  className="pf-input"
                  value={form.fechaCaducidad}
                  onChange={(e) => cambiar('fechaCaducidad', e.target.value)}
                />
              </Campo>
            </Seccion>
          )}

          {/* Código de barras */}
          {CONFIG.usa_codigo_barras && (
            <Seccion
              icono={Barcode}
              titulo="Código de barras"
              extra={<span className="pf-pastilla pf-pastilla--gris">Opcional</span>}
            >
              <Campo
                etiqueta="Código EAN / UPC"
                htmlFor="pf-codigo"
                error={errores.codigoBarras}
                ayuda="Con lector USB: deja el cursor aquí y escanea"
              >
                <div className={'pf-grupo' + (errores.codigoBarras ? ' is-error' : '')}>
                  <span className="pf-grupo__extra">
                    <Barcode size={16} aria-hidden="true" />
                  </span>
                  <input
                    id="pf-codigo"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="Escanéalo o escríbelo"
                    value={form.codigoBarras}
                    onChange={(e) => cambiar('codigoBarras', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </Campo>
            </Seccion>
          )}

          {/* Promociones */}
          {CONFIG.maneja_promociones && (
            <Seccion
              icono={Percent}
              titulo="Promociones"
              completa
              extra={
                promociones.length > 0 && (
                  <span className="pf-pastilla pf-pastilla--gris">
                    {promociones.length} {promociones.length === 1 ? 'promoción' : 'promociones'}
                  </span>
                )
              }
              >
 
              {promociones.length > 0 ? (
                <ul className="pf-promos">
                  {promociones.map((p) => {
                    const estado = estadoPromo(p)

                    return (
                      <li className="pf-promo" key={p.id}>
                        <span className="pf-promo__icono" aria-hidden="true">
                          <Percent size={16} />
                        </span>

                        <div className="pf-promo__info">
                          <p className="pf-promo__titulo">
                            {textoPromo(p)}
                            <span className={`pf-pastilla pf-pastilla--${estado.clase}`}>{estado.texto}</span>
                          </p>
                          <p className="pf-promo__vigencia">
                            {fechaCorta.format(aFecha(p.inicio))} – {fechaLarga.format(aFecha(p.fin))}
                          </p>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.activa}
                          aria-label={p.activa ? 'Pausar promoción' : 'Activar promoción'}
                          className={'pf-switch' + (p.activa ? ' is-on' : '')}
                          onClick={() => alternarPromo(p.id)}
                        />

                        <button
                          type="button"
                          className="pf-icono-boton"
                          aria-label="Eliminar promoción"
                          title="Eliminar"
                          onClick={() => eliminarPromo(p.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                !nuevaPromo && (
                  <p className="pf-ayuda" style={{ marginBottom: 12 }}>
                    Este producto no tiene promociones.
                  </p>
                )
              )}

              {nuevaPromo ? (
                <div className="pf-promo-form">
                  <div className="pf-fila pf-fila--4">
                    <Campo etiqueta="Tipo" htmlFor="pf-promo-tipo">
                      <select
                        id="pf-promo-tipo"
                        className="pf-input"
                        value={nuevaPromo.tipo}
                        onChange={(e) => cambiarPromo('tipo', e.target.value)}
                      >
                        <option value="porcentaje">Porcentaje (%)</option>
                        <option value="monto">Monto fijo ($)</option>
                      </select>
                    </Campo>

                    <Campo etiqueta="Descuento" htmlFor="pf-promo-valor">
                      <div className="pf-grupo">
                        {nuevaPromo.tipo === 'monto' && <span className="pf-grupo__extra">$</span>}
                        <input
                          id="pf-promo-valor"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder={nuevaPromo.tipo === 'porcentaje' ? '10' : '1.00'}
                          value={nuevaPromo.valor}
                          onChange={(e) => cambiarPromo('valor', e.target.value)}
                          onKeyDown={enterEnPromo}
                        />
                        {nuevaPromo.tipo === 'porcentaje' && <span className="pf-grupo__extra">%</span>}
                      </div>
                    </Campo>

                    <Campo etiqueta="Inicia" htmlFor="pf-promo-inicio">
                      <input
                        id="pf-promo-inicio"
                        type="date" min={hoyISO()}
                        className="pf-input"
                        value={nuevaPromo.inicio}
                        onChange={(e) => cambiarPromo('inicio', e.target.value)}
                        onKeyDown={enterEnPromo}
                      />
                    </Campo>

                    <Campo etiqueta="Termina" htmlFor="pf-promo-fin">
                      <input
                        id="pf-promo-fin"
                        type="date" min={nuevaPromo.inicio || hoyISO()}
                        className="pf-input"
                        value={nuevaPromo.fin}
                        onChange={(e) => cambiarPromo('fin', e.target.value)}
                        onKeyDown={enterEnPromo}
                      />
                    </Campo>
                  </div>

                  {errorPromo && (
                    <p className="pf-error">
                      <AlertCircle size={13} aria-hidden="true" />
                      {errorPromo}
                    </p>
                  )}

                  <div className="pf-promo-form__botones">
                    <button
                      type="button"
                      className="pf-boton pf-boton--secundario pf-boton--chico"
                      onClick={() => setNuevaPromo(null)}
                    >
                      Cancelar
                    </button>
                    <button type="button" className="pf-boton pf-boton--primario pf-boton--chico" onClick={agregarPromo}>
                      <Plus size={14} aria-hidden="true" />
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="pf-agregar" onClick={abrirNuevaPromo}>
                  <Plus size={15} aria-hidden="true" />
                  Agregar promoción
                </button>
              )}
            </Seccion>
          )}
        </div>

        {/* ============ LATERAL ============ */}
        <aside className="pf-lateral">
          <section className="pf-panel">
            <header className="pf-seccion__cabecera">
              <h2 className="pf-seccion__titulo">
                <span className="pf-seccion__icono" aria-hidden="true">
                  <Eye size={16} />
                </span>
                Así se verá al vender
              </h2>
            </header>

            <div className="pf-vista">
              <div className="pf-vista__imagen">
                {imagen ? <img src={imagen.url} alt="" /> : <Candy size={30} aria-hidden="true" />}
              </div>
              {form.marca && <span className="pf-chip">{form.marca}</span>}
              <p className="pf-vista__nombre">{form.nombre || 'Nombre del producto'}</p>
              <div className="pf-vista__pie">
                <span className="pf-vista__precio">{moneda.format(precio)}</span>
                <span className="pf-vista__stock">{stockActual} disp.</span>
              </div>
            </div>
          </section>

          <section className="pf-panel">
            <header className="pf-seccion__cabecera">
              <h2 className="pf-seccion__titulo">
                <span className="pf-seccion__icono" aria-hidden="true">
                  <BarChart3 size={16} />
                </span>
                Resumen
              </h2>
              <span className="pf-mes">{mesActual}</span>
            </header>

            {esNuevo ? (
              <p className="pf-ayuda">El resumen aparece cuando el producto tenga ventas.</p>
            ) : (
              <>
                <dl className="pf-resumen">
                  <div>
                    <dt>Stock disponible</dt>
                    <dd>
                      {stockActual} {unidad.plural}
                    </dd>
                  </div>
                  <div>
                    <dt>Vendidas este mes</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Ganancia estimada del mes</dt>
                    <dd>—</dd>
                  </div>
                </dl>
                {/* TODO: llenar con las ventas reales cuando se conecte Registrar venta */}
                <Pendiente texto="Las ventas del mes aparecerán cuando se conecte Registrar venta." />
              </>
            )}
          </section>
        </aside>
      </div>

      {/* ============ BARRA DE ACCIONES ============ */}
      <footer className="pf-acciones">
        <p className="pf-acciones__nota">
          Los campos con <span className="pf-requerido">*</span> son obligatorios
        </p>

        <div className="pf-acciones__botones">
          <button type="button" className="pf-boton pf-boton--secundario" onClick={() => navigate('/catalogo')}>
            Cancelar
          </button>
          <button type="submit" className="pf-boton pf-boton--primario" disabled={guardando}>
            {guardando ? (
              <Loader2 size={16} className="pf-girando" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {guardando ? 'Guardando…' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
          </button>
        </div>
      </footer>
    </form>
  )
}