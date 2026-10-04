// TODO: todo esto vendrá del backend

export const VENTAS = {
  1024: {
    fecha: '2026-10-02T13:42',
    usuario: 'Kenia',
    renglones: [
      { productoId: 2, cantidad: 2, precio: 16.2, etiqueta: 'Promo -10%', clase: 'promo' },
      { productoId: 3, cantidad: 30, precio: 4, etiqueta: 'Mayoreo', clase: 'mayoreo' },
      { productoId: 1, cantidad: 1, precio: 10, etiqueta: 'Precio editado', clase: 'editado' },
    ],
  },
  1021: {
    fecha: '2026-10-01T19:20',
    usuario: 'Kenia',
    renglones: [
      { productoId: 9, cantidad: 10, precio: 4, etiqueta: null, clase: null },
      { productoId: 10, cantidad: 6, precio: 2, etiqueta: null, clase: null },
    ],
  },
  1019: {
    fecha: '2026-10-01T18:05',
    usuario: 'Kenia',
    renglones: [{ productoId: 1, cantidad: 4, precio: 15, etiqueta: null, clase: null }],
  },
  1015: {
    fecha: '2026-09-29T17:10',
    usuario: 'Ana Luisa',
    renglones: [{ productoId: 11, cantidad: 5, precio: 5, etiqueta: null, clase: null }],
  },
}

export const COMPRAS = {
  88: {
    fecha: '2026-10-02T12:10',
    usuario: 'Ana Luisa',
    proveedor: 'De la Rosa',
    nota: 'Nota 4521',
    renglones: [
      { productoId: 3, cantidad: 90, costo: 3.2 },
      { productoId: 11, cantidad: 40, costo: 3.5 },
    ],
  },
  86: {
    fecha: '2026-09-27T11:00',
    usuario: 'Ana Luisa',
    proveedor: 'Sabritas',
    nota: '',
    renglones: [{ productoId: 1, cantidad: 24, costo: 9 }],
  },
}

// Un renglón por producto movido. "cantidad" lleva signo: + entra, - sale
export const MOVIMIENTOS = [
  { id: 14, fecha: '2026-10-02T13:42', tipo: 'venta', productoId: 2, cantidad: -2, stockDespues: 12, usuario: 'Kenia', ventaId: 1024 },
  { id: 13, fecha: '2026-10-02T13:42', tipo: 'venta', productoId: 3, cantidad: -30, stockDespues: 72, usuario: 'Kenia', ventaId: 1024 },
  { id: 12, fecha: '2026-10-02T13:42', tipo: 'venta', productoId: 1, cantidad: -1, stockDespues: 47, usuario: 'Kenia', ventaId: 1024 },
  { id: 11, fecha: '2026-10-02T12:10', tipo: 'compra', productoId: 3, cantidad: 90, stockDespues: 102, usuario: 'Ana Luisa', compraId: 88 },
  { id: 10, fecha: '2026-10-02T12:10', tipo: 'compra', productoId: 11, cantidad: 40, stockDespues: 62, usuario: 'Ana Luisa', compraId: 88 },
  { id: 9, fecha: '2026-10-02T10:15', tipo: 'merma', productoId: 5, cantidad: -2, stockDespues: 15, usuario: 'Kenia', motivo: 'Caducado', nota: 'Venció el 30 de septiembre' },
  { id: 8, fecha: '2026-10-01T20:30', tipo: 'correccion', productoId: 10, cantidad: 2, stockDespues: 62, usuario: 'Ana Luisa', motivo: 'Conteo físico de fin de mes', nota: 'Estaban detrás del anaquel' },
  { id: 7, fecha: '2026-10-01T19:20', tipo: 'venta', productoId: 9, cantidad: -10, stockDespues: 118, usuario: 'Kenia', ventaId: 1021 },
  { id: 6, fecha: '2026-10-01T19:20', tipo: 'venta', productoId: 10, cantidad: -6, stockDespues: 60, usuario: 'Kenia', ventaId: 1021 },
  { id: 5, fecha: '2026-10-01T18:05', tipo: 'venta', productoId: 1, cantidad: -4, stockDespues: 48, usuario: 'Kenia', ventaId: 1019 },
  { id: 4, fecha: '2026-10-01T12:40', tipo: 'merma', productoId: 9, cantidad: -5, stockDespues: 128, usuario: 'Kenia', motivo: 'Dañado', nota: '' },
  { id: 3, fecha: '2026-09-30T21:00', tipo: 'correccion', productoId: 6, cantidad: -1, stockDespues: 4, usuario: 'Ana Luisa', motivo: 'Revisión por descuadre', nota: '' },
  { id: 2, fecha: '2026-09-29T17:10', tipo: 'venta', productoId: 11, cantidad: -5, stockDespues: 22, usuario: 'Ana Luisa', ventaId: 1015 },
  { id: 1, fecha: '2026-09-27T11:00', tipo: 'compra', productoId: 1, cantidad: 24, stockDespues: 52, usuario: 'Ana Luisa', compraId: 86 },
]