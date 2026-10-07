const CLAVE = 'inventia.tema'
const TEMAS = ['claro', 'oscuro', 'sistema']

export function getTemaGuardado() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return TEMAS.includes(guardado) ? guardado : 'claro'
  } catch {
    return 'claro' // sin acceso al almacenamiento: tema por defecto
  }
}

export function aplicarTema(tema) {
  const oscuro =
    tema === 'oscuro' ||
    (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const raiz = document.documentElement
  raiz.dataset.theme = oscuro ? 'dark' : 'light'
  raiz.setAttribute('data-bs-theme', oscuro ? 'dark' : 'light') // también para Bootstrap
}

export function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // si no se puede guardar, igual se aplica en esta sesión
  }
  aplicarTema(tema)
}

// Se llama una vez al arrancar la app
export function iniciarTema() {
  aplicarTema(getTemaGuardado())

  // Si eligió "Automático", sigue los cambios del sistema operativo
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTemaGuardado() === 'sistema') aplicarTema('sistema')
  })
}