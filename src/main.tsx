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
