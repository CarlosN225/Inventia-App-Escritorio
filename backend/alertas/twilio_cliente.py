import os

try:
    from dotenv import load_dotenv
    from django.conf import settings
    load_dotenv(settings.BASE_DIR / '.env')
except ImportError:  # python-dotenv no instalado
    pass


class SinConexion(Exception):
    pass


class ErrorEnvio(Exception):
    pass


def _numero(tel):
    tel = tel.strip()
    return tel if tel.startswith('whatsapp:') else f"whatsapp:{tel}"


def enviar_whatsapp(telefono, texto):
    """Manda un WhatsApp. SinConexion si no hay internet; ErrorEnvio para cualquier otro fallo."""
    sid = os.environ.get('TWILIO_ACCOUNT_SID')
    token = os.environ.get('TWILIO_AUTH_TOKEN')
    remitente = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
    if not (sid and token):
        raise ErrorEnvio('Faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN en .env')
    if not telefono:
        raise ErrorEnvio('No hay telefono_alertas configurado')

    import requests
    from twilio.base.exceptions import TwilioException, TwilioRestException
    from twilio.rest import Client
    try:
        from twilio.http.http_client import TwilioHttpClient
        Client(sid, token, http_client=TwilioHttpClient(timeout=10)).messages.create(from_=_numero(remitente), to=_numero(telefono), body=texto)
    except TwilioRestException as e:
        raise ErrorEnvio(f"Twilio rechazó el mensaje: {e.msg}") from e
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        raise SinConexion(str(e)) from e
    except TwilioException as e:
        raise ErrorEnvio(str(e)) from e
