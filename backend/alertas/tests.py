from datetime import date, datetime, time, timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from inventario.models import Producto
from . import resumen, servicio
from .models import AlertaStock
from .twilio_cliente import SinConexion


def _hora(h, m=0):
    return timezone.make_aware(datetime.combine(date(2026, 10, 3), time(h, m)))


class ResumenTests(TestCase):
    def test_orden_y_formato(self):
        Producto.objects.create(codigo='1', nombre='Paleta de caramelo', cantidad=8, stock_minimo=10)
        Producto.objects.create(codigo='2', nombre='Platos desechables', cantidad=0, stock_minimo=5)
        Producto.objects.create(codigo='3', nombre='Churrumais limón', cantidad=4, stock_minimo=12)
        Producto.objects.create(codigo='4', nombre='Sobrado', cantidad=50, stock_minimo=5)
        datos = resumen.calcular(date(2026, 10, 3))
        self.assertEqual([p['nombre'] for p in datos['stock_bajo']],
                         ['Platos desechables', 'Churrumais limón', 'Paleta de caramelo'])
        texto = resumen.armar_mensaje(datos)
        self.assertIn('*INVENTIA · Resumen del 3 oct*', texto)
        self.assertIn('- Platos desechables: *agotado*', texto)
        self.assertIn('- Churrumais limón: quedan 4', texto)

    def test_maximo_tres_y_mas(self):
        for i in range(5):
            Producto.objects.create(codigo=str(i), nombre=f'P{i}', cantidad=0, stock_minimo=5)
        texto = resumen.armar_mensaje(resumen.calcular(date(2026, 10, 3)))
        self.assertIn('…y 2 más', texto)

    def test_todo_en_orden(self):
        texto = resumen.armar_mensaje(resumen.calcular(date(2026, 10, 3)))
        self.assertIn('Todo en orden', texto)


@mock.patch('alertas.config.os.environ', {'INVENTIA_TELEFONO_ALERTAS': 'whatsapp:+521', 'INVENTIA_HORA_RESUMEN': '20:00'})
class ColaTests(TestCase):
    def setUp(self):
        servicio._ultimo_intento = None

    def _revisar_a(self, hora):
        with mock.patch('alertas.servicio.timezone.localtime', return_value=hora), \
             mock.patch('alertas.servicio.timezone.now', return_value=hora):
            servicio.revisar()

    def test_no_manda_antes_de_la_hora(self):
        with mock.patch('alertas.servicio.enviar_whatsapp') as m:
            self._revisar_a(_hora(19, 59))
        m.assert_not_called()
        self.assertEqual(AlertaStock.objects.count(), 0)

    def test_manda_una_sola_vez(self):
        with mock.patch('alertas.servicio.enviar_whatsapp') as m:
            self._revisar_a(_hora(20, 0))
            self._revisar_a(_hora(20, 1))
            self._revisar_a(_hora(23, 0))  # compu prendida tarde, mismo día
        self.assertEqual(m.call_count, 1)
        self.assertTrue(AlertaStock.objects.get().enviada)

    def test_sin_internet_guarda_y_reintenta(self):
        with mock.patch('alertas.servicio.enviar_whatsapp', side_effect=SinConexion('x')):
            self._revisar_a(_hora(20, 0))
        a = AlertaStock.objects.get()
        self.assertFalse(a.enviada)
        with mock.patch('alertas.servicio.enviar_whatsapp') as m:
            self._revisar_a(_hora(20, 2))   # aún no pasan 5 min
            m.assert_not_called()
            self._revisar_a(_hora(20, 6))
            m.assert_called_once()
        a.refresh_from_db()
        self.assertTrue(a.enviada)
        self.assertIsNotNone(a.fecha_envio)

    def test_enviar_ahora_sin_conexion_devuelve_error_y_guarda(self):
        with mock.patch('alertas.servicio.enviar_whatsapp', side_effect=SinConexion('x')):
            with self.assertRaises(servicio.AlertaError) as ctx:
                servicio.enviar_ahora()
        self.assertEqual(ctx.exception.codigo, 'sin_conexion')
        self.assertEqual(AlertaStock.objects.filter(enviada=False).count(), 1)


class EndpointsTests(TestCase):
    def setUp(self):
        self.c = APIClient()
        s = self.client.session
        s['id_usuario'], s['rol'] = 1, 'propietario'
        s.save()
        self.c.cookies[self.client.cookies['sessionid'].key if False else 'sessionid'] = s.session_key

    def test_sin_sesion_401_o_403(self):
        self.assertIn(APIClient().get('/api/alertas/resumen/').status_code, (401, 403))

    def test_resumen_y_estado(self):
        self.assertEqual(self.c.get('/api/alertas/resumen/').status_code, 200)
        self.assertEqual(self.c.get('/api/alertas/estado/').json()['pendientes'], 0)

    def test_enviar_ahora_sin_conexion(self):
        with mock.patch('alertas.servicio.enviar_whatsapp', side_effect=SinConexion('x')):
            r = self.c.post('/api/alertas/enviar-ahora/')
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {'error': 'sin_conexion'})
