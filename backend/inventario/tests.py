from django.contrib.auth.hashers import make_password
from rest_framework.test import APITestCase

from .models import Categoria, MovimientoInventario, Producto
from usuarios.models import Usuario

URL = "/api/movimientos/"


class MovimientosTests(APITestCase):
    def setUp(self):
        self.propietario = Usuario.objects.create(
            nombre_completo="Dueña", correo="duena@test.com",
            contrasena_hash=make_password("clave123"),
            telefono_whatsapp="5500000000", rol="propietario", activo=True,
        )
        self.encargado = Usuario.objects.create(
            nombre_completo="Encargado", correo="enc@test.com",
            contrasena_hash=make_password("clave123"),
            telefono_whatsapp="5500000001", rol="encargado", activo=True,
        )
        categoria = Categoria.objects.create(nombre="Dulces")
        self.producto = Producto.objects.create(
            nombre="Mazapán", categoria=categoria,
            stock_actual=10, stock_minimo=3, precio_venta=5,
        )

    def entrar(self, usuario):
        r = self.client.post(
            "/api/usuarios/login/",
            {"correo": usuario.correo, "contrasena": "clave123"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

    def mover(self, **datos):
        datos.setdefault("producto", self.producto.id)
        return self.client.post(URL, datos, format="json")

    def stock(self):
        self.producto.refresh_from_db()
        return self.producto.stock_actual

    # ---------- sesión ----------

    def test_sin_sesion_no_deja(self):
        r = self.mover(tipo="ENTRADA", cantidad=5)
        self.assertIn(r.status_code, (401, 403))
        self.assertEqual(self.stock(), 10)

    # ---------- entrada y salida ----------

    def test_entrada_suma_y_guarda_stock_resultante(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="ENTRADA", cantidad=5)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.stock(), 15)
        # CAMBIO: antes era r.data["tipo"] == "ENTRADA". Ahora el campo se llama
        # tipo_movimiento y viene en minúsculas.
        self.assertEqual(r.data["tipo_movimiento"], "entrada")
        self.assertEqual(r.data["stock_resultante"], 15)
        self.assertEqual(r.data["usuario"], self.encargado.id)

    def test_tipo_en_minusculas_tambien_se_acepta(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="entrada", cantidad=1)
        self.assertEqual(r.status_code, 201, r.data)

    def test_salida_resta(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="SALIDA", cantidad=4)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.stock(), 6)

    def test_salida_no_deja_stock_negativo(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="SALIDA", cantidad=11)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(), 10)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    def test_cantidad_cero_o_negativa_se_rechaza(self):
        self.entrar(self.encargado)
        self.assertEqual(self.mover(tipo="ENTRADA", cantidad=0).status_code, 400)
        self.assertEqual(self.mover(tipo="SALIDA", cantidad=-3).status_code, 400)
        self.assertEqual(self.stock(), 10)

    # ---------- merma ----------

    def test_merma_resta_y_guarda_motivo(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="MERMA", cantidad=2, motivo_merma="caducado")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.stock(), 8)
        self.assertEqual(r.data["motivo_merma"], "caducado")

    def test_merma_acepta_nombres_del_frontend(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="MERMA", cantidad=1, motivo_merma="consumo")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["motivo_merma"], "consumo_propio")
        r = self.mover(tipo="MERMA", cantidad=1, motivo_merma="devolucion")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["motivo_merma"], "devolucion_proveedor")

    def test_merma_sin_motivo_se_rechaza(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="MERMA", cantidad=2)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(), 10)

    def test_merma_otro_exige_nota(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="MERMA", cantidad=1, motivo_merma="otro")
        self.assertEqual(r.status_code, 400)
        r = self.mover(tipo="MERMA", cantidad=1, motivo_merma="otro", observaciones="Se mojó")
        self.assertEqual(r.status_code, 201, r.data)

    def test_merma_no_deja_stock_negativo(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="MERMA", cantidad=50, motivo_merma="danado")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(), 10)

    def test_motivo_merma_se_ignora_en_otros_tipos(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="ENTRADA", cantidad=1, motivo_merma="caducado")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNone(r.data["motivo_merma"])

    # ---------- corrección ----------

    def test_encargado_no_puede_corregir(self):
        self.entrar(self.encargado)
        r = self.mover(tipo="CORRECCION", cantidad=-2, observaciones="Conteo")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.stock(), 10)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    def test_propietario_corrige_faltante_y_sobrante(self):
        self.entrar(self.propietario)
        r = self.mover(tipo="CORRECCION", cantidad=-3, observaciones="Conteo semanal")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.stock(), 7)
        self.assertEqual(r.data["cantidad"], -3)
        self.assertEqual(r.data["stock_resultante"], 7)

        r = self.mover(tipo="CORRECCION", cantidad=5, observaciones="Conteo semanal")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.stock(), 12)

    def test_correccion_exige_motivo_y_diferencia(self):
        self.entrar(self.propietario)
        self.assertEqual(self.mover(tipo="CORRECCION", cantidad=-1).status_code, 400)
        self.assertEqual(
            self.mover(tipo="CORRECCION", cantidad=0, observaciones="x").status_code, 400
        )
        self.assertEqual(self.stock(), 10)

    def test_correccion_no_deja_stock_negativo(self):
        self.entrar(self.propietario)
        r = self.mover(tipo="CORRECCION", cantidad=-11, observaciones="Conteo")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(), 10)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    # ---------- otros ----------

    def test_producto_desactivado_no_se_mueve(self):
        self.entrar(self.encargado)
        self.producto.activo = False
        self.producto.save()
        r = self.mover(tipo="ENTRADA", cantidad=1)
        self.assertEqual(r.status_code, 400)

    def test_historial_lista_movimientos(self):
        self.entrar(self.encargado)
        self.mover(tipo="ENTRADA", cantidad=2)
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["producto_nombre"], "Mazapán")

    # ================================================================
    # CAMBIO: TODO LO DE ABAJO ES NUEVO (pruebas de los nombres del DER)
    # ================================================================

    def test_respuesta_usa_nombres_del_der(self):
        self.entrar(self.encargado)
        r = self.client.post(
            URL,
            {
                "producto": self.producto.id,
                "tipo_movimiento": "merma",
                "cantidad": 2,
                "motivo_merma": "otro",
                "motivo": "Se cayó",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["tipo_movimiento"], "merma")
        self.assertEqual(r.data["motivo"], "Se cayó")
        self.assertEqual(r.data["motivo_merma"], "otro")
        self.assertEqual(r.data["stock_resultante"], 8)
        self.assertEqual(r.data["producto_nombre"], "Mazapán")
        self.assertEqual(r.data["usuario"], self.encargado.id)
        self.assertEqual(r.data["usuario_nombre"], "Encargado")
        self.assertIn("fecha_movimiento", r.data)
        self.assertIsNone(r.data["venta"])
        self.assertIsNone(r.data["compra"])
        # Los nombres viejos ya no se devuelven
        for viejo in ("tipo", "fecha", "observaciones"):
            self.assertNotIn(viejo, r.data)

    def test_usuario_no_se_puede_mandar_desde_el_frontend(self):
        self.entrar(self.encargado)
        r = self.client.post(
            URL,
            {
                "producto": self.producto.id,
                "tipo_movimiento": "entrada",
                "cantidad": 1,
                "usuario": self.propietario.id,
                "stock_resultante": 999,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["usuario"], self.encargado.id)
        self.assertEqual(r.data["stock_resultante"], 11)

    def test_tipo_movimiento_acepta_mayusculas(self):
        self.entrar(self.encargado)
        r = self.client.post(
            URL,
            {"producto": self.producto.id, "tipo_movimiento": "SALIDA", "cantidad": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["tipo_movimiento"], "salida")