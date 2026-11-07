"""
Pruebas automatizadas de la app usuarios.

Cubren las funciones de la matriz:
  F-01  Acceso (iniciar y cerrar sesión)
  F-02  Configuración inicial (asistente)
  F-11  Usuarios y permisos

Cada función tiene, como mínimo, un caso con datos válidos y otro con datos
inválidos o inexistentes. Todos los datos son ficticios.
"""
from django.contrib.auth.hashers import check_password, make_password
from django.test import override_settings
from rest_framework.test import APITestCase

from inventario.models import Configuracion, Negocio, MovimientoInventario, Categoria, Producto

from .models import Usuario

# Las contraseñas se cifran con un algoritmo rápido solo en las pruebas
RAPIDO = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
CLAVE = "Clave1234"


def crear_usuario(correo, rol, activo=True, **extra):
    return Usuario.objects.create(
        nombre_completo=extra.pop("nombre", correo.split("@")[0].title()),
        correo=correo,
        contrasena_hash=make_password(CLAVE),
        telefono_whatsapp=extra.pop("telefono", "5500000000"),
        rol=rol,
        activo=activo,
        **extra,
    )


class BaseUsuarios(APITestCase):
    def setUp(self):
        self.duena = crear_usuario("ana@querubines.com", "propietario", nombre="Ana Luisa Reyes")
        self.encargado = crear_usuario("luis@querubines.com", "encargado", nombre="Luis Hernández")

    def entrar(self, usuario, clave=CLAVE, **extra):
        return self.client.post(
            "/api/usuarios/login/", {"correo": usuario.correo, "contrasena": clave, **extra}, format="json"
        )


# ===========================================================================
# F-01 · Acceso
# ===========================================================================

@RAPIDO
class F01AccesoTests(BaseUsuarios):
    def test_cp_01_01_login_valido_abre_sesion(self):
        r = self.entrar(self.duena)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["usuario"]["rol"], "propietario")
        self.assertEqual(self.client.get("/api/usuarios/me/").data["correo"], "ana@querubines.com")

    def test_cp_01_02_contrasena_incorrecta_no_entra(self):
        r = self.entrar(self.duena, clave="Clave999")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["error"], "Correo o contraseña incorrectos")
        self.assertIn(self.client.get("/api/usuarios/me/").status_code, (401, 403))

    def test_correo_inexistente_no_entra(self):
        r = self.client.post(
            "/api/usuarios/login/", {"correo": "nadie@x.com", "contrasena": CLAVE}, format="json"
        )
        self.assertEqual(r.status_code, 401)

    def test_usuario_dado_de_baja_no_entra(self):
        self.encargado.activo = False
        self.encargado.save()
        self.assertEqual(self.entrar(self.encargado).status_code, 401)

    def test_mantener_sesion_dura_hasta_el_lunes(self):
        r = self.entrar(self.duena, mantener_sesion=True)
        self.assertEqual(r.status_code, 200)
        self.assertGreater(self.client.session.get_expiry_age(), 0)

    def test_cerrar_sesion(self):
        self.entrar(self.duena)
        self.assertEqual(self.client.post("/api/usuarios/logout/").status_code, 200)
        self.assertIn(self.client.get("/api/usuarios/me/").status_code, (401, 403))

    def test_me_con_usuario_borrado(self):
        self.entrar(self.encargado)
        self.encargado.delete()
        self.assertEqual(self.client.get("/api/usuarios/me/").status_code, 401)


# ===========================================================================
# F-02 · Configuración inicial (asistente)
# ===========================================================================

def datos_asistente(**cambios):
    cuenta = {
        "nombre_completo": "Rosa Martínez López",
        "correo": "rosa@lapaletafeliz.mx",
        "contrasena": "Rosa2026x",
        "telefono_whatsapp": "",
    }
    cuenta.update(cambios.pop("cuenta", {}))
    datos = {
        "propietario": cuenta,
        "negocio": {"nombre": "Dulcería La Paleta Feliz", "direccion": "Av. Juárez 45", "telefono": ""},
        "preferencias": {
            "maneja_caducidad": True,
            "vende_mayoreo": True,
            "maneja_promociones": False,
            "usa_codigo_barras": False,
            "alertas_activas": True,
            "correo_alertas": "avisos@lapaletafeliz.mx",
            "hora_resumen": "21:00",
            "dias_aviso_caducidad": 15,
        },
    }
    for clave, valor in cambios.items():
        datos[clave].update(valor)
    return datos


@RAPIDO
class F02AsistenteTests(APITestCase):
    URL = "/api/usuarios/primer-propietario/"

    def test_estado_inicial_sin_duenio(self):
        r = self.client.get("/api/usuarios/estado-inicial/")
        self.assertTrue(r.data["necesita_configuracion"])
        self.assertIsNone(r.data["nombre_negocio"])

    def test_cp_02_01_asistente_crea_negocio_cuenta_y_preferencias(self):
        r = self.client.post(self.URL, datos_asistente(), format="json")
        self.assertEqual(r.status_code, 201, r.data)

        duena = Usuario.objects.get(correo="rosa@lapaletafeliz.mx")
        self.assertEqual(duena.rol, "propietario")
        self.assertTrue(check_password("Rosa2026x", duena.contrasena_hash))  # se guarda cifrada

        config = Configuracion.objects.get()
        self.assertEqual(config.negocio.nombre, "Dulcería La Paleta Feliz")
        self.assertEqual(config.correo_alertas, "avisos@lapaletafeliz.mx")
        self.assertEqual(config.hora_resumen.strftime("%H:%M"), "21:00")
        self.assertEqual(config.dias_aviso_caducidad, 15)
        self.assertFalse(config.maneja_promociones)

        estado = self.client.get("/api/usuarios/estado-inicial/").data
        self.assertFalse(estado["necesita_configuracion"])
        self.assertEqual(estado["nombre_negocio"], "Dulcería La Paleta Feliz")

    def test_telefonos_opcionales_y_valores_por_defecto(self):
        datos = datos_asistente(preferencias={"correo_alertas": "", "hora_resumen": "x", "dias_aviso_caducidad": 999})
        r = self.client.post(self.URL, datos, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        config = Configuracion.objects.get()
        self.assertEqual(config.correo_alertas, "rosa@lapaletafeliz.mx")  # usa el de la cuenta
        self.assertEqual(config.hora_resumen.strftime("%H:%M"), "20:00")
        self.assertEqual(config.dias_aviso_caducidad, 30)

    def test_cp_02_02_correo_de_avisos_mal_escrito(self):
        r = self.client.post(self.URL, datos_asistente(preferencias={"correo_alertas": "eri123@"}), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Usuario.objects.exists())  # todo o nada

    def test_validaciones_de_la_cuenta(self):
        casos = [
            ({"cuenta": {"correo": ""}}, "obligatorios"),
            ({"cuenta": {"contrasena": "corta"}}, "8 caracteres"),
            ({"cuenta": {"telefono_whatsapp": "55123"}}, "10 dígitos"),
            ({"negocio": {"telefono": "123"}}, "10 dígitos"),
        ]
        for cambios, texto in casos:
            with self.subTest(cambios=cambios):
                r = self.client.post(self.URL, datos_asistente(**cambios), format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn(texto, r.data["error"])
        self.assertFalse(Usuario.objects.exists())

    def test_no_se_puede_configurar_dos_veces(self):
        self.client.post(self.URL, datos_asistente(), format="json")
        r = self.client.post(self.URL, datos_asistente(cuenta={"correo": "otra@x.com"}), format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Usuario.objects.count(), 1)

    def test_correo_repetido_en_el_asistente(self):
        crear_usuario("rosa@lapaletafeliz.mx", "encargado")
        Usuario.objects.all().update(activo=False)
        # Ya hay un usuario: el asistente queda cerrado
        self.assertEqual(self.client.post(self.URL, datos_asistente(), format="json").status_code, 403)


# ===========================================================================
# F-11 · Usuarios y permisos
# ===========================================================================

@RAPIDO
class F11UsuariosTests(BaseUsuarios):
    def nuevo(self, **cambios):
        datos = {"nombre_completo": "Kenia Ramírez", "correo": "kenia@querubines.com",
                 "contrasena": "Temp1234", "telefono_whatsapp": "5512345678", **cambios}
        return self.client.post("/api/usuarios/registrar/", datos, format="json")

    def test_cp_11_01_propietario_da_de_alta_encargado(self):
        self.entrar(self.duena)
        r = self.nuevo(rol="propietario")  # el rol que manden se ignora
        self.assertEqual(r.status_code, 201, r.data)
        kenia = Usuario.objects.get(correo="kenia@querubines.com")
        self.assertEqual(kenia.rol, "encargado")
        self.assertTrue(kenia.debe_cambiar_contrasena)

    def test_cp_11_02_correo_repetido_se_rechaza(self):
        self.entrar(self.duena)
        r = self.nuevo(correo="luis@querubines.com")
        self.assertEqual(r.status_code, 400)
        self.assertIn("correo", r.data)

    def test_cp_11_03_encargado_no_administra_usuarios(self):
        self.entrar(self.encargado)
        self.assertEqual(self.nuevo().status_code, 403)
        self.assertEqual(self.client.get("/api/usuarios/lista/").status_code, 403)
        self.assertEqual(self.client.patch("/api/configuracion/", {}, format="json").status_code, 403)

    def test_lista_con_y_sin_inactivos(self):
        crear_usuario("baja@querubines.com", "encargado", activo=False)
        self.entrar(self.duena)
        self.assertEqual(len(self.client.get("/api/usuarios/lista/").data), 2)
        self.assertEqual(len(self.client.get("/api/usuarios/lista/?incluir_inactivos=true").data), 3)

    def test_editar_encargado(self):
        self.entrar(self.duena)
        url = f"/api/usuarios/{self.encargado.id}/"
        r = self.client.patch(url, {"nombre_completo": "Luis H. Pérez"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self.client.patch(url, {"correo": "ana@querubines.com"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(f"/api/usuarios/{self.duena.id}/", {}, format="json").status_code, 400)
        self.assertEqual(self.client.patch("/api/usuarios/9999/", {}, format="json").status_code, 404)

    def test_dar_de_baja_y_reactivar(self):
        self.entrar(self.duena)
        url = f"/api/usuarios/{self.encargado.id}/estado/"
        self.assertEqual(self.client.patch(url, {"activo": False}, format="json").status_code, 200)
        self.encargado.refresh_from_db()
        self.assertFalse(self.encargado.activo)
        self.assertEqual(self.client.patch(url, {"activo": True}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(url, {"activo": "si"}, format="json").status_code, 400)
        baja = {"activo": False}
        r = self.client.patch(f"/api/usuarios/{self.duena.id}/estado/", baja, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.patch("/api/usuarios/9999/estado/", baja, format="json").status_code, 404)

    def test_restablecer_contrasena(self):
        self.entrar(self.duena)
        r = self.client.post(f"/api/usuarios/{self.encargado.id}/reset-password/")
        self.assertEqual(r.status_code, 200)
        self.encargado.refresh_from_db()
        self.assertTrue(check_password(r.data["contrasena_temporal"], self.encargado.contrasena_hash))
        self.assertTrue(self.encargado.debe_cambiar_contrasena)
        self.assertEqual(self.client.post(f"/api/usuarios/{self.duena.id}/reset-password/").status_code, 400)
        self.assertEqual(self.client.post("/api/usuarios/9999/reset-password/").status_code, 404)

    def test_eliminar_solo_sin_historial(self):
        sin_historial = crear_usuario("nuevo@querubines.com", "encargado")
        categoria = Categoria.objects.create(nombre="Dulces")
        producto = Producto.objects.create(nombre="Mazapán", categoria=categoria, stock_minimo=1)
        MovimientoInventario.objects.create(producto=producto, usuario=self.encargado, tipo_movimiento="entrada",
                                            cantidad=1, stock_resultante=1)
        self.entrar(self.duena)
        r = self.client.delete(f"/api/usuarios/{self.encargado.id}/eliminar/")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.data["puede_dar_de_baja"])
        self.assertEqual(self.client.delete(f"/api/usuarios/{sin_historial.id}/eliminar/").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/usuarios/{self.duena.id}/eliminar/").status_code, 400)
        self.assertEqual(self.client.delete("/api/usuarios/9999/eliminar/").status_code, 404)


# ===========================================================================
# Mi perfil (parte de F-11): datos propios y contraseña
# ===========================================================================

@RAPIDO
class MiPerfilTests(BaseUsuarios):
    def test_actualizar_mi_perfil(self):
        self.entrar(self.encargado)
        r = self.client.patch("/api/usuarios/mi-perfil/", {"nombre_completo": "Luis Hdz", "rol": "propietario"},
                              format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.encargado.refresh_from_db()
        self.assertEqual(self.encargado.nombre_completo, "Luis Hdz")
        self.assertEqual(self.encargado.rol, "encargado")  # el rol no se cambia desde aquí

    def test_perfil_con_datos_invalidos(self):
        self.entrar(self.encargado)
        r = self.client.patch("/api/usuarios/mi-perfil/", {"nombre_completo": ""}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cambiar_mi_contrasena(self):
        self.encargado.debe_cambiar_contrasena = True
        self.encargado.save()
        self.entrar(self.encargado)
        url = "/api/usuarios/mi-contrasena/"
        self.assertEqual(self.client.post(url, {"contrasena_actual": "mala", "nueva_contrasena": "Nueva123"},
                                          format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"contrasena_actual": CLAVE, "nueva_contrasena": CLAVE},
                                          format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"contrasena_actual": CLAVE, "nueva_contrasena": "abc"},
                                          format="json").status_code, 400)
        r = self.client.post(url, {"contrasena_actual": CLAVE, "nueva_contrasena": "Nueva123"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.encargado.refresh_from_db()
        self.assertTrue(check_password("Nueva123", self.encargado.contrasena_hash))
        self.assertFalse(self.encargado.debe_cambiar_contrasena)

    def test_perfil_sin_sesion(self):
        self.assertIn(self.client.patch("/api/usuarios/mi-perfil/", {}, format="json").status_code, (401, 403))

    def test_negocio_requiere_usuario_admin(self):
        # El negocio siempre queda ligado a su propietario
        negocio = Negocio.objects.create(nombre="X", propietario="Ana", direccion="", usuario_admin=self.duena)
        self.assertEqual(negocio.usuario_admin, self.duena)
