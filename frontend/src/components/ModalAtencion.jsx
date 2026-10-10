import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ChevronRight,
  PackageX,
  Truck,
  X,
} from 'lucide-react'

import '../styles/modal-atencion.css'

const formatoFecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

function saludo() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// "Paleta Vero Mango, Agua Bonafont y 2 más"
function resumenNombres(lista) {
  const nombres = lista.map((p) => p.nombre)
  if (nombres.length <= 2) return nombres.join(' y ')
  return `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`
}

export default function ModalAtencion({
  nombre,
  agotados,
  stockBajo,
  porCaducar,
  diasAviso,
  onCerrar,
  onIr,
}) {
  const grupos = [
    {
      id: 'agotados',
      tono: 'rojo',
      Icono: PackageX,
      lista: agotados,
      titulo: agotados.length === 1 ? 'producto agotado' : 'productos agotados',
      ir: '/registrar-compra',
    },
    {
      id: 'bajo',
      tono: 'ambar',
      Icono: AlertTriangle,
      lista: stockBajo,
      titulo: 'con stock bajo',
      ir: '/registrar-compra',
    },
    {
      id: 'caducar',
      tono: 'rosa',
      Icono: CalendarClock,
      lista: porCaducar,
      titulo: `por caducar en ${diasAviso} días`,
      ir: '/alertas',
    },
  ].filter((g) => g.lista.length > 0)

  const total = grupos.reduce((suma, g) => suma + g.lista.length, 0)

  return (
    <div
      className="ma"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className="ma-caja" role="dialog" aria-modal="true" aria-labelledby="ma-titulo">
        <button type="button" className="ma-cerrar" aria-label="Cerrar" onClick={onCerrar}>
          <X size={18} />
        </button>

        {/* ---------- Encabezado ---------- */}
        <header className="ma-cabecera">
          <span className="ma-campana" aria-hidden="true">
            <BellRing size={24} />
          </span>

          <div className="ma-cabecera__texto">
            <p className="ma-fecha">{capitalizar(formatoFecha.format(new Date()))}</p>
            <h2 id="ma-titulo" className="ma-titulo">
              {saludo()}, {nombre}
            </h2>
            <p className="ma-sub">
              Antes de empezar, hay{' '}
              <strong>
                {total} {total === 1 ? 'producto' : 'productos'}
              </strong>{' '}
              que {total === 1 ? 'necesita' : 'necesitan'} tu atención
            </p>
          </div>
        </header>

        {/* ---------- Grupos en columnas ---------- */}
        <ul className={'ma-lista ma-lista--' + grupos.length}>
          {grupos.map(({ id, tono, Icono, lista, titulo, ir }, i) => (
            <li key={id} style={{ animationDelay: `${120 + i * 90}ms` }}>
              <button
                type="button"
                className={`ma-fila ma-fila--${tono}`}
                onClick={() => onIr(ir)}
              >
                <span className="ma-fila__icono" aria-hidden="true">
                  <Icono size={20} />
                </span>

                <span className="ma-fila__textos">
                  <span className="ma-fila__titulo">
                    <strong>{lista.length}</strong> {titulo}
                  </span>
                  <span className="ma-fila__nombres">{resumenNombres(lista)}</span>
                </span>

                <ChevronRight size={18} className="ma-fila__flecha" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        {/* ---------- Botones al pie ---------- */}
        <footer className="ma-pie">
          <button
            type="button"
            className="ma-boton ma-boton--primario"
            onClick={() => onIr('/registrar-compra')}
          >
            <Truck size={15} aria-hidden="true" />
            Ir a surtir
          </button>
          <button type="button" className="ma-boton" onClick={() => onIr('/alertas')}>
            Ver todas las alertas
          </button>
          <button type="button" className="ma-boton ma-boton--ghost" onClick={onCerrar}>
            Revisar después
          </button>
        </footer>
      </div>
    </div>
  )
}