import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
// CAMBIO 1: estilos del tema oscuro y función que arranca el tema
import './styles/tema-oscuro.css'
import { iniciarTema } from './services/tema'

// CAMBIO 2: aplica el tema guardado (claro, oscuro o automático) antes de dibujar la app
iniciarTema()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)