import { useEffect, useState } from 'react'
import { getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth, DOMINI, providerGoogle, USA_EMULATORI } from '../lib/firebase'
import { messaggioErroreAuth, type MessaggioErrore } from '../lib/authErrors'
import { copiaTesto, datiDiagnostica } from '../lib/diagnostica'
import { Bottone, Riquadro } from '../components/ui'

type Errore = MessaggioErrore & { codice?: string }

export default function Login() {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<Errore | null>(null)
  const [copiato, setCopiato] = useState(false)

  useEffect(() => {
    if (auth) getRedirectResult(auth).catch(gestisciErrore)
  }, [])

  function gestisciErrore(e: unknown) {
    const codice = e instanceof FirebaseError ? e.code : undefined
    const msg = messaggioErroreAuth(codice)
    setErrore(msg ? { ...msg, codice } : null)
    if (!(e instanceof FirebaseError)) console.error(e)
  }

  async function accedi(modo: 'popup' | 'redirect') {
    if (!auth) return
    setErrore(null)
    setInCorso(true)
    try {
      if (modo === 'redirect') await signInWithRedirect(auth, providerGoogle())
      else await signInWithPopup(auth, providerGoogle())
    } catch (e) {
      gestisciErrore(e)
    } finally {
      setInCorso(false)
    }
  }

  async function copiaDiagnostica() {
    const testo = JSON.stringify(datiDiagnostica({ errore: errore?.codice }), null, 2)
    if (await copiaTesto(testo)) {
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } else {
      alert(testo)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Interrogazioni di Classe</h1>
        <p className="text-slate-600 dark:text-slate-400">
          L'ordine delle interrogazioni della tua classe: scegli quando vuoi essere interrogato, guarda la lista e
          chiedi scambi ai compagni.
        </p>
      </header>

      {USA_EMULATORI && (
        <Riquadro tono="avviso" titolo="Modalità prova">
          Si apre una finestra con account finti: clicca <strong>Add new account</strong> e inventa un'email
          @{DOMINI.studenti} o @{DOMINI.docenti}.
        </Riquadro>
      )}

      <section className="space-y-4">
        <Bottone onClick={() => accedi('popup')} disabled={inCorso} larga>
          {inCorso ? 'Accesso in corso…' : 'Accedi con Google'}
        </Bottone>
        <p className="text-sm text-slate-500">
          Usa l'account della scuola: <strong>@{DOMINI.studenti}</strong> per gli studenti,{' '}
          <strong>@{DOMINI.docenti}</strong> per i professori.
        </p>

        {errore && (
          <Riquadro tono="errore" titolo={errore.titolo}>
            <p>{errore.dettaglio}</p>
            {errore.codice && <p className="mt-2 font-mono text-xs opacity-70">{errore.codice}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              {errore.codice === 'auth/popup-blocked' && (
                <button className="underline" onClick={() => accedi('redirect')}>
                  Prova senza popup
                </button>
              )}
              <button className="underline" onClick={copiaDiagnostica}>
                {copiato ? 'Copiato' : 'Copia diagnostica'}
              </button>
            </div>
          </Riquadro>
        )}
      </section>
    </main>
  )
}
