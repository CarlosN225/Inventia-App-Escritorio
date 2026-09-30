import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export async function login(correo, contrasena) {
    const response = await axios.post(
        API_URL + '/usuarios/login/',
        {
            correo: correo,
            contrasena: contrasena
        },
        {
            withCredentials: true
        }
    );

    console.log('RESPUESTA LOGIN:', response.data);
    console.log('COOKIES:', document.cookie);

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