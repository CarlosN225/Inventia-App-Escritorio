import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  BookOpen,
  Keyboard,
  HelpCircle,
  LifeBuoy,
  ShoppingCart,
  Truck,
  PackageMinus,
  Package,
  ClipboardCheck,
  Bell,
  Lock,
  ChevronDown,
  ArrowRight,
  MessageCircle,
  Mail,
  SearchX,
} from 'lucide-react'

import '../styles/ayuda.css'

/* ---------- Contenido ---------- */

const GUIAS = [
  {
    id: 'venta',
    titulo: 'Registrar una venta',
    desc: 'Cobrar y descontar del inventario',
    icono: ShoppingCart,
    ruta: '/registrar-venta',
    pasos: [
      'Busca el producto escribiendo 2 o 3 letras, o tócalo en "Más vendidos".',
      'Presiona Enter o "Agregar" para sumarlo a la venta.',
      'Ajusta la cantidad con − y +. El mayoreo y las promociones se aplican solos.',
      'Si necesitas hacer un descuento en el momento, toca el lápiz y cambia el precio.',
      'Revisa el total y presiona "Confirmar". El inventario se descuenta solo.',
    ],
  },
  {
    id: 'compra',
    titulo: 'Registrar una compra',
    desc: 'Cuando te llega mercancía',
    icono: Truck,
    ruta: '/registrar-compra',
    pasos: [
      'Escribe o elige el proveedor, y revisa la fecha.',
      'Busca cada producto que te llegó, o agrégalo desde "Por surtir".',
      'Elige si lo compraste por pieza o por caja: el sistema calcula las piezas.',
      'Revisa el costo por pieza y, si aplica, la fecha de caducidad.',
      'Presiona "Registrar", revisa el resumen contra tu nota y confirma.',
    ],
  },
  {
    id: 'merma',
    titulo: 'Registrar una merma',
    desc: 'Lo que se caducó, rompió o se usó',
    icono: PackageMinus,
    ruta: '/registrar-merma',
    pasos: [
      'Busca el producto que se perdió.',
      'Indica cuántas piezas fueron.',
      'Elige el motivo: caducado, dañado, consumo propio, devolución u otro.',
      'Presiona "Registrar merma" y confirma.',
    ],
  },
  {
    id: 'producto',
    titulo: 'Dar de alta un producto',
    desc: 'Agregar algo nuevo al catálogo',
    icono: Package,
    ruta: '/catalogo/nuevo',
    soloPropietario: true,
    pasos: [
      'En Catálogo, presiona "Nuevo producto".',
      'Escribe el nombre, la marca y elige la categoría.',
      'Pon el precio de venta y cómo lo vendes: pieza, bolsa, caja o paquete.',
      'Si te llega en caja o bolsa, indica cuántas piezas trae.',
      'Pon el stock inicial y el mínimo para recibir alertas, y guarda.',
    ],
  },
  {
    id: 'correccion',
    titulo: 'Corregir el inventario',
    desc: 'Cuando el conteo no cuadra',
    icono: ClipboardCheck,
    ruta: '/correccion-inventario',
    soloPropietario: true,
    pasos: [
      'Cuenta con la tienda cerrada, para que nada se venda mientras cuentas.',
      'Escribe lo que contaste y presiona Enter para pasar al siguiente producto.',
      'Si tienes cajas o bolsas cerradas, usa "Contar por caja": no hace falta abrirlas.',
      'Lo que no cuentes no cambia. Puedes contar por categoría, un día a la vez.',
      'Elige el motivo y presiona "Aplicar corrección".',
    ],
  },
  {
    id: 'alertas',
    titulo: 'Usar las alertas',
    desc: 'Qué se acaba y qué caduca',
    icono: Bell,
    ruta: '/alertas',
    pasos: [
      'En Alertas ves lo que está debajo del mínimo y lo que caduca pronto.',
      'Desde ahí registras la compra o la merma con un clic.',
      'Cada día te llega un solo resumen por WhatsApp, a la hora que elijas.',
      'Si no hay internet a esa hora, el resumen se manda en cuanto regrese.',
    ],
  },
]

const ATAJOS = [
  { teclas: ['F2'], texto: 'Ir al buscador de productos' },
  { teclas: ['↑', '↓'], texto: 'Moverte entre los resultados' },
  { teclas: ['Enter'], texto: 'Agregar el producto resaltado' },
  { teclas: ['F12'], texto: 'Confirmar la venta o registrar la compra' },
  { teclas: ['Esc'], texto: 'Cancelar o cerrar una ventana' },
]

const PREGUNTAS = [
  {
    pregunta: '¿Qué pasa si se va el internet?',
    respuesta:
      'Puedes seguir usando INVENTIA normal. Todo se guarda en tu computadora y se sincroniza solo en cuanto vuelva la conexión. Lo único que espera es el resumen de WhatsApp.',
  },
  {
    pregunta: '¿Por qué no puedo editar ni borrar un movimiento?',
    respuesta:
      'Para que tu inventario siempre cuadre y sepas quién hizo cada cosa. Si algo quedó mal, el propietario lo arregla con una corrección de inventario, que también queda registrada.',
  },
  {
    pregunta: '¿Cuál es la diferencia entre merma y corrección?',
    respuesta:
      'La merma es cuando sabes qué pasó: se caducó, se rompió o se usó en el negocio. La corrección es cuando el conteo no cuadra y no sabes por qué; solo la hace el propietario.',
  },
  {
    pregunta: '¿Cuándo conviene contar el inventario?',
    respuesta:
      'Antes de abrir o después de cerrar. Si alguien vende un producto mientras lo cuentas, la diferencia sale mal.',
  },
  {
    pregunta: '¿Cómo cuento lo que está en caja o bolsa cerrada?',
    respuesta:
      'En Corrección de inventario usa "Contar por caja": escribes cuántas cajas cerradas tienes y cuántas piezas sueltas, y el sistema hace la cuenta. No hace falta abrirlas.',
  },
  {
    pregunta: '¿Por qué no veo "Corrección de inventario" o "Configuración"?',
    respuesta:
      'Esas opciones son solo para el propietario. Si eres encargado y crees que el inventario no cuadra, avísale al dueño.',
  },
  {
    pregunta: 'Olvidé mi contraseña, ¿qué hago?',
    respuesta:
      'Pídele al propietario que te la restablezca en Configuración › Usuarios. Te dará una contraseña temporal; entra con ella y cámbiala en Mi perfil.',
  },
  {
    pregunta: '¿Cómo cambio mi contraseña?',
    respuesta: 'En el menú de tu perfil (arriba a la derecha) entra a "Mi perfil" y usa "Cambiar contraseña".',
  },
  {
    pregunta: '¿Cómo se calcula la ganancia estimada?',
    respuesta:
      'Es lo que vendiste menos lo que te costaron esos productos, según el costo de tus compras. Por eso es importante registrar las compras con su costo.',
  },
  {
    pregunta: '¿Mis productos necesitan foto?',
    respuesta:
      'No. Sin foto se muestra un dulce como ícono y todo funciona igual. Si quieres, súbeles foto solo a tus más vendidos para encontrarlos más rápido.',
  },
]

// TODO: poner los datos reales de soporte del equipo
const SOPORTE = {
  whatsapp: '55 0000 0000',
  correo: 'soporte@inventia.mx',
  horario: 'Lunes a sábado, de 9:00 a 18:00',
}

/* ---------- Utilidades ---------- */

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/* ---------- Pantalla ---------- */

export default function Ayuda() {
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [guiaAbierta, setGuiaAbierta] = useState(null)
  const [preguntasAbiertas, setPreguntasAbiertas] = useState([])

  const texto = normalizar(busqueda.trim())

  const guias = GUIAS.filter(
    (g) => !texto || normalizar(`${g.titulo} ${g.desc} ${g.pasos.join(' ')}`).includes(texto)
  )

  const preguntas = PREGUNTAS.filter(
    (p) => !texto || normalizar(`${p.pregunta} ${p.respuesta}`).includes(texto)
  )

  const guia = GUIAS.find((g) => g.id === guiaAbierta && guias.includes(g))

  function alternarPregunta(indice) {
    setPreguntasAbiertas((lista) =>
      lista.includes(indice) ? lista.filter((i) => i !== indice) : [...lista, indice]
    )
  }

  const sinResultados = texto && guias.length === 0 && preguntas.length === 0

  return (
    <div className="ay">
      {/* ============ ENCABEZADO ============ */}
      <header className="ay-encabezado">
        <h1 className="ay-titulo">¿En qué te ayudamos?</h1>
        <p className="ay-subtitulo">Guías rápidas y respuestas a las dudas más comunes</p>

        <div className="ay-buscador">
          <Search size={18} className="ay-buscador__icono" aria-hidden="true" />
          <input
            type="text"
            placeholder="Busca, por ejemplo: merma, contraseña, internet…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en la ayuda"
          />
          {busqueda && (
            <button
              type="button"
              className="ay-buscador__limpiar"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {sinResultados ? (
        <section className="ay-panel">
          <div className="ay-vacio">
            <SearchX size={28} aria-hidden="true" />
            No encontramos nada sobre "{busqueda.trim()}". Prueba con otra palabra.
          </div>
        </section>
      ) : (
        <>
          {/* ============ GUÍAS ============ */}
          {guias.length > 0 && (
            <section className="ay-panel">
              <h2 className="ay-seccion__titulo">
                <span className="ay-seccion__icono" aria-hidden="true">
                  <BookOpen size={16} />
                </span>
                Guías rápidas
              </h2>

              <div className="ay-guias">
                {guias.map((g) => {
                  const Icono = g.icono
                  const activa = guiaAbierta === g.id

                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={'ay-guia' + (activa ? ' is-activa' : '')}
                      onClick={() => setGuiaAbierta(activa ? null : g.id)}
                      aria-expanded={activa}
                    >
                      <span className="ay-guia__icono" aria-hidden="true">
                        <Icono size={19} />
                      </span>
                      <span>
                        <span className="ay-guia__titulo">{g.titulo}</span>
                        <span className="ay-guia__desc">{g.desc}</span>
                        {g.soloPropietario && (
                          <span className="ay-propietario">
                            <Lock size={10} aria-hidden="true" />
                            Solo propietario
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              {guia && (
                <div className="ay-detalle">
                  <div className="ay-detalle__cabecera">
                    <h3 className="ay-detalle__titulo">{guia.titulo}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="ay-boton ay-boton--secundario" onClick={() => setGuiaAbierta(null)}>
                        Cerrar
                      </button>
                      <button type="button" className="ay-boton" onClick={() => navigate(guia.ruta)}>
                        Ir a la pantalla
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <ol className="ay-pasos">
                    {guia.pasos.map((paso) => (
                      <li key={paso}>{paso}</li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}

          {/* ============ ATAJOS + CONTACTO ============ */}
          {!texto && (
            <div className="ay-fila">
              <section className="ay-panel">
                <h2 className="ay-seccion__titulo">
                  <span className="ay-seccion__icono" aria-hidden="true">
                    <Keyboard size={16} />
                  </span>
                  Atajos de teclado
                </h2>

                <ul className="ay-atajos">
                  {ATAJOS.map((a) => (
                    <li key={a.texto}>
                      <span className="ay-teclas">
                        {a.teclas.map((t) => (
                          <kbd key={t} className="ay-tecla">
                            {t}
                          </kbd>
                        ))}
                      </span>
                      <span className="ay-atajos__texto">{a.texto}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="ay-panel">
                <h2 className="ay-seccion__titulo">
                  <span className="ay-seccion__icono" aria-hidden="true">
                    <LifeBuoy size={16} />
                  </span>
                  ¿Necesitas más ayuda?
                </h2>

                <p className="ay-contacto__texto">
                  Si algo no funciona como esperas o tienes una duda que no está aquí, escríbele al equipo de INVENTIA.
                </p>

                <ul className="ay-contacto__datos">
                  <li>
                    <MessageCircle size={16} aria-hidden="true" />
                    WhatsApp: <strong>{SOPORTE.whatsapp}</strong>
                  </li>
                  <li>
                    <Mail size={16} aria-hidden="true" />
                    Correo: <strong>{SOPORTE.correo}</strong>
                  </li>
                  <li>
                    <HelpCircle size={16} aria-hidden="true" />
                    {SOPORTE.horario}
                  </li>
                </ul>

                <p className="ay-version">INVENTIA v1.0</p>
              </section>
            </div>
          )}

          {/* ============ PREGUNTAS FRECUENTES ============ */}
          {preguntas.length > 0 && (
            <section className="ay-panel">
              <h2 className="ay-seccion__titulo">
                <span className="ay-seccion__icono" aria-hidden="true">
                  <HelpCircle size={16} />
                </span>
                Preguntas frecuentes
              </h2>

              <ul className="ay-faq">
                {preguntas.map((p) => {
                  const indice = PREGUNTAS.indexOf(p)
                  // Al buscar, las preguntas encontradas se muestran abiertas
                  const abierta = !!texto || preguntasAbiertas.includes(indice)

                  return (
                    <li key={p.pregunta} className={abierta ? 'is-abierta' : ''}>
                      <button
                        type="button"
                        className="ay-faq__pregunta"
                        onClick={() => alternarPregunta(indice)}
                        aria-expanded={abierta}
                      >
                        {p.pregunta}
                        <ChevronDown size={17} className="ay-faq__chevron" aria-hidden="true" />
                      </button>
                      {abierta && <p className="ay-faq__respuesta">{p.respuesta}</p>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}