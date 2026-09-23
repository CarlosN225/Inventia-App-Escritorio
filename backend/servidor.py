import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventia_backend.settings')

from django.core.management import execute_from_command_line

execute_from_command_line([
    'servidor.py',
    'runserver',
    '127.0.0.1:8000',
    '--noreload'
])