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
  Phone,
  Mail,
  SearchX,
  DatabaseBackup,
  KeyRound,
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
      'Busca el producto con 2 o 3 letras, tócalo en "Más vendidos" o pásalo por el lector: cada escaneo suma 1.',
      'Ajusta la cantidad con − y +. Si se lleva la caja o bolsa completa, usa el botón "+ Caja" o "+ Bolsa".',
      'El mayoreo y las promociones se aplican solos. Si ves "Caduca en X días", ofrécelo primero.',
      'Elige cómo pagó: Efectivo, Transferencia u Otro (tarjeta). En efectivo, escribe con cuánto pagó y te dice el cambio.',
      'Presiona "Confirmar" (o F12). El inventario se descuenta solo. Lo agotado o caducado no se puede vender.',
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
      'Busca cada producto que te llegó (o escanéalo), o agrégalo desde "Por surtir".',
      'Si llegó en caja o bolsa, captura cuántas cajas cerradas y cuántas sueltas: el sistema suma las piezas.',
      'Pon el costo de la caja: el sistema calcula el costo por pieza. Si caduca, pon su fecha de caducidad.',
      'Acomoda lo nuevo atrás y lo que ya tenías adelante, para vender primero lo que caduca antes.',
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
      'Presiona "Registrar merma" y confirma. Lo caducado siempre va aquí, porque no se puede vender.',
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
      'En Catálogo, presiona "Nuevo producto". Escribe nombre, marca, gramaje y categoría.',
      'Elige cómo lo vendes: pieza, bolsa, caja, paquete o botella (no se vende a granel).',
      'Si te llega en caja, bolsa o paquete, indícalo y escribe cuántas trae (ej. bolsa de 25).',
      'Pon el precio de venta y, si vendes por mayoreo, su precio (por unidad) y desde cuántas aplica.',
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
      'Escribe lo que contaste y presiona Enter para pasar al siguiente. La palomita ✓ es "coincide con el sistema".',
      'Si tienes cajas o bolsas cerradas, usa "Contar por caja / bolsa": no hace falta abrirlas.',
      'Lo que dejes en blanco no cambia. Si algo va a quedar en 0, el sistema te pregunta antes.',
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
      'En Alertas ves lo que está debajo del mínimo y lo que caduca, ordenado por urgencia.',
      '"Ya caducaron" va a merma; "Vende primero" caduca en 7 días o menos; luego lo de las próximas semanas.',
      'Desde ahí registras la compra o la merma con un clic.',
      'Cada día te llega un resumen por correo; si no hay internet, se manda en cuanto regrese.',
    ],
  },
  {
    id: 'respaldos',
    titulo: 'Respaldar tu información',
    desc: 'Por si la computadora falla',
    icono: DatabaseBackup,
    ruta: '/configuracion',
    estado: { seccion: 'respaldos' },
    soloPropietario: true,
    pasos: [
      'Diario se hace un respaldo automático en la carpeta "C:\\Inventia Respaldos" (se guardan los últimos 10).',
      'Cada viernes en la noche se manda un respaldo a tu correo.',
      'En Configuración › Respaldos puedes hacer uno al momento, mandarlo al correo o guardarlo en una USB.',
      'Para recuperar, elige un respaldo y "Restaurar". Antes, el sistema guarda una copia de cómo estaba.',
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Si olvidas tu contraseña',
    desc: 'Código de recuperación',
    icono: KeyRound,
    ruta: '/perfil',
    pasos: [
      'Propietario: en Mi perfil genera tu código de recuperación y guárdalo en papel, fuera de la computadora.',
      'Si olvidas tu contraseña, en la pantalla de entrada toca "¿Olvidaste tu contraseña?" y escribe tu código.',
      'Al usarlo te da uno nuevo: guárdalo otra vez.',
      'Encargado: pídele al propietario que te la restablezca en Configuración › Usuarios.',
      'Puede haber hasta 2 propietarios: uno le restablece la contraseña al otro. Solo el principal puede dar de baja al segundo.',
    ],
  },
]

const ATAJOS = [
  { teclas: ['F2'], texto: 'Ir al buscador de productos' },
  { teclas: ['↑', '↓'], texto: 'Moverte entre los resultados' },
  { teclas: ['Enter'], texto: 'Agregar el producto resaltado' },
  { teclas: ['Lector'], texto: 'Escanear el código de barras: suma 1 cada vez' },
  { teclas: ['F12'], texto: 'Confirmar la venta o registrar la compra' },
  { teclas: ['Esc'], texto: 'Cancelar o cerrar una ventana' },
]

const PREGUNTAS = [
  {
    pregunta: '¿Qué hago si se descompone o me roban la computadora?',
    respuesta:
      'Tu información no se pierde si tienes respaldo. Instala INVENTIA en la computadora nueva y, en la primera pantalla, elige "Restaurar un respaldo": usa el último que te llegó al correo o el de tu USB. Quedará todo como estaba el día de ese respaldo.',
  },
  {
    pregunta: 'Olvidé mi contraseña, ¿qué hago?',
    respuesta:
      'Si eres encargado, pídele al propietario que te la restablezca en Configuración › Usuarios; te dará una temporal que cambiarás al entrar. Si eres propietario, usa tu código de recuperación en "¿Olvidaste tu contraseña?". Si no tienes código, el otro propietario te la puede restablecer, o escríbele al equipo de INVENTIA.',
  },
  {
    pregunta: '¿Por qué no me deja vender un producto?',
    respuesta:
      'Porque está agotado o caducado. Si está caducado, regístralo como merma. Si ya te llegaron nuevos, registra la compra con su nueva fecha de caducidad y se desbloquea solo.',
  },
  {
    pregunta: '¿Qué significa "Caduca en X días"?',
    respuesta:
      'Que ese producto caduca pronto y conviene venderlo primero. En rojo son 7 días o menos. Al acomodar mercancía nueva, pon lo nuevo atrás y lo que ya tenías adelante.',
  },
  {
    pregunta: '¿Cómo registro un pago con transferencia o tarjeta?',
    respuesta:
      'Antes de confirmar la venta, elige "Transferencia", o "Otro" para tarjeta. Queda guardado y lo ves en el Historial como "Pagó con". En efectivo, escribe con cuánto te pagaron y el sistema te dice el cambio.',
  },
  {
    pregunta: '¿Puedo usar un lector de código de barras?',
    respuesta:
      'Sí. Con el cursor en el buscador, pasa el producto por el lector: cada escaneo suma 1 al ticket. El código se captura al dar de alta el producto.',
  },
  {
    pregunta: '¿Qué pasa si se va el internet?',
    respuesta:
      'Puedes seguir usando INVENTIA normal: toda tu información se guarda en tu computadora. Lo único que espera es lo que se manda por correo (el resumen y el respaldo del viernes), que se envía en cuanto regresa la conexión.',
  },
  {
    pregunta: '¿Cómo cuento lo que está en caja o bolsa cerrada?',
    respuesta:
      'En Corrección de inventario usa "Contar por caja / bolsa": escribes cuántas cerradas tienes y cuántas sueltas, y el sistema hace la cuenta. No hace falta abrirlas.',
  },
  {
    pregunta: '¿Puedo vender a granel o por kilo?',
    respuesta:
      'No. INVENTIA solo registra productos cerrados y sellados de fábrica: por pieza, bolsa, caja, paquete o botella. Lo que se vende a granel no se registra.',
  },
  {
    pregunta: '¿Cuál es la diferencia entre merma y corrección?',
    respuesta:
      'La merma es cuando sabes qué pasó: se caducó, se rompió o se usó en el negocio. La corrección es cuando el conteo no cuadra y no sabes por qué; solo la hace el propietario.',
  },
  {
    pregunta: '¿Por qué no puedo editar ni borrar un movimiento?',
    respuesta:
      'Para que tu inventario siempre cuadre y sepas quién hizo cada cosa. Si algo quedó mal, el propietario lo arregla con una corrección de inventario, que también queda registrada.',
  },
  {
    pregunta: '¿Por qué no veo "Corrección de inventario" o "Configuración"?',
    respuesta:
      'Esas opciones son solo para el propietario. Si eres encargado y crees que el inventario no cuadra, avísale al dueño.',
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
      'No. Sin foto se muestra un dulce como ícono y todo funciona igual.',
  },
]

// TODO: poner los datos reales de soporte del equipo
const SOPORTE = {
  telefono: '55 3394 0285',
  correo: 'equipo.inventia@gmail.com',
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
                      <button type="button" className="ay-boton" onClick={() => navigate(guia.ruta, guia.estado ? { state: guia.estado } : undefined)}>
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
                    <Phone size={16} aria-hidden="true" />
                    Teléfono: <strong>{SOPORTE.telefono}</strong>
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

                <p className="ay-version">INVENTIA v1.1.0</p>
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
