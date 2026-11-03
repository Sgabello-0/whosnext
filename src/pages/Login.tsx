import { useEffect, useState } from 'react'
import {
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth, configMancante, DOMINIO_SCUOLA, providerGoogle } from '../lib/firebase'
import { dominioEmail, verificaAccesso, type EsitoAccesso } from '../lib/domain'
import { messaggioErroreAuth, type MessaggioErrore } from '../lib/authErrors'

type Errore = MessaggioErrore & { codice?: string }

/**
 * Pagina di test del login scolastico.
 * Serve a capire se la scuola permette l'accesso con Google a questa app
 * prima di costruire il resto del sito.
 */
export default function Login() {
  const [utente, setUtente] = useState<User | null>(null)
  const [pronto, setPronto] = useState(false)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<Errore | null>(null)
  const [hd, setHd] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)

  useEffect(() => {
    if (!auth) return
    const a = auth
    getRedirectResult(a)
      .then((cred) => cred && leggiHd(cred))
      .catch(gestisciErrore)
    return onAuthStateChanged(a, (u) => {
      setUtente(u)
      setPronto(true)
    })
  }, [])

  function leggiHd(cred: UserCredential) {
    const profilo = getAdditionalUserInfo(cred)?.profile as { hd?: string } | null | undefined
    setHd(profilo?.hd ?? null)
  }

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
      if (modo === 'redirect') {
        await signInWithRedirect(auth, providerGoogle())
        return
      }
      leggiHd(await signInWithPopup(auth, providerGoogle()))
    } catch (e) {
      gestisciErrore(e)
    } finally {
      setInCorso(false)
    }
  }

  async function esci() {
    if (!auth) return
    await signOut(auth)
    setHd(null)
    setErrore(null)
  }

  const esito: EsitoAccesso | null = utente
    ? verificaAccesso({ email: utente.email, emailVerified: utente.emailVerified }, DOMINIO_SCUOLA)
    : null

  async function copiaDiagnostica() {
    const dati = {
      quando: new Date().toISOString(),
      sito: location.origin,
      browser: navigator.userAgent,
      dominioAtteso: DOMINIO_SCUOLA,
      dominioEmail: dominioEmail(utente?.email),
      emailVerificata: utente?.emailVerified ?? null,
      hd,
      esito,
      errore: errore?.codice ?? null,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(dati, null, 2))
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      alert(JSON.stringify(dati, null, 2))
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-accento dark:text-blue-300">
          Test del login
        </p>
        <h1 className="text-3xl font-semibold">Interrogazioni di Classe</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Accedi con il tuo account <strong>@{DOMINIO_SCUOLA}</strong> per verificare che la scuola consenta
          l'accesso.
        </p>
      </header>

      {configMancante.length > 0 ? (
        <Riquadro tono="avviso" titolo="Firebase non è ancora configurato">
          <p>
            Copia <code>.env.example</code> in <code>.env</code> e compila questi valori dalla console Firebase
            (vedi <code>GUIDA-FIREBASE.md</code>):
          </p>
          <ul className="mt-2 list-disc pl-5 font-mono text-xs">
            {configMancante.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Riquadro>
      ) : !pronto ? (
        <p className="text-slate-500">Caricamento…</p>
      ) : utente ? (
        <section className="space-y-4">
          {esito?.ammesso ? (
            <Riquadro tono="ok" titolo="Funziona: accesso consentito">
              <p>La scuola permette il login con Google e l'account è del dominio giusto.</p>
            </Riquadro>
          ) : (
            <Riquadro tono="errore" titolo="Accesso riuscito, ma l'account non è ammesso">
              <p>
                {esito?.ammesso === false && esito.motivo === 'dominio-errato' &&
                  `Questo account non è @${DOMINIO_SCUOLA}. Esci e scegli l'account della scuola.`}
                {esito?.ammesso === false && esito.motivo === 'email-non-verificata' &&
                  "Google non segnala l'email come verificata."}
                {esito?.ammesso === false && esito.motivo === 'email-mancante' &&
                  "Google non ha fornito un indirizzo email."}
              </p>
            </Riquadro>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <dt className="text-slate-500">Nome</dt>
            <dd className="break-words">{utente.displayName ?? '—'}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="break-all">{utente.email ?? '—'}</dd>
            <dt className="text-slate-500">Verificata</dt>
            <dd>{utente.emailVerified ? 'sì' : 'no'}</dd>
            <dt className="text-slate-500">Workspace (hd)</dt>
            <dd>{hd ?? (utente ? 'non disponibile' : '—')}</dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Bottone onClick={esci} variante="secondario">Esci</Bottone>
            <Bottone onClick={copiaDiagnostica} variante="secondario">
              {copiato ? 'Copiato' : 'Copia diagnostica'}
            </Bottone>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <Bottone onClick={() => accedi('popup')} disabled={inCorso}>
            {inCorso ? 'Accesso in corso…' : 'Accedi con Google'}
          </Bottone>

          {errore && (
            <Riquadro tono="errore" titolo={errore.titolo}>
              <p>{errore.dettaglio}</p>
              {errore.codice && <p className="mt-2 font-mono text-xs opacity-70">{errore.codice}</p>}
              {errore.codice === 'auth/popup-blocked' && (
                <button className="mt-3 underline" onClick={() => accedi('redirect')}>
                  Prova senza popup
                </button>
              )}
            </Riquadro>
          )}

          {errore && (
            <Bottone onClick={copiaDiagnostica} variante="secondario">
              {copiato ? 'Copiato' : 'Copia diagnostica'}
            </Bottone>
          )}
        </section>
      )}
    </main>
  )
}

function Riquadro(props: { tono: 'ok' | 'errore' | 'avviso'; titolo: string; children: React.ReactNode }) {
  const stili = {
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    errore: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
    avviso: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  }[props.tono]
  return (
    <div role={props.tono === 'errore' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${stili}`}>
      <p className="mb-1 font-semibold">{props.titolo}</p>
      {props.children}
    </div>
  )
}

function Bottone(props: {
  onClick: () => void
  disabled?: boolean
  variante?: 'primario' | 'secondario'
  children: React.ReactNode
}) {
  const base =
    'rounded-lg px-4 py-2.5 font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60'
  const stile =
    props.variante === 'secondario'
      ? 'border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
      : 'w-full bg-accento text-white hover:bg-blue-700 focus-visible:outline-accento'
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} className={`${base} ${stile}`}>
      {props.children}
    </button>
  )
}
