# Inventia

Sistema de inventario offline-first para pequeños negocios, empaquetado como aplicación de escritorio.

## Descripción

Inventia es una aplicación de escritorio que permite a pequeños negocios (como dulcerías y misceláneas) controlar su inventario sin depender de una conexión constante a internet. Registra entradas y salidas de productos, calcula existencias en tiempo real y envía resúmenes diarios por correo cuando hay productos con poco stock o próximos a caducar.

Caso de referencia: Dulcería "Los Querubines" (Nicolás Romero, Estado de México).

## Características principales

- Control de inventario (entradas, salidas y ajustes)
- Alertas automáticas por correo ante bajo stock o productos próximos a caducar
- Funciona sin conexión a internet (arquitectura offline-first)
- Aplicación de escritorio instalable (.exe), sin necesidad de hosting

## Stack técnico

- **Backend:** Django + Django REST Framework
- **Base de datos:** SQLite
- **Frontend:** React + Bootstrap
- **Empaquetado:** pywebview + PyInstaller
- **Alertas:** SMTP de Brevo
