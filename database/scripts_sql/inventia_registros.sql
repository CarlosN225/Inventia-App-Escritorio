-- =========================================================
-- INVENTIA - Datos de prueba
-- 5 categorias y 50 productos (dulceria)
-- Ejecutar DESPUES de inventia_schema.sql
-- =========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------
INSERT INTO Categoria (id_categoria, nombre, descripcion, activa) VALUES
    (1, 'Chocolates', 'Chocolates de marca y granel', 1),
    (2, 'Dulces y gomitas', 'Dulces, gomitas y chicles', 1),
    (3, 'Papeleria y piñateria', 'Piñatas, bolsas y articulos de fiesta', 1),
    (4, 'Botanas saladas', 'Papas, cacahuates y frituras', 1),
    (5, 'Bebidas', 'Refrescos, aguas y jugos en botella/lata', 1);

-- ---------------------------------------------------------
-- PRODUCTOS
-- ---------------------------------------------------------
INSERT INTO Producto (
    id_producto, codigo_barras, nombre, descripcion, id_categoria, unidad_medida,
    precio_venta, precio_mayoreo, cantidad_minima_mayoreo, piezas_por_empaque,
    fecha_caducidad, stock_actual, stock_minimo, stock_maximo, activo
) VALUES
    (1, '7501000001', 'Chocolate Carlos V', NULL, 1, 'pieza', 12.0, 10.0, 12, 20, '2027-09-24', 19, 5, 50, 1),
    (2, '7501000002', 'Chocolate Kinder Bueno', NULL, 1, 'pieza', 22.0, 19.0, 10, 24, '2027-03-21', 36, 8, 48, 1),
    (3, '7501000003', 'Chocolate Ferrero Rocher 3pz', NULL, 1, 'caja', 45.0, 40.0, 6, 16, '2026-12-23', 91, 15, 90, 1),
    (4, '7501000004', 'Chocolate Milky Way', NULL, 1, 'pieza', 15.0, NULL, NULL, 20, '2027-08-30', 59, 5, 30, 1),
    (5, '7501000005', 'Chocolate Snickers', NULL, 1, 'pieza', 16.0, 14.0, 12, 24, '2026-12-18', 32, 8, 80, 1),
    (6, '7501000006', 'Chocolate Hershey''s Barra', NULL, 1, 'pieza', 18.0, NULL, NULL, 24, '2027-09-05', 8, 15, 90, 1),
    (7, '7501000007', 'Chocolate M&M''s bolsa', NULL, 1, 'bolsa', 20.0, 17.0, 10, 24, '2027-11-02', 88, 15, 120, 1),
    (8, '7501000008', 'Chocolate Turin Oblea', NULL, 1, 'pieza', 8.0, 6.5, 20, 30, NULL, 33, 12, 120, 1),
    (9, '7501000009', 'Chocolate Abuelita tableta', NULL, 1, 'pieza', 28.0, NULL, NULL, 12, '2027-03-23', 108, 5, 30, 1),
    (10, '7501000010', 'Chocolate Lindt trufa', NULL, 1, 'pieza', 35.0, 30.0, 6, 12, '2027-10-24', 59, 10, 80, 1),
    (11, '7501000011', 'Gomitas Trululu bolsa', NULL, 2, 'bolsa', 10.0, 8.0, 15, 30, NULL, 24, 8, 64, 1),
    (12, '7501000012', 'Paleta Payaso', NULL, 2, 'pieza', 6.0, 5.0, 24, 50, '2026-12-23', 16, 12, 72, 1),
    (13, '7501000013', 'Pulparindo', NULL, 2, 'pieza', 7.0, 5.5, 20, 40, '2027-05-03', 113, 10, 100, 1),
    (14, '7501000014', 'Vero Mango', NULL, 2, 'pieza', 5.0, 4.0, 30, 50, '2027-03-16', 108, 5, 50, 1),
    (15, '7501000015', 'Dulce de tamarindo enchilado', NULL, 2, 'pieza', 8.0, 6.0, 20, 40, NULL, 63, 15, 90, 1),
    (16, '7501000016', 'Mazapan De la Rosa', NULL, 2, 'pieza', 6.5, 5.0, 24, 48, '2027-05-13', 15, 15, 120, 1),
    (17, '7501000017', 'Gomitas osito Haribo', NULL, 2, 'bolsa', 18.0, 15.0, 10, 24, NULL, 111, 15, 120, 1),
    (18, '7501000018', 'Chicle Trident sin azucar', NULL, 2, 'paquete', 14.0, 12.0, 12, 24, '2027-08-23', 29, 5, 30, 1),
    (19, '7501000019', 'Paleta Hot Wheels', NULL, 2, 'pieza', 5.5, 4.5, 24, 48, '2027-10-05', 34, 10, 60, 1),
    (20, '7501000020', 'Caramelos macizos surtidos', NULL, 2, 'bolsa', 25.0, 20.0, 6, 12, NULL, 114, 8, 48, 1),
    (21, '7501000021', 'Obleas rellenas', NULL, 2, 'pieza', 4.0, 3.0, 30, 60, NULL, 53, 10, 80, 1),
    (22, '7501000022', 'Gomitas acidas Sonric''s', NULL, 2, 'bolsa', 12.0, 10.0, 15, 30, NULL, 86, 10, 60, 1),
    (23, '7501000023', 'Piñata estrella mediana', NULL, 3, 'pieza', 120.0, 100.0, 3, 6, NULL, 52, 10, 60, 1),
    (24, '7501000024', 'Piñata personaje infantil', NULL, 3, 'pieza', 180.0, 150.0, 3, 6, NULL, 90, 10, 100, 1),
    (25, '7501000025', 'Bolsa de dulces para fiesta', NULL, 3, 'paquete', 15.0, 12.0, 10, 20, NULL, 92, 5, 50, 1),
    (26, '7501000026', 'Confeti bolsa', NULL, 3, 'bolsa', 20.0, NULL, NULL, 12, NULL, 86, 8, 80, 1),
    (27, '7501000027', 'Serpentina rollo', NULL, 3, 'pieza', 10.0, NULL, NULL, 24, NULL, 98, 8, 48, 1),
    (28, '7501000028', 'Gorro de fiesta paquete 10pz', NULL, 3, 'paquete', 35.0, 30.0, 6, 12, NULL, 64, 12, 96, 1),
    (29, '7501000029', 'Globo numero metalico', NULL, 3, 'pieza', 45.0, 38.0, 6, 10, NULL, 86, 15, 90, 1),
    (30, '7501000030', 'Piñata burro tradicional', NULL, 3, 'pieza', 150.0, 130.0, 3, 6, NULL, 92, 10, 60, 1),
    (31, '7501000031', 'Papas Sabritas original', NULL, 4, 'bolsa', 18.0, 15.0, 12, 24, '2027-02-26', 110, 5, 40, 1),
    (32, '7501000032', 'Cacahuate japones', NULL, 4, 'bolsa', 14.0, 11.0, 15, 30, '2027-05-25', 39, 5, 30, 1),
    (33, '7501000033', 'Chicharron de cerdo', NULL, 4, 'bolsa', 22.0, 18.0, 10, 20, '2027-08-18', 117, 10, 60, 1),
    (34, '7501000034', 'Doritos queso', NULL, 4, 'bolsa', 19.0, 16.0, 12, 24, '2027-10-02', 68, 12, 120, 1),
    (35, '7501000035', 'Cheetos flamin hot', NULL, 4, 'bolsa', 19.0, 16.0, 12, 24, '2027-06-23', 23, 10, 60, 1),
    (36, '7501000036', 'Totopos Barcel', NULL, 4, 'bolsa', 17.0, 14.0, 12, 24, '2027-03-07', 100, 15, 150, 1),
    (37, '7501000037', 'Palomitas microondas', NULL, 4, 'caja', 24.0, 20.0, 8, 16, '2027-03-15', 100, 15, 120, 1),
    (38, '7501000038', 'Cacahuate garapiñado', NULL, 4, 'bolsa', 16.0, 13.0, 15, 30, '2027-08-26', 56, 10, 60, 1),
    (39, '7501000039', 'Papas Ruffles queso', NULL, 4, 'bolsa', 20.0, 17.0, 12, 24, '2027-01-10', 70, 12, 72, 1),
    (40, '7501000040', 'Churritos Takis', NULL, 4, 'bolsa', 18.0, 15.0, 12, 24, '2026-11-25', 115, 5, 30, 1),
    (41, '7501000041', 'Coca-Cola 600ml', NULL, 5, 'pieza', 18.0, 16.0, 12, 24, '2027-09-18', 25, 12, 120, 1),
    (42, '7501000042', 'Agua Bonafont 600ml', NULL, 5, 'pieza', 12.0, 10.0, 12, 24, '2026-12-03', 54, 12, 120, 1),
    (43, '7501000043', 'Jugo Boing 500ml', NULL, 5, 'pieza', 14.0, 12.0, 12, 24, '2027-06-28', 72, 10, 100, 1),
    (44, '7501000044', 'Refresco Sidral Mundet lata', NULL, 5, 'pieza', 15.0, 13.0, 12, 24, '2026-11-06', 92, 5, 50, 1),
    (45, '7501000045', 'Gatorade 600ml', NULL, 5, 'pieza', 20.0, 17.0, 10, 20, '2027-08-02', 101, 10, 100, 1),
    (46, '7501000046', 'Agua mineral Topo Chico', NULL, 5, 'pieza', 16.0, 14.0, 12, 24, '2027-04-24', 19, 10, 80, 1),
    (47, '7501000047', 'Jumex nectar 335ml', NULL, 5, 'pieza', 11.0, 9.0, 15, 30, '2027-01-20', 63, 5, 50, 1),
    (48, '7501000048', 'Refresco Manzanita Sol lata', NULL, 5, 'pieza', 14.0, 12.0, 12, 24, '2027-11-04', 38, 15, 90, 1),
    (49, '7501000049', 'Te Lipton 600ml', NULL, 5, 'pieza', 17.0, 15.0, 12, 24, '2027-07-18', 18, 10, 100, 1),
    (50, '7501000050', 'Electrolit 625ml', NULL, 5, 'pieza', 28.0, 24.0, 8, 16, '2027-07-18', 82, 8, 48, 1);
