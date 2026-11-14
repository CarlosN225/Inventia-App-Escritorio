"""Pruebas de respaldos: crear, podar, correo semanal y restaurar."""
import io
import tempfile
import zipfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core import mail
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from usuarios.models import Usuario

from . import respaldos
from .models import Categoria, Configuracion, Negocio, Producto

CLAVE = "Clave1234"
RAPIDO = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
CON_BREVO = override_settings(
    BREVO_SMTP_LOGIN="login", BREVO_SMTP_KEY="clave", BREVO_FROM_EMAIL="equipo@x.com",
    DEFAULT_FROM_EMAIL="equipo@x.com", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)


@RAPIDO
class RespaldosTests(TransactionTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.carpeta = Path(self.tmp.name) / "Respaldos"
        self.duena = Usuario.objects.create(
            nombre_completo="Ana", correo="ana@querubines.com", contrasena_hash=make_password(CLAVE),
            telefono_whatsapp="", rol="propietario", activo=True,
        )
        self.encargado = Usuario.objects.create(
            nombre_completo="Luis", correo="luis@querubines.com", contrasena_hash=make_password(CLAVE),
            telefono_whatsapp="", rol="encargado", activo=True,
        )
        negocio = Negocio.objects.create(nombre="Los Querubines", propietario="Ana", direccion="",
                                         usuario_admin=self.duena)
        self.config = Configuracion.objects.create(negocio=negocio, correo_alertas="ana@querubines.com",
                                                   carpeta_respaldo=str(self.carpeta))
        cat = Categoria.objects.create(nombre="Dulces")
        self.producto = Producto.objects.create(nombre="Mazapán", categoria=cat, precio_venta=Decimal("6"),
                                                stock_actual=40, stock_minimo=5)

    def tearDown(self):
        self.tmp.cleanup()

    def entrar(self, usuario):
        self.client.post("/api/usuarios/login/", {"correo": usuario.correo, "contrasena": CLAVE},
                         content_type="application/json")

    # ---------- Crear ----------

    def test_respaldo_es_un_zip_con_base_y_ficha(self):
        archivo = respaldos.crear_respaldo(self.carpeta, "manual")
        self.assertTrue(archivo.name.startswith("Inventia_respaldo_") and archivo.name.endswith("_manual.zip"))
        with zipfile.ZipFile(archivo) as z:
            self.assertEqual(set(z.namelist()), {"inventia.sqlite3", "respaldo.json"})
        self.assertEqual(respaldos.listar(self.carpeta)[0]["tipo"], "manual")

    def test_solo_se_conservan_10_automaticos(self):
        for i in range(12):
            (self.carpeta).mkdir(exist_ok=True)
            (self.carpeta / f"Inventia_respaldo_2026-10-{i + 1:02d}_0900_auto.zip").write_bytes(b"x")
        (self.carpeta / "Inventia_respaldo_2026-09-01_0900_manual.zip").write_bytes(b"x")
        respaldos.podar_automaticos(self.carpeta)
        tipos = [r["tipo"] for r in respaldos.listar(self.carpeta)]
        self.assertEqual(tipos.count("auto"), 10)
        self.assertEqual(tipos.count("manual"), 1)  # los manuales no se borran

    def test_automatico_diario_solo_una_vez(self):
        self.assertTrue(respaldos.revisar_automaticos()["diario"])
        self.assertFalse(respaldos.revisar_automaticos()["diario"])

    def test_api_crear_solo_propietario(self):
        self.entrar(self.encargado)
        self.assertEqual(self.client.post("/api/respaldos/crear/").status_code, 403)
        self.entrar(self.duena)
        r = self.client.post("/api/respaldos/crear/", {}, content_type="application/json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(len(self.client.get("/api/respaldos/").json()["respaldos"]), 1)

    def test_carpeta_relativa_se_rechaza(self):
        self.entrar(self.duena)
        r = self.client.patch("/api/respaldos/carpeta/", {"carpeta": "respaldos"}, content_type="application/json")
        self.assertEqual(r.status_code, 400)

    # ---------- Correo ----------

    def test_viernes_en_la_noche(self):
        sabado = timezone.make_aware(datetime(2026, 11, 14, 10, 0))
        self.assertEqual(respaldos.ultimo_viernes_noche(sabado), timezone.make_aware(datetime(2026, 11, 13, 20, 0)))
        viernes_tarde = timezone.make_aware(datetime(2026, 11, 13, 19, 0))
        self.assertEqual(respaldos.ultimo_viernes_noche(viernes_tarde),
                         timezone.make_aware(datetime(2026, 11, 6, 20, 0)))

    @CON_BREVO
    def test_correo_lleva_el_zip_adjunto_y_solo_una_vez_por_semana(self):
        sabado = timezone.make_aware(datetime(2026, 11, 14, 10, 0))
        self.assertTrue(respaldos.revisar_automaticos(sabado)["correo"])
        self.assertEqual(len(mail.outbox), 1)
        nombre, contenido, tipo = mail.outbox[0].attachments[0]
        self.assertTrue(nombre.endswith("_correo.zip"))
        self.assertEqual(tipo, "application/zip")
        self.assertIn("inventia.sqlite3", zipfile.ZipFile(io.BytesIO(contenido)).namelist())
        self.assertEqual(mail.outbox[0].to, ["ana@querubines.com"])
        # Ya se mandó esta semana
        self.assertFalse(respaldos.revisar_automaticos(sabado)["correo"])
    
    # Sin claves de Brevo, aunque la máquina tenga un .env con las reales
    @override_settings(BREVO_SMTP_LOGIN="", BREVO_SMTP_KEY="")
    
    def test_sin_brevo_el_correo_avisa(self):
        self.entrar(self.duena)
        r = self.client.post("/api/respaldos/correo/")
        self.assertEqual(r.status_code, 400)
        self.assertIn("no está configurado", r.json()["error"])

    # ---------- Restaurar ----------

    def test_restaurar_regresa_los_datos_y_guarda_copia_previa(self):
        archivo = respaldos.crear_respaldo(self.carpeta, "manual")
        Producto.objects.filter(pk=self.producto.pk).update(stock_actual=0)

        self.entrar(self.duena)
        r = self.client.post("/api/respaldos/restaurar/", {"nombre": archivo.name, "contrasena": CLAVE},
                             content_type="application/json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Producto.objects.get(pk=self.producto.pk).stock_actual, 40)
        self.assertTrue(any(x["tipo"] == "previo" for x in respaldos.listar(self.carpeta)))
        # La sesión se cerró: hay que volver a entrar
        self.assertEqual(self.client.get("/api/usuarios/me/").status_code, 403)

    def test_restaurar_pide_contrasena_del_propietario(self):
        archivo = respaldos.crear_respaldo(self.carpeta, "manual")
        self.entrar(self.duena)
        r = self.client.post("/api/respaldos/restaurar/", {"nombre": archivo.name, "contrasena": "otra"},
                             content_type="application/json")
        self.assertEqual(r.status_code, 400)
        self.entrar(self.encargado)
        r = self.client.post("/api/respaldos/restaurar/", {"nombre": archivo.name, "contrasena": CLAVE},
                             content_type="application/json")
        self.assertEqual(r.status_code, 403)

    def test_archivo_que_no_es_respaldo_se_rechaza(self):
        falso = io.BytesIO()
        with zipfile.ZipFile(falso, "w") as z:
            z.writestr("foto.jpg", b"no soy inventia")
        falso.seek(0)
        falso.name = "falso.zip"
        self.entrar(self.duena)
        r = self.client.post("/api/respaldos/restaurar/", {"archivo": falso, "contrasena": CLAVE})
        self.assertEqual(r.status_code, 400)
        self.assertIn("no es un respaldo", r.json()["error"])

    def test_instalacion_nueva_restaura_sin_sesion(self):
        contenido = respaldos.crear_respaldo(self.carpeta, "manual").read_bytes()
        # Compu nueva: sin usuarios ni negocio
        Configuracion.objects.all().delete()
        Negocio.objects.all().delete()
        Producto.objects.all().delete()
        Usuario.objects.all().delete()

        subido = io.BytesIO(contenido)
        subido.name = "respaldo.zip"
        r = self.client.post("/api/respaldos/restaurar/", {"archivo": subido})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["negocio"], "Los Querubines")
        self.assertTrue(Usuario.objects.filter(correo="ana@querubines.com").exists())
        self.assertEqual(Producto.objects.get(nombre="Mazapán").stock_actual, 40)

    def test_con_duenio_no_se_restaura_sin_sesion(self):
        contenido = respaldos.crear_respaldo(self.carpeta, "manual").read_bytes()
        subido = io.BytesIO(contenido)
        subido.name = "respaldo.zip"
        self.assertEqual(self.client.post("/api/respaldos/restaurar/", {"archivo": subido}).status_code, 403)
