/* ============================================================
   EXPORTAR EL HISTORIAL A EXCEL (.xlsx) Y PDF, con diseño
   ------------------------------------------------------------
   Las librerías (exceljs y jspdf) se cargan solo al exportar,
   así la app no se hace más pesada al abrir.

   Cada fila que llega aquí ya viene armada desde Movimientos.jsx:
   { fecha: Date, tipo, clase, folio, producto, cantidad, unidad,
     stock, usuario, detalle, precio, bitacora }
   ============================================================ */

import logoReportes from '../assets/logo-reportes.png'

// Colores de INVENTIA
const AZUL = '1668E3'
const MARINO = '0B1220'
const GRIS = '64748B'
const BORDE = 'E6EAF0'
const RAYADO = 'F5F8FD'
const VERDE = '0F8A5F'
const ROJO = 'C62828'

// Color del texto del tipo (igual que en la pantalla)
const COLOR_TIPO = {
  venta: '1668E3',
  compra: '0F8A5F',
  merma: 'C62828',
  correccion: '7C3AED',
}

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
const formatoGenerado = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/* ---------- Ayudantes ---------- */

function nombreArchivo(extension) {
  const hoy = new Date()
  const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return `historial-inventia-${dia}.${extension}`
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// El logo en base64 (lo piden tanto Excel como PDF)
async function cargarLogo() {
  try {
    const respuesta = await fetch(logoReportes)
    const blob = await respuesta.blob()
    return await new Promise((resolver) => {
      const lector = new FileReader()
      lector.onload = () => resolver(lector.result) // "data:image/png;base64,..."
      lector.onerror = () => resolver(null)
      lector.readAsDataURL(blob)
    })
  } catch {
    return null // Sin logo, el archivo sale igual
  }
}

// "Dulcería Los Querubines · Últimos 7 días · Generado el 6 nov 2026, 1:58 p.m."
function lineaDatos(contexto) {
  return [contexto.negocio, contexto.periodo, `Generado el ${formatoGenerado.format(new Date())}`]
    .filter(Boolean)
    .join(' · ')
}

function lineaFiltros(contexto) {
  return contexto.filtros.length > 0 ? `Filtros: ${contexto.filtros.join(' · ')}` : ''
}

function cantidadConSigno(n) {
  return `${n > 0 ? '+' : ''}${n}`
}

/* ============================================================
   EXCEL (.xlsx)
   ============================================================ */

export async function exportarExcel(filas, contexto) {
  const ExcelJS = (await import('exceljs')).default
  const logo = await cargarLogo()

  const libro = new ExcelJS.Workbook()
  libro.creator = 'INVENTIA'
  libro.created = new Date()

  /* ---------- Hoja 1: Historial ---------- */
  const hoja = libro.addWorksheet('Historial', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 1 },
  })

  hoja.columns = [
    { key: 'fecha', width: 13 },
    { key: 'hora', width: 8 },
    { key: 'tipo', width: 12 },
    { key: 'folio', width: 13 },
    { key: 'producto', width: 32 },
    { key: 'cantidad', width: 10 },
    { key: 'unidad', width: 10 },
    { key: 'stock', width: 13 },
    { key: 'usuario', width: 26 },
    { key: 'detalle', width: 24 },
    { key: 'precio', width: 14 },
    { key: 'bitacora', width: 46 },
  ]

  // Encabezado: logo + título + datos
  if (logo) {
    const idLogo = libro.addImage({ base64: logo, extension: 'png' })
    hoja.addImage(idLogo, { tl: { col: 0.15, row: 0.15 }, ext: { width: 52, height: 52 } })
  }
  hoja.getRow(1).height = 24
  hoja.getRow(2).height = 18
  hoja.getRow(3).height = 18

  hoja.mergeCells('B1:L1')
  hoja.getCell('B1').value = 'Historial de movimientos'
  hoja.getCell('B1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: MARINO } }
  hoja.getCell('B1').alignment = { vertical: 'middle', indent: 1 }

  hoja.mergeCells('B2:L2')
  hoja.getCell('B2').value = lineaDatos(contexto)
  hoja.getCell('B2').font = { name: 'Calibri', size: 10, color: { argb: GRIS } }
  hoja.getCell('B2').alignment = { indent: 1 }

  hoja.mergeCells('B3:L3')
  hoja.getCell('B3').value = lineaFiltros(contexto)
  hoja.getCell('B3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: GRIS } }
  hoja.getCell('B3').alignment = { indent: 1 }

  // Fila 5: títulos de la tabla
  const titulos = [
    'Fecha', 'Hora', 'Tipo', 'Folio', 'Producto', 'Cantidad', 'Unidad',
    'Stock después', 'Usuario', 'Detalle', 'Precio unitario', 'Cambio de precio',
  ]
  const filaTitulos = hoja.getRow(5)
  filaTitulos.values = titulos
  filaTitulos.height = 22
  filaTitulos.eachCell((celda) => {
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  // Filas de datos
  filas.forEach((f, i) => {
    const fila = hoja.addRow({
      // Excel guarda las fechas "sin zona": se pasa el día local tal cual
      fecha: new Date(Date.UTC(f.fecha.getFullYear(), f.fecha.getMonth(), f.fecha.getDate())),
      hora: formatoHora.format(f.fecha),
      tipo: f.tipo,
      folio: f.folio || '',
      producto: f.producto,
      cantidad: f.cantidad,
      unidad: f.unidad,
      stock: f.stock === '' || f.stock === null ? '' : f.stock,
      usuario: f.usuario,
      detalle: f.detalle,
      precio: f.precio ?? '',
      bitacora: f.bitacora,
    })

    fila.height = 18
    fila.eachCell({ includeEmpty: true }, (celda) => {
      celda.font = { name: 'Calibri', size: 10.5, color: { argb: MARINO } }
      celda.alignment = { vertical: 'middle' }
      celda.border = { bottom: { style: 'thin', color: { argb: BORDE } } }
      if (i % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAYADO } }
    })

    fila.getCell('fecha').numFmt = 'dd/mm/yyyy'
    fila.getCell('fecha').alignment = { vertical: 'middle', horizontal: 'center' }
    fila.getCell('hora').alignment = { vertical: 'middle', horizontal: 'center' }
    fila.getCell('tipo').font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR_TIPO[f.clase] ?? MARINO } }
    fila.getCell('cantidad').numFmt = '+0;-0;0'
    fila.getCell('cantidad').font = {
      name: 'Calibri',
      size: 10.5,
      bold: true,
      color: { argb: f.cantidad > 0 ? VERDE : ROJO },
    }
    fila.getCell('cantidad').alignment = { vertical: 'middle', horizontal: 'right' }
    fila.getCell('stock').alignment = { vertical: 'middle', horizontal: 'right' }
    fila.getCell('precio').numFmt = '"$"#,##0.00'
    fila.getCell('bitacora').alignment = { vertical: 'middle', wrapText: true }
    ;['producto', 'usuario', 'detalle'].forEach((clave) => {
      fila.getCell(clave).alignment = { vertical: 'middle', indent: 1 }
    })
    if (f.bitacora) fila.getCell('bitacora').font = { name: 'Calibri', size: 10, italic: true, color: { argb: '7C3AED' } }
  })

  // Filtros de Excel en los títulos
  hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + Math.max(filas.length, 1), column: titulos.length } }

  hoja.headerFooter.oddFooter = '&L&8INVENTIA · Historial de movimientos&R&8Página &P de &N'

  /* ---------- Hoja 2: Resumen ---------- */
  const resumen = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] })
  resumen.columns = [{ width: 4 }, { width: 30 }, { width: 14 }, { width: 18 }]

  resumen.mergeCells('B1:D1')
  resumen.getCell('B1').value = 'Resumen del periodo'
  resumen.getCell('B1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: MARINO } }
  resumen.getRow(1).height = 26

  resumen.mergeCells('B2:D2')
  resumen.getCell('B2').value = lineaDatos(contexto)
  resumen.getCell('B2').font = { name: 'Calibri', size: 10, color: { argb: GRIS } }

  const encabezadoResumen = resumen.getRow(4)
  encabezadoResumen.getCell(2).value = 'Concepto'
  encabezadoResumen.getCell(3).value = 'Registros'
  encabezadoResumen.getCell(4).value = 'Importe'
  encabezadoResumen.height = 22
  ;[2, 3, 4].forEach((c) => {
    const celda = encabezadoResumen.getCell(c)
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center', indent: c === 2 ? 1 : 0 }
  })

  contexto.resumen.conceptos.forEach((c, i) => {
    const fila = resumen.getRow(5 + i)
    fila.getCell(2).value = c.concepto
    fila.getCell(3).value = c.registros
    fila.getCell(4).value = c.importe ?? ''
    fila.height = 20
    ;[2, 3, 4].forEach((col) => {
      const celda = fila.getCell(col)
      celda.font = { name: 'Calibri', size: 11, color: { argb: MARINO } }
      celda.border = { bottom: { style: 'thin', color: { argb: BORDE } } }
      celda.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'right', indent: col === 2 ? 1 : 0 }
      if (i % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RAYADO } }
    })
    fila.getCell(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_TIPO[c.clase] ?? MARINO } }
    fila.getCell(4).numFmt = '"$"#,##0.00'
  })

  const filaTotal = resumen.getRow(5 + contexto.resumen.conceptos.length)
  filaTotal.getCell(2).value = 'Total de registros'
  filaTotal.getCell(3).value = contexto.resumen.total
  ;[2, 3, 4].forEach((col) => {
    const celda = filaTotal.getCell(col)
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: MARINO } }
    celda.border = { top: { style: 'thin', color: { argb: MARINO } } }
    celda.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'right', indent: col === 2 ? 1 : 0 }
  })

  const buffer = await libro.xlsx.writeBuffer()
  descargar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo('xlsx')
  )
}

/* ============================================================
   PDF
   ============================================================ */

// La letra del PDF no conoce los espacios "angostos" que usa Intl (ej. "1:58 p. m.")
function limpio(texto) {
  return String(texto ?? '').replace(/[\u00A0\u202F\u2009]/g, ' ')
}

function rgb(hex) {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

export async function exportarPDF(filas, contexto) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const logo = await cargarLogo()

  // Hoja carta, horizontal, en puntos (792 x 612)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 32

  /* ---------- Banda azul con logo ---------- */
  doc.setFillColor(...rgb(AZUL))
  doc.rect(0, 0, ancho, 70, 'F')
  if (logo) doc.addImage(logo, 'PNG', margen, 13, 44, 44)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('INVENTIA', margen + 56, 33)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Historial de movimientos', margen + 56, 50)

  doc.setFontSize(9.5)
  doc.text(limpio(contexto.negocio), ancho - margen, 30, { align: 'right' })
  doc.text(limpio(contexto.periodo), ancho - margen, 45, { align: 'right' })

  /* ---------- Cuadritos de resumen ---------- */
  let x = margen
  const y = 86
  doc.setFontSize(9)
  const cuadros = [{ texto: `${contexto.resumen.total} registros`, color: MARINO }].concat(
    contexto.resumen.conceptos
      .filter((c) => c.registros > 0)
      .map((c) => ({
        texto: limpio(`${c.concepto}: ${c.registros}${c.importe ? ` · ${moneda.format(c.importe)}` : ''}`),
        color: COLOR_TIPO[c.clase] ?? MARINO,
      }))
  )

  cuadros.forEach((c) => {
    doc.setFont('helvetica', 'bold')
    const anchoCuadro = doc.getTextWidth(c.texto) + 18
    doc.setFillColor(...rgb(RAYADO))
    doc.setDrawColor(...rgb(BORDE))
    doc.roundedRect(x, y, anchoCuadro, 20, 5, 5, 'FD')
    doc.setTextColor(...rgb(c.color))
    doc.text(c.texto, x + 9, y + 13.5)
    x += anchoCuadro + 8
  })

  // Filtros aplicados
  const filtros = lineaFiltros(contexto)
  if (filtros) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(...rgb(GRIS))
    doc.text(limpio(filtros), margen, y + 36)
  }

  /* ---------- Tabla ---------- */
  // Cada celda pasa por limpio() al final
  const cuerpo = filas.map((f) => [
    formatoFecha.format(f.fecha),
    formatoHora.format(f.fecha),
    f.tipo,
    f.folio || '',
    f.producto,
    `${cantidadConSigno(f.cantidad)} ${f.unidad}`,
    f.stock === '' || f.stock === null ? '' : String(f.stock),
    f.usuario,
    [f.detalle, f.precio !== null && f.precio !== '' ? moneda.format(f.precio) : '', f.bitacora]
      .filter(Boolean)
      .join('\n'),
  ].map(limpio))

  autoTable(doc, {
    startY: filtros ? y + 46 : y + 32,
    margin: { left: margen, right: margen, bottom: 40 },
    head: [['Fecha', 'Hora', 'Tipo', 'Folio', 'Producto', 'Cantidad', 'Stock después', 'Usuario', 'Detalle']],
    body: cuerpo,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: rgb(MARINO),
      cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
      lineColor: rgb(BORDE),
      lineWidth: { bottom: 0.6 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: rgb(AZUL),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: rgb(RAYADO) },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 36 },
      2: { cellWidth: 60, fontStyle: 'bold' },
      3: { cellWidth: 62 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 56, halign: 'right' },
      7: { cellWidth: 118 },
      8: { cellWidth: 140 },
    },
    // Colores: el tipo como en la pantalla; la cantidad en verde si entra y en rojo si sale
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const fila = filas[data.row.index]
      if (data.column.index === 2) data.cell.styles.textColor = rgb(COLOR_TIPO[fila.clase] ?? MARINO)
      if (data.column.index === 5) data.cell.styles.textColor = rgb(fila.cantidad > 0 ? VERDE : ROJO)
    },
  })

  /* ---------- Pie en cada página ---------- */
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...rgb(GRIS))
    doc.text(limpio(`INVENTIA · Generado el ${formatoGenerado.format(new Date())}`), margen, alto - 18)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 18, { align: 'right' })
  }

  descargar(doc.output('blob'), nombreArchivo('pdf'))
}