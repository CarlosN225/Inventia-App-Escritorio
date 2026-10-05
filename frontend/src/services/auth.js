import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export async function login(correo, contrasena, mantenerSesion = false) {
    const response = await axios.post(
        API_URL + '/usuarios/login/',
        {
            correo: correo,
            contrasena: contrasena,
            mantener_sesion: mantenerSesion
        },
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function logout() {
    const response = await axios.post(
        API_URL + '/usuarios/logout/',
        {},
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function getUsuarioActual() {
    const response = await axios.get(
        API_URL + '/usuarios/me/',
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function listarUsuarios(incluirInactivos = false) {
    const response = await axios.get(
        API_URL + '/usuarios/lista/',
        {
            params: {
                incluir_inactivos: incluirInactivos
            },
            withCredentials: true
        }
    );

    return response.data;
}

export async function registrarUsuario(datos) {
    const response = await axios.post(
        API_URL + '/usuarios/registrar/',
        datos,
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function editarUsuario(usuarioId, datos) {
    const response = await axios.patch(
        API_URL + '/usuarios/' + usuarioId + '/',
        datos,
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function cambiarEstadoUsuario(usuarioId, activo) {
    const response = await axios.patch(
        API_URL + '/usuarios/' + usuarioId + '/estado/',
        {
            activo: activo
        },
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function eliminarUsuario(usuarioId) {
    const response = await axios.delete(
        API_URL + '/usuarios/' + usuarioId + '/eliminar/',
        {
            withCredentials: true
        }
    );

    return response.data;
}

export async function restablecerContrasena(usuarioId) {
    const response = await axios.post(
        API_URL + '/usuarios/' + usuarioId + '/reset-password/',
        {},
        {
            withCredentials: true
        }
    );

    return response.data;
}