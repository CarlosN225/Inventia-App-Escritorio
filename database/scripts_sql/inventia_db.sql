PRAGMA foreign_keys = ON;

-- =========================================
-- USUARIO
-- =========================================
CREATE TABLE Usuario (
    id_usuario          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo      VARCHAR(120) NOT NULL,
    correo               VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash      VARCHAR(255) NOT NULL,
    telefono_whatsapp    VARCHAR(20)  NOT NULL,
    rol                  VARCHAR(20)  NOT NULL CHECK (rol IN ('propietario','encargado')),
    activo               BOOLEAN      NOT NULL DEFAULT 1,
    fecha_creacion       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- NEGOCIO
-- =========================================
CREATE TABLE Negocio (
    id_negocio           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre               VARCHAR(150) NOT NULL,
    propietario          VARCHAR(120) NOT NULL,
    direccion            VARCHAR(200) NOT NULL,
    telefono             VARCHAR(20),
    id_usuario_admin     INTEGER NOT NULL,
    FOREIGN KEY (id_usuario_admin) REFERENCES Usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- CONFIGURACION  (NUEVA) - 1:1 con Negocio
-- =========================================
CREATE TABLE Configuracion (
    id_configuracion     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_negocio           INTEGER NOT NULL UNIQUE,
    maneja_caducidad     BOOLEAN NOT NULL DEFAULT 0,
    maneja_promociones   BOOLEAN NOT NULL DEFAULT 0,
    usa_codigo_barras    BOOLEAN NOT NULL DEFAULT 0,
    alertas_activas      BOOLEAN NOT NULL DEFAULT 1,
    vende_mayoreo        BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (id_negocio) REFERENCES Negocio(id_negocio)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- =========================================
-- CATEGORIA
-- =========================================
CREATE TABLE Categoria (
    id_categoria         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre               VARCHAR(80)  NOT NULL,
    descripcion          VARCHAR(200),
    activa               BOOLEAN      NOT NULL DEFAULT 1
);

-- =========================================
-- PRODUCTO  (CAMBIA)
-- =========================================
CREATE TABLE Producto (
    id_producto               INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barras             VARCHAR(50) UNIQUE,
    nombre                    VARCHAR(120) NOT NULL,
    descripcion               VARCHAR(200),
    id_categoria              INTEGER NOT NULL,
    unidad_medida             VARCHAR(20) NOT NULL CHECK (unidad_medida IN ('pieza','bolsa','caja','paquete')),
    precio_venta              DECIMAL NOT NULL,
    precio_mayoreo            DECIMAL,
    cantidad_minima_mayoreo   INTEGER,
    piezas_por_empaque        INTEGER,
    fecha_caducidad           DATE,
    stock_actual              INTEGER NOT NULL DEFAULT 0,
    stock_minimo              INTEGER NOT NULL,
    stock_maximo              INTEGER,
    activo                    BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- PROMOCION  (NUEVA)
-- =========================================
CREATE TABLE Promocion (
    id_promocion         INTEGER PRIMARY KEY AUTOINCREMENT,
    id_producto          INTEGER NOT NULL,
    tipo_promocion       VARCHAR(30) NOT NULL CHECK (tipo_promocion IN ('descuento_porcentaje','descuento_monto')),
    valor                DECIMAL NOT NULL,
    fecha_inicio         DATE NOT NULL,
    fecha_fin            DATE NOT NULL,
    activa               BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- VENTA  (NUEVA)
-- =========================================
CREATE TABLE Venta (
    id_venta             INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_venta          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario           INTEGER NOT NULL,
    total                DECIMAL NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- DETALLE_VENTA  (NUEVA)
-- =========================================
CREATE TABLE DetalleVenta (
    id_detalle_venta     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta             INTEGER NOT NULL,
    id_producto          INTEGER NOT NULL,
    cantidad             INTEGER NOT NULL,
    precio_unitario      DECIMAL NOT NULL,
    subtotal             DECIMAL NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES Venta(id_venta)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- COMPRA  (NUEVA)
-- =========================================
CREATE TABLE Compra (
    id_compra            INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor            VARCHAR(120) NOT NULL,
    fecha_compra         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario           INTEGER NOT NULL,
    total                DECIMAL NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- DETALLE_COMPRA  (NUEVA)
-- =========================================
CREATE TABLE DetalleCompra (
    id_detalle_compra    INTEGER PRIMARY KEY AUTOINCREMENT,
    id_compra            INTEGER NOT NULL,
    id_producto          INTEGER NOT NULL,
    cantidad             INTEGER NOT NULL,
    costo_unitario       DECIMAL NOT NULL,
    fecha_caducidad      DATE,
    subtotal             DECIMAL NOT NULL,
    FOREIGN KEY (id_compra) REFERENCES Compra(id_compra)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- MOVIMIENTO_INVENTARIO  (CAMBIA)
-- =========================================
CREATE TABLE MovimientoInventario (
    id_movimiento        INTEGER PRIMARY KEY AUTOINCREMENT,
    id_producto          INTEGER NOT NULL,
    id_usuario           INTEGER NOT NULL,
    id_venta             INTEGER,
    id_compra            INTEGER,
    tipo_movimiento      VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada','salida','merma','correccion')),
    motivo_merma         VARCHAR(30) CHECK (motivo_merma IS NULL OR motivo_merma IN ('caducado','danado','consumo_propio','devolucion_proveedor','otro')),
    motivo               VARCHAR(200),
    cantidad             INTEGER NOT NULL,
    fecha_movimiento     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_venta) REFERENCES Venta(id_venta)
        ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (id_compra) REFERENCES Compra(id_compra)
        ON UPDATE CASCADE ON DELETE SET NULL,
    -- motivo es obligatorio en 'correccion' y en merma con motivo_merma = 'otro'
    CHECK (
        (tipo_movimiento != 'correccion' OR motivo IS NOT NULL)
        AND (tipo_movimiento != 'merma' OR motivo_merma IS NOT NULL)
        AND (motivo_merma != 'otro' OR motivo IS NOT NULL)
    )
);

-- =========================================
-- ALERTA_STOCK  (CAMBIA)
-- =========================================
CREATE TABLE AlertaStock (
    id_alerta             INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid_local            VARCHAR(36) NOT NULL UNIQUE,
    id_producto           INTEGER NOT NULL,
    id_usuario            INTEGER NOT NULL,
    tipo_alerta           VARCHAR(20) NOT NULL CHECK (tipo_alerta IN ('stock_bajo','caducidad')),
    nivel_stock           INTEGER NOT NULL,
    fecha_generacion      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviada               BOOLEAN NOT NULL DEFAULT 0,
    fecha_envio           DATETIME,
    mensaje               TEXT,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- =========================================
-- Indices utiles
-- =========================================
CREATE INDEX idx_producto_categoria        ON Producto(id_categoria);
CREATE INDEX idx_promocion_producto        ON Promocion(id_producto);
CREATE INDEX idx_venta_usuario             ON Venta(id_usuario);
CREATE INDEX idx_detalleventa_venta        ON DetalleVenta(id_venta);
CREATE INDEX idx_detalleventa_producto     ON DetalleVenta(id_producto);
CREATE INDEX idx_compra_usuario            ON Compra(id_usuario);
CREATE INDEX idx_detallecompra_compra      ON DetalleCompra(id_compra);
CREATE INDEX idx_detallecompra_producto    ON DetalleCompra(id_producto);
CREATE INDEX idx_movimiento_producto       ON MovimientoInventario(id_producto);
CREATE INDEX idx_movimiento_usuario        ON MovimientoInventario(id_usuario);
CREATE INDEX idx_movimiento_venta          ON MovimientoInventario(id_venta);
CREATE INDEX idx_movimiento_compra         ON MovimientoInventario(id_compra);
CREATE INDEX idx_alerta_producto           ON AlertaStock(id_producto);
CREATE INDEX idx_alerta_usuario            ON AlertaStock(id_usuario);
