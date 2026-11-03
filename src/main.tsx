import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { ProviderAuth } from './lib/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProviderAuth>
        <App />
      </ProviderAuth>
    </BrowserRouter>
  </StrictMode>,
)
