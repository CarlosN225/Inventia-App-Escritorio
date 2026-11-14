"""
Pruebas automatizadas de la app inventario, organizadas por función de la matriz:

  F-03  Catálogo de productos           F-09  Alertas de stock y caducidad
  F-04  Registrar venta                 F-10  Avisos por correo
  F-05  Registrar compra                F-12  Autorizar cambio de precio con PIN
  F-06  Registrar merma                 F-13  Panel principal (datos que usa)
  F-07  Corrección de inventario        +     Configuración y promociones
  F-08  Historial de movimientos

(F-01, F-02 y F-11 están en usuarios/tests.py; los movimientos básicos, en inventario/tests.py.)
Cada función tiene un caso con datos válidos y otro con datos inválidos o inexistentes.
Todos los datos son ficticios.
"""
import json
import logging
from datetime import date, time, timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth.hashers import make_password
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from usuarios.models import Usuario

from . import correo_alertas as ca
from . import correo_html as ch
from .alertas_scheduler import revisar_alertas
from .autorizaciones import firmar_autorizacion, leer_autorizacion, motivo_valido, verificar_pin
from .models import (
    AlertaStock, Categoria, Compra, Configuracion, MovimientoInventario, Negocio, Producto, Promocion, Venta,
)

CLAVE = "Clave1234"
RAPIDO = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
CORREO = override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    BREVO_SMTP_LOGIN="login-de-prueba", BREVO_SMTP_KEY="CLAVE_DE_EJEMPLO",
    BREVO_FROM_EMAIL="INVENTIA <avisos@ejemplo.com>", DEFAULT_FROM_EMAIL="INVENTIA <avisos@ejemplo.com>",
)


def setUpModule():
    # Los errores de correo simulados se registran a propósito; no ensucian el reporte
    logging.disable(logging.CRITICAL)


def tearDownModule():
    logging.disable(logging.NOTSET)


@RAPIDO
class BaseInventia(APITestCase):
    """Negocio de prueba «Los Querubines» con una propietaria, un encargado y dos productos."""

    def setUp(self):
        self.duena = Usuario.objects.create(
            nombre_completo="Ana Luisa Reyes", correo="ana@querubines.com", contrasena_hash=make_password(CLAVE),
            telefono_whatsapp="5500000000", rol="propietario", activo=True,
        )
        self.encargado = Usuario.objects.create(
            nombre_completo="Luis Hernández", correo="luis@querubines.com", contrasena_hash=make_password(CLAVE),
            telefono_whatsapp="5500000001", rol="encargado", activo=True,
        )
        self.negocio = Negocio.objects.create(
            nombre="Dulcería Los Querubines", propietario="Ana Luisa Reyes", direccion="Col. Libertad",
            telefono="5512345678", usuario_admin=self.duena,
        )
        self.config = Configuracion.objects.create(
            negocio=self.negocio, maneja_caducidad=True, vende_mayoreo=True, maneja_promociones=True,
            alertas_activas=True, correo_alertas="avisos@querubines.com", dias_aviso_caducidad=30,
        )
        self.chocolates = Categoria.objects.create(nombre="Chocolates")
        self.bubulubu = Producto.objects.create(
            nombre="Bubulubu mini", marca="Ricolino", categoria=self.chocolates, unidad_medida="pieza",
            precio_venta=Decimal("6.00"), precio_mayoreo=Decimal("5.00"), cantidad_minima_mayoreo=25,
            piezas_por_empaque=25, tipo_empaque="bolsa", stock_actual=50, stock_minimo=10,
        )
        self.kinder = Producto.objects.create(
            nombre="Chocolate Kinder Bueno", categoria=self.chocolates, precio_venta=Decimal("22.00"),
            ultimo_costo=Decimal("15.40"), stock_actual=9, stock_minimo=5,
        )

    def entrar(self, usuario):
        r = self.client.post("/api/usuarios/login/", {"correo": usuario.correo, "contrasena": CLAVE}, format="json")
        self.assertEqual(r.status_code, 200)

    def recargar(self, *productos):
        for p in productos:
            p.refresh_from_db()

    def vender(self, *renglones):
        return self.client.post("/api/ventas/", {"renglones": list(renglones)}, format="json")

    def renglon(self, producto, cantidad, precio=None, **extra):
        return {"producto": producto.id, "cantidad": cantidad,
                "precio_unitario": str(precio if precio is not None else producto.precio_venta), **extra}


# ===========================================================================
# F-03 · Catálogo de productos
# ===========================================================================

class F03CatalogoTests(BaseInventia):
    def datos(self, **cambios):
        return {"nombre": "Paleta Payaso", "categoria": self.chocolates.id, "unidad_medida": "pieza",
                "precio_venta": "18.00", "stock_actual": 20, "stock_minimo": 5, **cambios}

    def test_cp_03_01_alta_guarda_producto_y_su_entrada_inicial(self):
        self.entrar(self.duena)
        r = self.client.post("/api/productos/", self.datos(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        nuevo = Producto.objects.get(nombre="Paleta Payaso")
        self.assertEqual(nuevo.stock_actual, 20)
        entrada = MovimientoInventario.objects.get(producto=nuevo)
        self.assertEqual(entrada.tipo_movimiento, "entrada")
        self.assertEqual(entrada.motivo, "Inventario inicial (alta del producto)")

    def test_cp_03_02_sin_nombre_no_se_guarda(self):
        self.entrar(self.duena)
        r = self.client.post("/api/productos/", self.datos(nombre=""), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("nombre", r.data)
        self.assertFalse(Producto.objects.filter(precio_venta=Decimal("18.00")).exists())

    def test_encargado_consulta_pero_no_da_de_alta_ni_ve_costos(self):
        self.entrar(self.encargado)
        self.assertEqual(self.client.post("/api/productos/", self.datos(), format="json").status_code, 403)
        lista = self.client.get("/api/productos/").data
        self.assertEqual(len(lista), 2)
        self.assertNotIn("ultimo_costo", lista[0])

    def test_propietaria_ve_costos_y_editar_no_toca_stock(self):
        self.entrar(self.duena)
        r = self.client.patch(f"/api/productos/{self.kinder.id}/", {"precio_venta": "23.00", "stock_actual": 999},
                              format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn("ultimo_costo", r.data)
        self.recargar(self.kinder)
        self.assertEqual(self.kinder.precio_venta, Decimal("23.00"))
        self.assertEqual(self.kinder.stock_actual, 9)

    def test_alta_sin_stock_no_deja_movimiento(self):
        self.entrar(self.duena)
        self.client.post("/api/productos/", self.datos(stock_actual=0), format="json")
        self.assertFalse(MovimientoInventario.objects.exists())

    def test_categorias(self):
        self.entrar(self.encargado)
        self.assertEqual(len(self.client.get("/api/categorias/").data), Categoria.objects.count())
        self.assertEqual(self.client.post("/api/categorias/", {"nombre": "X"}, format="json").status_code, 403)


# ===========================================================================
# F-04 · Registrar venta
# ===========================================================================

class F04VentaTests(BaseInventia):
    def test_cp_04_01_venta_descuenta_stock_y_calcula_total(self):
        self.entrar(self.encargado)
        r = self.vender(self.renglon(self.kinder, 2), self.renglon(self.bubulubu, 3))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["total"]), Decimal("62.00"))  # 2×22 + 3×6
        self.recargar(self.kinder, self.bubulubu)
        self.assertEqual((self.kinder.stock_actual, self.bubulubu.stock_actual), (7, 47))
        salidas = MovimientoInventario.objects.filter(venta_id=r.data["id"], tipo_movimiento="salida")
        self.assertEqual(salidas.count(), 2)

    def test_cp_04_02_mas_piezas_que_el_stock_no_se_vende(self):
        self.entrar(self.encargado)
        r = self.vender(self.renglon(self.kinder, 11))
        self.assertEqual(r.status_code, 400)
        self.assertIn("Disponible: 9", str(r.data))
        self.recargar(self.kinder)
        self.assertEqual(self.kinder.stock_actual, 9)
        self.assertFalse(Venta.objects.exists())  # todo o nada

    def test_precio_distinto_al_de_lista_se_rechaza(self):
        self.entrar(self.encargado)
        self.assertEqual(self.vender(self.renglon(self.kinder, 1, "10.00")).status_code, 400)

    def test_mayoreo_solo_desde_la_cantidad_minima(self):
        self.entrar(self.encargado)
        self.assertEqual(self.vender(self.renglon(self.bubulubu, 24, "5.00", tipo_precio="mayoreo")).status_code, 400)
        r = self.vender(self.renglon(self.bubulubu, 25, "5.00", tipo_precio="mayoreo"))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["total"]), Decimal("125.00"))

    def test_promocion_vigente(self):
        hoy = timezone.localdate()
        self.entrar(self.encargado)
        # Sin promoción, el precio de promoción no aplica
        self.assertEqual(self.vender(self.renglon(self.kinder, 1, "19.80", tipo_precio="promocion")).status_code, 400)
        Promocion.objects.create(producto=self.kinder, tipo_promocion=Promocion.TIPO_PORCENTAJE, valor=Decimal("10"),
                                 fecha_inicio=hoy, fecha_fin=hoy + timedelta(days=5))
        self.assertEqual(self.vender(self.renglon(self.kinder, 1, "20.00", tipo_precio="promocion")).status_code, 400)
        self.assertEqual(self.vender(self.renglon(self.kinder, 1, "19.80", tipo_precio="promocion")).status_code, 201)

    def test_producto_desactivado_no_se_vende(self):
        self.kinder.activo = False
        self.kinder.save()
        self.entrar(self.encargado)
        self.assertEqual(self.vender(self.renglon(self.kinder, 1)).status_code, 400)

    def test_producto_caducado_no_se_vende(self):
        hoy = timezone.localdate()
        self.kinder.fecha_caducidad = hoy - timedelta(days=1)
        self.kinder.save()
        self.entrar(self.encargado)
        r = self.vender(self.renglon(self.kinder, 1))
        self.assertEqual(r.status_code, 400)
        self.assertIn("caducado", str(r.data))
        self.recargar(self.kinder)
        self.assertEqual(self.kinder.stock_actual, 9)
        # Caduca hoy: todavía se puede vender
        self.kinder.fecha_caducidad = hoy
        self.kinder.save()
        self.assertEqual(self.vender(self.renglon(self.kinder, 1)).status_code, 201)

    def test_sin_manejar_caducidad_no_se_bloquea(self):
        self.config.maneja_caducidad = False
        self.config.save()
        self.kinder.fecha_caducidad = timezone.localdate() - timedelta(days=3)
        self.kinder.save()
        self.entrar(self.encargado)
        self.assertEqual(self.vender(self.renglon(self.kinder, 1)).status_code, 201)

    def test_venta_vacia_o_sin_sesion(self):
        self.assertIn(self.vender(self.renglon(self.kinder, 1)).status_code, (401, 403))
        self.entrar(self.encargado)
        self.assertEqual(self.vender().status_code, 400)


# ===========================================================================
# F-05 · Registrar compra
# ===========================================================================

    def test_metodo_de_pago_se_guarda_y_por_defecto_es_efectivo(self):
        self.entrar(self.encargado)
        r = self.vender(self.renglon(self.kinder, 1))
        self.assertEqual(r.data["metodo_pago"], "efectivo")
        r = self.client.post("/api/ventas/", {"renglones": [self.renglon(self.kinder, 1)],
                                              "metodo_pago": "transferencia"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Venta.objects.get(pk=r.data["id"]).metodo_pago, "transferencia")

    def test_metodo_de_pago_desconocido_se_rechaza(self):
        self.entrar(self.encargado)
        r = self.client.post("/api/ventas/", {"renglones": [self.renglon(self.kinder, 1)],
                                              "metodo_pago": "vales"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Venta.objects.exists())


class F05CompraTests(BaseInventia):
    def comprar(self, **datos):
        datos.setdefault("proveedor", "Distribuidora Ricolino")
        datos.setdefault("renglones", [{"producto": self.bubulubu.id, "cantidad": 50, "costo_unitario": "4.20"}])
        return self.client.post("/api/compras/", datos, format="json")

    def test_cp_05_01_compra_suma_stock_y_guarda_costo(self):
        self.entrar(self.encargado)
        r = self.comprar(nota="Nota 1025")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["total"]), Decimal("210.00"))  # 2 bolsas × 25 × $4.20
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.stock_actual, 100)
        self.assertEqual(self.bubulubu.ultimo_costo, Decimal("4.20"))

    def test_cp_05_02_sin_proveedor_no_se_registra(self):
        self.entrar(self.encargado)
        r = self.comprar(proveedor="")
        self.assertEqual(r.status_code, 400)
        self.assertIn("proveedor", r.data)
        self.assertFalse(Compra.objects.exists())

    def test_caducidad_mas_proxima_y_fecha_de_otro_dia(self):
        self.bubulubu.fecha_caducidad = date(2027, 5, 1)
        self.bubulubu.save()
        ayer = timezone.localdate() - timedelta(days=1)
        self.entrar(self.duena)
        r = self.comprar(fecha=ayer.isoformat(), renglones=[
            {"producto": self.bubulubu.id, "cantidad": 25, "costo_unitario": "4.00", "fecha_caducidad": "2027-03-15"}])
        self.assertEqual(r.status_code, 201, r.data)
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.fecha_caducidad, date(2027, 3, 15))
        self.assertEqual(timezone.localtime(Compra.objects.get().fecha_compra).date(), ayer)

    def test_producto_desactivado_no_se_compra(self):
        self.bubulubu.activo = False
        self.bubulubu.save()
        self.entrar(self.encargado)
        self.assertEqual(self.comprar().status_code, 400)


# ===========================================================================
# F-06 · Registrar merma
# ===========================================================================

class F06MermaTests(BaseInventia):
    def merma(self, **datos):
        datos = {"producto": self.bubulubu.id, "tipo_movimiento": "merma", **datos}
        return self.client.post("/api/movimientos/", datos, format="json")

    def test_cp_06_01_merma_descuenta_con_su_motivo(self):
        self.entrar(self.encargado)
        r = self.merma(cantidad=2, motivo_merma="danado", observaciones="Bolsa aplastada al acomodar")
        self.assertEqual(r.status_code, 201, r.data)
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.stock_actual, 48)

    def test_cp_06_02_motivo_otro_sin_nota_se_rechaza(self):
        self.entrar(self.encargado)
        self.assertEqual(self.merma(cantidad=5, motivo_merma="otro").status_code, 400)
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.stock_actual, 50)


# ===========================================================================
# F-07 · Corrección de inventario
# ===========================================================================

class F07CorreccionTests(BaseInventia):
    def corregir(self, diferencia, **datos):
        return self.client.post("/api/movimientos/", {"producto": self.bubulubu.id, "tipo_movimiento": "correccion",
                                                      "cantidad": diferencia, **datos}, format="json")

    def test_cp_07_01_propietaria_ajusta_al_conteo(self):
        self.entrar(self.duena)
        r = self.corregir(-2, observaciones="Conteo semanal")
        self.assertEqual(r.status_code, 201, r.data)
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.stock_actual, 48)

    def test_cp_07_02_sin_motivo_no_se_aplica(self):
        self.entrar(self.duena)
        self.assertEqual(self.corregir(-3).status_code, 400)
        self.recargar(self.bubulubu)
        self.assertEqual(self.bubulubu.stock_actual, 50)

    def test_encargado_no_puede_corregir(self):
        self.entrar(self.encargado)
        self.assertEqual(self.corregir(-2, observaciones="Conteo").status_code, 403)


# ===========================================================================
# F-08 · Historial de movimientos (integración: ventas, compras y mermas en un solo lugar)
# ===========================================================================

class F08HistorialTests(BaseInventia):
    def test_cp_08_01_historial_reune_todos_los_movimientos(self):
        self.entrar(self.duena)
        self.vender(self.renglon(self.kinder, 1))
        self.client.post("/api/compras/", {"proveedor": "La Merced", "renglones": [
            {"producto": self.bubulubu.id, "cantidad": 25, "costo_unitario": "4.20"}]}, format="json")
        self.client.post("/api/movimientos/", {"producto": self.bubulubu.id, "tipo_movimiento": "merma",
                                               "cantidad": 1, "motivo_merma": "caducado"}, format="json")
        historial = self.client.get("/api/movimientos/").data
        tipos = {m["tipo_movimiento"] for m in historial}
        self.assertEqual(tipos, {"salida", "entrada", "merma"})
        self.assertTrue(all(m["usuario_nombre"] == "Ana Luisa Reyes" for m in historial))
        self.assertEqual(len(self.client.get("/api/ventas/").data), 1)
        self.assertEqual(len(self.client.get("/api/compras/").data), 1)

    def test_cp_08_02_movimiento_inexistente(self):
        self.entrar(self.duena)
        self.assertEqual(self.client.get("/api/movimientos/99999/").status_code, 404)

    def test_historial_no_se_edita_ni_se_borra(self):
        self.entrar(self.duena)
        self.client.post("/api/movimientos/", {"producto": self.bubulubu.id, "tipo_movimiento": "entrada",
                                               "cantidad": 1}, format="json")
        mov = MovimientoInventario.objects.get()
        self.assertEqual(self.client.delete(f"/api/movimientos/{mov.id}/").status_code, 405)
        self.assertEqual(self.client.patch(f"/api/movimientos/{mov.id}/", {"cantidad": 9}, format="json").status_code,
                         405)


# ===========================================================================
# F-09 · Alertas de stock y caducidad
# ===========================================================================

class F09AlertasTests(BaseInventia):
    def test_cp_09_01_detecta_stock_bajo_y_por_caducar(self):
        self.kinder.stock_actual = 0
        self.kinder.save()
        self.bubulubu.fecha_caducidad = timezone.localdate() + timedelta(days=5)
        self.bubulubu.save()
        self.entrar(self.encargado)
        r = self.client.get("/api/alertas/resumen/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p["nombre"] for p in r.data["stock_bajo"]], ["Chocolate Kinder Bueno"])
        self.assertEqual(r.data["por_caducar"][0]["dias_restantes"], 5)
        self.assertIn("Chocolate Kinder Bueno", r.data["mensaje"])

    def test_cp_09_02_sin_riesgos_no_hay_alertas(self):
        self.entrar(self.encargado)
        r = self.client.get("/api/alertas/resumen/")
        self.assertEqual((r.data["stock_bajo"], r.data["por_caducar"]), ([], []))

    def test_sin_caducidad_no_avisa_de_caducidad(self):
        self.config.maneja_caducidad = False
        self.config.save()
        self.bubulubu.fecha_caducidad = timezone.localdate() + timedelta(days=2)
        self.bubulubu.save()
        self.entrar(self.encargado)
        self.assertEqual(self.client.get("/api/alertas/resumen/").data["por_caducar"], [])

    def test_estado_de_los_avisos(self):
        self.entrar(self.encargado)
        r = self.client.get("/api/alertas/estado/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["alertas_activas"])
        self.assertIsNone(r.data["ultimo_envio"])
        self.assertIsNotNone(r.data["proximo_envio"])


# ===========================================================================
# F-10 · Avisos por correo (integración con el servicio SMTP, simulado en memoria)
# ===========================================================================

@CORREO
class F10CorreoTests(BaseInventia):
    def test_cp_10_01_correo_de_prueba_se_envia(self):
        self.entrar(self.duena)
        r = self.client.post("/api/alertas/prueba/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["avisos@querubines.com"])

    def test_cp_10_02_correo_mal_escrito_no_se_guarda(self):
        self.entrar(self.duena)
        r = self.client.patch("/api/configuracion/", {"email": {"correo_alertas": "ana@"}}, format="json")
        self.assertEqual(r.status_code, 400)
        self.config.refresh_from_db()
        self.assertEqual(self.config.correo_alertas, "avisos@querubines.com")

    def test_enviar_ahora_manda_resumen_html(self):
        self.kinder.stock_actual = 0
        self.kinder.save()
        self.entrar(self.duena)
        r = self.client.post("/api/alertas/enviar-ahora/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["enviada"])
        correo = mail.outbox[0]
        self.assertIn("atención", correo.subject)
        self.assertIn("Chocolate Kinder Bueno", correo.alternatives[0][0])

    def test_sin_correo_o_sin_claves(self):
        self.entrar(self.duena)
        self.config.correo_alertas = ""
        self.config.save()
        self.assertEqual(self.client.post("/api/alertas/prueba/").status_code, 400)
        self.assertEqual(self.client.post("/api/alertas/enviar-ahora/").status_code, 400)
        self.config.correo_alertas = "avisos@querubines.com"
        self.config.save()
        with override_settings(BREVO_SMTP_KEY=""):
            self.assertEqual(self.client.post("/api/alertas/prueba/").status_code, 503)
            self.assertEqual(self.client.post("/api/alertas/enviar-ahora/").status_code, 503)

    def test_falla_de_conexion_queda_pendiente(self):
        self.entrar(self.duena)
        with mock.patch.object(ca.CorreoConLogo, "send", side_effect=OSError("sin internet")):
            self.assertEqual(self.client.post("/api/alertas/prueba/").status_code, 503)
            self.assertEqual(self.client.post("/api/alertas/enviar-ahora/").status_code, 503)
        registro = AlertaStock.objects.get()
        self.assertFalse(registro.enviada)
        self.assertEqual(registro.ultimo_error, "sin internet")

    def test_encargado_no_envia(self):
        self.entrar(self.encargado)
        self.assertEqual(self.client.post("/api/alertas/enviar-ahora/").status_code, 403)


@CORREO
class ReglaSinSpamTests(BaseInventia):
    """La revisión diaria solo escribe cuando hay algo nuevo (correo_alertas.revisar_hoy)."""

    def setUp(self):
        super().setUp()
        self.kinder.stock_actual = 2  # bajo el mínimo (5)
        self.kinder.save()

    def test_novedad_y_luego_sin_novedad(self):
        primero = ca.revisar_hoy()
        self.assertEqual(primero.motivo, ch.NOVEDAD)
        self.assertTrue(primero.enviada)
        self.assertIsNone(ca.revisar_hoy())  # una sola revisión al día

        manana = timezone.localdate() + timedelta(days=1)
        if manana.weekday() == ca.LUNES:
            manana += timedelta(days=1)
        with mock.patch.object(ca.timezone, "localdate", return_value=manana):
            segundo = ca.revisar_hoy()
        self.assertEqual(segundo.motivo, ca.SIN_NOVEDAD)  # lo mismo que ayer: no escribe
        self.assertEqual(len(mail.outbox), 1)

    def test_sin_riesgos_no_escribe(self):
        self.kinder.stock_actual = 9
        self.kinder.save()
        self.assertEqual(ca.revisar_hoy().motivo, ca.SIN_NOVEDAD)
        self.assertEqual(len(mail.outbox), 0)

    def test_recordatorio_de_los_lunes(self):
        lunes = date(2026, 11, 9)
        resumen = ca.armar_resumen(self.config, lunes, conocida={f"bajo:{self.kinder.pk}"})
        self.assertEqual(ca.decidir_motivo(resumen, lunes), ch.RECORDATORIO)
        martes = lunes + timedelta(days=1)
        self.assertEqual(ca.decidir_motivo(resumen, martes), ca.SIN_NOVEDAD)

    def test_bajo_despues_de_agotado_no_es_novedad(self):
        resumen = ca.armar_resumen(self.config, conocida={f"agotado:{self.kinder.pk}"})
        self.assertEqual(resumen["nuevos"], 0)

    def test_caducidad_urgente_es_novedad(self):
        self.kinder.stock_actual = 9
        self.kinder.save()
        self.bubulubu.fecha_caducidad = timezone.localdate() + timedelta(days=3)
        self.bubulubu.save()
        resumen = ca.armar_resumen(self.config, conocida=set())
        self.assertEqual(resumen["nuevos"], 1)
        self.assertTrue(resumen["caducan"][0]["urgente"])

    def test_pendiente_se_reintenta_y_descarta_lo_viejo(self):
        with mock.patch.object(ca.CorreoConLogo, "send", side_effect=OSError("sin internet")):
            registro = ca.revisar_hoy()
        self.assertFalse(registro.enviada)
        AlertaStock.objects.filter(pk=registro.pk).update(fecha_generacion=timezone.now() - timedelta(minutes=10))
        reintento = ca.reintentar_pendientes()
        self.assertTrue(reintento.enviada)
        self.assertIsNone(ca.reintentar_pendientes())  # ya no queda nada pendiente

        viejo = AlertaStock.objects.create(fecha_resumen=timezone.localdate() - timedelta(days=1), motivo=ch.NOVEDAD,
                                           mensaje="x")
        ca._descartar_viejos(timezone.localdate())
        viejo.refresh_from_db()
        self.assertEqual(viejo.motivo, ca.DESCARTADO)

    def test_reintento_cuando_ya_se_resolvio(self):
        with mock.patch.object(ca.CorreoConLogo, "send", side_effect=OSError("sin internet")):
            registro = ca.revisar_hoy()
        AlertaStock.objects.filter(pk=registro.pk).update(fecha_generacion=timezone.now() - timedelta(minutes=10))
        self.kinder.stock_actual = 9
        self.kinder.save()
        AlertaStock.objects.create(fecha_resumen=timezone.localdate() - timedelta(days=3), motivo=ca.SIN_NOVEDAD,
                                   firma=json.dumps([]), mensaje="x")
        self.assertEqual(ca.reintentar_pendientes().motivo, ca.SIN_NOVEDAD)

    def test_alertas_apagadas_no_revisan(self):
        self.config.alertas_activas = False
        self.config.save()
        self.assertIsNone(ca.revisar_hoy())
        self.assertIsNone(ca.reintentar_pendientes())
        revisar_alertas()  # el programador de tareas tampoco hace nada
        self.assertFalse(AlertaStock.objects.exists())

    def test_programador_revisa_a_la_hora_elegida(self):
        self.config.hora_resumen = time(0, 0)
        self.config.save()
        ahora = timezone.localtime().replace(minute=5)
        with mock.patch.object(ca.timezone, "localtime", return_value=ahora):
            from . import alertas_scheduler
            with mock.patch.object(alertas_scheduler.timezone, "localtime", return_value=ahora):
                revisar_alertas()
        self.assertEqual(AlertaStock.objects.count(), 1)

    def test_nombre_anterior_y_firma_danada(self):
        self.assertEqual(ca.enviar_resumen_hoy(forzar=True).motivo, ch.MANUAL)
        AlertaStock.objects.create(fecha_resumen=timezone.localdate(), motivo=ca.SIN_NOVEDAD, firma="no-es-json",
                                   mensaje="x")
        self.assertEqual(ca.firma_conocida(), set())


class CorreoHtmlTests(TestCase):
    """El texto y el HTML del aviso (correo_html.py)."""

    def resumen(self, **cambios):
        datos = {
            "fecha": date(2026, 11, 6), "negocio": "Dulcería Los Querubines", "maneja_caducidad": True,
            "dias_aviso": 30, "agotados": 1, "nuevos": 2, "total_productos": 3, "primero": False, "firma": [],
            "stock": [
                {"id": 1, "nombre": "Kinder Bueno", "stock": 0, "minimo": 5, "agotado": True, "nuevo": True},
                {"id": 2, "nombre": "Pulparindo", "stock": 2, "minimo": 10, "agotado": False, "nuevo": False},
            ],
            "caducan": [
                {"id": 3, "nombre": "Bubulubu mini", "stock": 50, "dias": 3, "urgente": True, "nuevo": True},
                {"id": 4, "nombre": "Mazapán", "stock": 10, "dias": 0, "urgente": True, "nuevo": False},
                {"id": 5, "nombre": "Paleta", "stock": 10, "dias": -2, "urgente": True, "nuevo": False},
                {"id": 6, "nombre": "Gomitas", "stock": 10, "dias": 1, "urgente": True, "nuevo": False},
                {"id": 7, "nombre": "Chicle", "stock": 10, "dias": 20, "urgente": False, "nuevo": False},
                {"id": 8, "nombre": "Cacahuate", "stock": 10, "dias": 25, "urgente": False, "nuevo": False},
            ],
        }
        datos.update(cambios)
        return datos

    def test_texto_y_html_para_cada_motivo(self):
        for motivo in (ch.NOVEDAD, ch.RECORDATORIO, ch.MANUAL):
            with self.subTest(motivo=motivo):
                r = self.resumen(primero=(motivo == ch.NOVEDAD))
                self.assertTrue(ch.asunto(r, motivo).startswith("INVENTIA"))
                self.assertIn("Kinder Bueno", ch.armar_texto(r, motivo))
                html = ch.armar_html(r, motivo, logo_url="https://ejemplo.com/logo.png")
                self.assertIn('lang="es"', html)
                self.assertIn("y 1 más", html)  # más de 5 por caducar

    def test_sin_productos_y_sin_caducidad(self):
        r = self.resumen(stock=[], caducan=[], total_productos=0, nuevos=0, maneja_caducidad=False)
        self.assertIn("INVENTIA", ch.asunto(r, ch.MANUAL))
        self.assertIn("cid:", ch.armar_html(r, ch.MANUAL))  # sin URL, el logo va pegado
        self.assertEqual(ch.plural(1, "producto", "productos"), "1 producto")
        self.assertIn("Caducó", ch.texto_caducidad(-1))
        self.assertIn("hoy", ch.texto_caducidad(0).lower())
        self.assertEqual(ch.texto_caducidad(1), "En 1 día")


# ===========================================================================
# F-12 · Autorizar cambio de precio con PIN
# ===========================================================================

class F12PinTests(BaseInventia):
    def poner_pin(self, pin="1234", actual=""):
        return self.client.post("/api/configuracion/pin/", {"pin_nuevo": pin, "pin_actual": actual}, format="json")

    def autorizar(self, pin, precio="25.00", motivo="Ajuste de precio"):
        return self.client.post("/api/autorizaciones/precio/", {"producto": self.kinder.id, "precio": precio,
                                                                "motivo": motivo, "pin": pin}, format="json")

    def test_cp_12_01_pin_correcto_autoriza_y_queda_quien_autorizo(self):
        self.entrar(self.duena)
        self.assertEqual(self.poner_pin().status_code, 200)
        self.entrar(self.encargado)
        r = self.autorizar("1234")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["autorizado_por"], "Ana Luisa Reyes")

        venta = self.vender(self.renglon(self.kinder, 1, "25.00", tipo_precio="editado",
                                         autorizacion=r.data["autorizacion"]))
        self.assertEqual(venta.status_code, 201, venta.data)
        detalle = Venta.objects.get().detalles.get()
        self.assertEqual(detalle.autorizado_por, self.duena)
        self.assertEqual(detalle.motivo_precio, "Ajuste de precio")

    def test_cp_12_02_pin_incorrecto_se_rechaza_y_se_bloquea(self):
        self.entrar(self.duena)
        self.poner_pin()
        self.entrar(self.encargado)
        r = self.autorizar("9999")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Te quedan 2 intentos", r.data["pin"])
        self.autorizar("9999")
        r = self.autorizar("9999")
        self.assertTrue(r.data["bloqueado"])
        r = self.autorizar("1234")  # bloqueado aunque ahora sea el correcto
        self.assertIn("bloqueado", r.data["pin"])

    def test_encargado_sin_sello_no_cambia_precio(self):
        self.entrar(self.encargado)
        r = self.vender(self.renglon(self.kinder, 1, "25.00", tipo_precio="editado", autorizacion="sello-falso"))
        self.assertEqual(r.status_code, 400)
        sello = firmar_autorizacion(self.kinder.id, "25.00", "Otro: prueba", self.duena.id)
        r = self.vender(self.renglon(self.kinder, 1, "24.00", tipo_precio="editado", autorizacion=sello))
        self.assertEqual(r.status_code, 400)  # el sello es para otro precio

    def test_propietaria_cambia_precio_sin_pin(self):
        self.entrar(self.duena)
        r = self.vender(self.renglon(self.kinder, 1, "20.00", tipo_precio="editado"))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Venta.objects.get().detalles.get().motivo_precio, "Ajuste de precio")

    def test_validaciones_del_pin_y_la_autorizacion(self):
        self.entrar(self.duena)
        self.assertEqual(self.poner_pin("12a4").status_code, 400)
        self.poner_pin()
        self.assertEqual(self.poner_pin("5678", actual="0000").status_code, 400)
        self.assertEqual(self.poner_pin("5678", actual="1234").status_code, 200)
        self.assertEqual(self.autorizar("5678", precio="0").status_code, 400)
        self.assertEqual(self.autorizar("5678", motivo="Otro").status_code, 400)
        inexistente = {"producto": 9999, "precio": "1", "motivo": "Ajuste de precio", "pin": "5678"}
        r = self.client.post("/api/autorizaciones/precio/", inexistente, format="json")
        self.assertEqual(r.status_code, 400)

    def test_funciones_de_autorizacion(self):
        self.assertTrue(motivo_valido("Otro: cliente frecuente"))
        self.assertFalse(motivo_valido("Otro: ab"))
        self.assertIsNone(leer_autorizacion("no-es-un-sello"))
        self.assertEqual(leer_autorizacion(firmar_autorizacion(1, "5", "Ajuste de precio", 2))["precio"], "5.00")
        self.config.pin_hash = ""
        self.assertEqual(verificar_pin(self.config, "1234")[0], False)

    def test_sin_negocio(self):
        self.entrar(self.duena)
        Configuracion.objects.all().delete()
        Negocio.objects.all().delete()
        self.assertEqual(self.poner_pin().status_code, 404)
        self.assertEqual(self.autorizar("1234").status_code, 404)
        self.assertEqual(self.client.get("/api/configuracion/").status_code, 404)
        self.assertEqual(self.client.patch("/api/configuracion/", {}, format="json").status_code, 404)


# ===========================================================================
# F-13 · Panel principal: los datos con los que calcula ventas y ganancia
# ===========================================================================

class F13PanelTests(BaseInventia):
    def test_cp_13_01_ventas_traen_detalle_para_calcular_ganancia(self):
        self.entrar(self.duena)
        self.vender(self.renglon(self.kinder, 2))
        venta = self.client.get("/api/ventas/").data[0]
        detalle = venta["detalles"][0]
        self.assertEqual(Decimal(venta["total"]), Decimal("44.00"))
        self.assertEqual(Decimal(detalle["costo_unitario"]), Decimal("15.40"))  # ganancia = (22 − 15.40) × 2
        self.assertEqual(venta["usuario_nombre"], "Ana Luisa Reyes")

    def test_cp_13_02_negocio_sin_ventas(self):
        self.entrar(self.duena)
        self.assertEqual(self.client.get("/api/ventas/").data, [])
        self.assertEqual(self.client.get("/api/ventas/99999/").status_code, 404)


# ===========================================================================
# Configuración del negocio y promociones
# ===========================================================================

class ConfiguracionTests(BaseInventia):
    def test_consultar_y_guardar(self):
        self.entrar(self.encargado)
        self.assertEqual(self.client.get("/api/configuracion/").data["negocio"]["nombre"], "Dulcería Los Querubines")
        self.entrar(self.duena)
        r = self.client.patch("/api/configuracion/", {
            "negocio": {"nombre": "Dulcería Los Querubines 2", "direccion": "Centro", "telefono": ""},
            "preferencias": {"usa_codigo_barras": True},
            "email": {"correo_alertas": "nuevo@querubines.com", "hora_resumen": "21:30", "dias_aviso_caducidad": 15},
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["preferencias"]["usa_codigo_barras"])
        self.assertEqual(r.data["email"]["hora_resumen"], "21:30")
        self.assertEqual(r.data["negocio"]["telefono"], "")

    def test_errores_de_configuracion(self):
        self.entrar(self.duena)
        r = self.client.patch("/api/configuracion/", {
            "negocio": {"nombre": " ", "telefono": "123"},
            "email": {"correo_alertas": "", "hora_resumen": "8pm", "dias_aviso_caducidad": 500},
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.data), {"nombre", "telefono", "correo_alertas", "hora_resumen", "dias_aviso_caducidad"})

    def test_sin_alertas_el_correo_puede_quedar_vacio(self):
        self.entrar(self.duena)
        r = self.client.patch("/api/configuracion/", {"preferencias": {"alertas_activas": False},
                                                      "email": {"correo_alertas": ""}}, format="json")
        self.assertEqual(r.status_code, 200, r.data)


class PromocionesTests(BaseInventia):
    def promo(self, **cambios):
        hoy = timezone.localdate()
        datos = {"producto": self.kinder.id, "tipo_promocion": Promocion.TIPO_PORCENTAJE, "valor": "10",
                 "fecha_inicio": hoy.isoformat(), "fecha_fin": (hoy + timedelta(days=7)).isoformat(), **cambios}
        return self.client.post("/api/promociones/", datos, format="json")

    def test_crear_y_consultar(self):
        self.entrar(self.duena)
        self.assertEqual(self.promo().status_code, 201)
        self.entrar(self.encargado)
        lista = self.client.get(f"/api/promociones/?producto={self.kinder.id}").data
        self.assertEqual(len(lista), 1)
        producto = self.client.get(f"/api/productos/{self.kinder.id}/").data
        self.assertEqual(producto["promocion_vigente"]["tipo"], "porcentaje")

    def test_validaciones(self):
        self.entrar(self.duena)
        self.assertEqual(self.promo(valor="0").status_code, 400)
        self.assertEqual(self.promo(valor="95").status_code, 400)
        self.assertEqual(self.promo(tipo_promocion=Promocion.TIPO_MONTO, valor="30").status_code, 400)
        self.assertEqual(self.promo(fecha_fin="2020-01-01").status_code, 400)
        self.promo()
        self.assertEqual(self.promo(valor="5").status_code, 400)  # encimada con la otra
        self.entrar(self.encargado)
        self.assertEqual(self.promo().status_code, 403)
