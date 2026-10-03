// TODO: todo esto se reemplaza por los datos del backend

export const CATEGORIAS = [
  'Dulces',
  'Chocolates',
  'Paletas',
  'Chicles',
  'Gomitas',
  'Galletas',
  'Botanas',
  'Salsas y chamoy',
  'Bebidas',
  'Globos',
  'Piñatas',
  'Velas',
  'Desechables',
  'Artículos de fiesta',
  'Juguetes',
  'Otros',
]

export const PRODUCTOS = [
  { id: 1, nombre: 'Chetos bolsa chica', marca: 'Sabritas', categoria: 'Botanas', precio: 15, costo: 9, stock: 48, minimo: 20, caducidad: null, diasCaducar: null },
  { id: 2, nombre: 'Paleta Payaso 45g', marca: 'Ricolino', categoria: 'Paletas', precio: 18, costo: 12.5, stock: 14, minimo: 10, caducidad: 'mar 2027', diasCaducar: 180 },
  { id: 3, nombre: 'Mazapán De la Rosa 28g', marca: 'De la Rosa', categoria: 'Dulces', precio: 5, costo: 3.2, stock: 102, minimo: 20, caducidad: 'sep 2027', diasCaducar: 348 },
  { id: 4, nombre: 'Paleta de caramelo', marca: 'Surtido', categoria: 'Paletas', precio: 5, costo: 2.8, stock: 8, minimo: 10, caducidad: 'dic 2026', diasCaducar: 75 },
  { id: 5, nombre: 'Chocolate Carlos V', marca: 'Nestlé', categoria: 'Chocolates', precio: 12, costo: 8, stock: 15, minimo: 10, caducidad: 'oct 2026', diasCaducar: 6 },
  { id: 6, nombre: 'Churrumais limón', marca: 'Sabritas', categoria: 'Botanas', precio: 12, costo: 7.5, stock: 4, minimo: 12, caducidad: null, diasCaducar: null },
  { id: 7, nombre: 'Piñata estrella grande', marca: 'Artesanal', categoria: 'Piñatas', precio: 280, costo: 160, stock: 3, minimo: 2, caducidad: null, diasCaducar: null },
  { id: 8, nombre: 'Platos desechables (paq. 20)', marca: 'Reyma', categoria: 'Desechables', precio: 35, costo: 22, stock: 0, minimo: 5, caducidad: null, diasCaducar: null },
  { id: 9, nombre: 'Globo látex #9', marca: 'Fiesta', categoria: 'Globos', precio: 4, costo: 1.2, stock: 118, minimo: 50, caducidad: null, diasCaducar: null },
  { id: 10, nombre: 'Bubbaloo mora', marca: 'Adams', categoria: 'Dulces', precio: 2, costo: 1.1, stock: 62, minimo: 30, caducidad: 'ene 2027', diasCaducar: 110 },
  { id: 11, nombre: 'Pulparindo', marca: 'De la Rosa', categoria: 'Dulces', precio: 5, costo: 3.5, stock: 22, minimo: 15, caducidad: 'oct 2026', diasCaducar: 18 },
  { id: 12, nombre: 'Paleta Vero Mango', marca: 'Vero', categoria: 'Paletas', precio: 3, costo: 1.7, stock: 27, minimo: 20, caducidad: 'feb 2027', diasCaducar: 140 },
  { id: 13, nombre: 'Lucas Muecas mango', marca: 'Lucas', categoria: 'Dulces', precio: 10, costo: 6.5, stock: 40, minimo: 15, caducidad: 'jun 2027', diasCaducar: 260 },
  { id: 14, nombre: 'Duvalín avellana', marca: 'Ricolino', categoria: 'Dulces', precio: 4, costo: 2.4, stock: 55, minimo: 20, caducidad: 'abr 2027', diasCaducar: 200 },
  { id: 15, nombre: 'Kranky', marca: 'Ricolino', categoria: 'Chocolates', precio: 14, costo: 9.5, stock: 9, minimo: 10, caducidad: 'nov 2026', diasCaducar: 45 },
  { id: 16, nombre: 'Rockaleta', marca: "Sonric's", categoria: 'Paletas', precio: 8, costo: 5, stock: 35, minimo: 15, caducidad: 'may 2027', diasCaducar: 230 },
  { id: 17, nombre: 'Velas de cumpleaños (paq. 10)', marca: 'Mágico', categoria: 'Velas', precio: 25, costo: 14, stock: 12, minimo: 5, caducidad: null, diasCaducar: null },
  { id: 18, nombre: 'Globo metálico corazón', marca: 'Fiesta', categoria: 'Globos', precio: 35, costo: 18, stock: 6, minimo: 3, caducidad: null, diasCaducar: null },
]

// Datos extra que solo usa la pantalla de edición (los demás productos usan valores por defecto)

export const DETALLES = {

      2: {
    vendidasMes: 198,
    promociones: [
      { id: 1, tipo: 'porcentaje', valor: 10, inicio: '2026-10-01', fin: '2026-10-31', activa: true },
    ],
  },
  3: {
    descripcion: '',
    unidad: 'pieza',
    piezasEmpaque: 30,
    empaque: 'caja',
    precioMayoreo: 4,
    minimoMayoreo: 30,
    maximo: 150,
    fechaCaducidad: '2027-09-15',
    codigoBarras: '7501090123456',
    vendidasMes: 175,
    promociones: [
      { id: 1, tipo: 'porcentaje', valor: 10, inicio: '2026-10-01', fin: '2026-10-31', activa: true },
    ],
  },
    4: { piezasEmpaque: 50, empaque: 'bolsa', maximo: 60 },
  6: { piezasEmpaque: 12, empaque: 'caja', maximo: 36 },
  9: { piezasEmpaque: 50, empaque: 'bolsa' },
  11: { piezasEmpaque: 20, empaque: 'caja' },
  15: { piezasEmpaque: 24, empaque: 'caja', maximo: 30 },
}

// Los que salen en "Más vendidos" de Registrar venta
export const MAS_VENDIDOS_IDS = [1, 2, 3, 11, 9, 10, 12, 6]
// Proveedores que salen como chips en Registrar compra
export const PROVEEDORES_FRECUENTES = ['De la Rosa', 'Central de abastos', 'Sabritas', 'La Merced']