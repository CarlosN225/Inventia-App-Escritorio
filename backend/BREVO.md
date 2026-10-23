# Alertas por correo con Brevo

## Configuración

1. Crea una cuenta en Brevo y verifica el correo remitente en la sección de remitentes.
2. En los ajustes SMTP/API de Brevo, copia el **SMTP login** y la **SMTP key**. No uses una API key en lugar de la SMTP key.
3. Copia `backend/.env.example` como `backend/.env` y completa:

   ```env
   BREVO_SMTP_LOGIN=tu-login-smtp
   BREVO_SMTP_KEY=tu-clave-smtp
   BREVO_FROM_EMAIL=remitente-verificado@tudominio.com
   ```

4. En `backend/`, ejecuta `python manage.py migrate` y reinicia Inventia.
5. En Configuración → Correo y alertas, confirma el correo destinatario, guarda y pulsa **Enviar correo de prueba**.

El SMTP de Brevo usa `smtp-relay.brevo.com`, puerto `587` y TLS. Sin credenciales la app no simula el envío: muestra un error y conserva los resúmenes fallidos para reintentarlos desde el scheduler cuando vuelva la conexión.

## Límites

El plan gratuito de Brevo permite actualmente hasta 300 correos al día. Los límites pueden cambiar; consulta la página oficial de [planes de Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).

## Endpoints

- `GET /api/alertas/resumen/`: productos con stock bajo, próximos a caducar y texto del resumen.
- `GET /api/alertas/estado/`: estado del último envío y hora del siguiente resumen.
- `POST /api/alertas/enviar-ahora/`: envía el resumen diario actual.
- `POST /api/alertas/prueba/`: envía un correo de prueba al destinatario configurado.

El resumen diario se registra antes de enviarse. Los pendientes se reintentan desde el proceso Django; si se cierra la aplicación, los reintentos esperan al siguiente arranque.
