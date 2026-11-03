import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './lib/auth'
import { configMancante } from './lib/firebase'
import Layout from './components/Layout'
import { Caricamento, Riquadro } from './components/ui'
import Login from './pages/Login'
import NonAmmesso from './pages/NonAmmesso'
import Classi from './pages/Classi'
import Unisciti from './pages/Unisciti'
import Classe from './pages/Classe'
import AdminClasse from './pages/AdminClasse'
import Configura from './pages/Configura'
import Materia from './pages/Materia'
import Interrogazione from './pages/Interrogazione'

export default function App() {
  const { pronto, utente, esito } = useAuth()

  if (configMancante.length > 0) return <ConfigMancante />
  if (!pronto)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Caricamento />
      </div>
    )
  // Senza login si mostra la pagina di accesso su qualsiasi indirizzo:
  // dopo l'accesso si resta sulla stessa pagina (utile per i link d'invito).
  if (!utente) return <Login />
  if (!esito?.ammesso) return <NonAmmesso />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Classi />} />
        <Route path="/unisciti/:codice" element={<Unisciti />} />
        <Route path="/classe/:classId" element={<Classe />} />
        <Route path="/classe/:classId/gestione" element={<AdminClasse />} />
        <Route path="/classe/:classId/configura" element={<Configura />} />
        <Route path="/classe/:classId/materia/:subjectId" element={<Materia />} />
        <Route path="/classe/:classId/materia/:subjectId/interrogazione/:interrogazioneId" element={<Interrogazione />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function ConfigMancante() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Interrogazioni di Classe</h1>
      <Riquadro tono="avviso" titolo="Firebase non è ancora configurato">
        <p>
          Copia <code>.env.example</code> in <code>.env</code> e compila questi valori dalla console Firebase (vedi{' '}
          <code>GUIDA-FIREBASE.md</code>), oppure prova in locale con <code>npm run dev:emu</code>:
        </p>
        <ul className="mt-2 list-disc pl-5 font-mono text-xs">
          {configMancante.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </Riquadro>
    </main>
  )
}
