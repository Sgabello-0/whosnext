import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { ProviderAuth } from './lib/auth'
import { ProviderAvvisi } from './components/Avvisi'
import { ProviderConferma } from './components/Conferma'
import { avviaTema } from './lib/tema'
import { avviaInstallazione } from './lib/installazione'

avviaTema()
// Chrome propone l'installazione anche subito dopo l'apertura: lo si ascolta da subito
avviaInstallazione()

// Dopo un aggiornamento del sito, chi aveva la pagina aperta può chiedere un pezzo che non esiste più:
// si ricarica una volta per prendere la versione nuova (non di più, per non entrare in un ciclo).
window.addEventListener('vite:preloadError', (e) => {
  try {
    const ultima = Number(sessionStorage.getItem('ricaricato-per-aggiornamento') ?? 0)
    if (Date.now() - ultima < 30_000) return
    sessionStorage.setItem('ricaricato-per-aggiornamento', String(Date.now()))
  } catch {
    // senza sessionStorage si ricarica comunque
  }
  e.preventDefault()
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProviderAuth>
        <ProviderAvvisi>
          <ProviderConferma>
            <App />
          </ProviderConferma>
        </ProviderAvvisi>
      </ProviderAuth>
    </BrowserRouter>
  </StrictMode>,
)
