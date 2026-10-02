import React from 'react'
import ReactDOM from 'react-dom/client'
import { inject } from '@vercel/analytics'
import App from './App.jsx'

// Estatísticas de visitas (Vercel Web Analytics). Sem cookies e sem dados pessoais:
// o endereço é enviado sem parâmetros, para não revelar o apartamento (?apt=3B) nem ?setup.
inject({
  beforeSend: (ev) => ({ ...ev, url: ev.url.split('?')[0].split('#')[0] }),
})

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
