import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { DOMINI } from '../lib/firebase'
import { copiaTesto, datiDiagnostica } from '../lib/diagnostica'
import { Bottone, Riquadro } from '../components/ui'
import { TestoDaCopiare } from '../components/TestoDaCopiare'

/** L'utente ha fatto login con Google ma l'account non è della scuola (o l'email non è verificata). */
export default function NonAmmesso() {
  const { utente, esito, esci } = useAuth()
  const [copiato, setCopiato] = useState(false)
  const [daCopiare, setDaCopiare] = useState<string | null>(null)
  const motivo = esito && !esito.ammesso ? esito.motivo : null

  async function copia() {
    const testo = JSON.stringify(datiDiagnostica({ utente, esito }), null, 2)
    if (await copiaTesto(testo)) {
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } else setDaCopiare(testo)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <h1 className="text-2xl font-semibold">Account non ammesso</h1>
      <Riquadro tono="errore" titolo={utente?.email ?? 'Account senza email'}>
        {motivo === 'dominio-errato' && (
          <p>
            Possono entrare solo gli account della scuola: <strong>@{DOMINI.studenti}</strong> (studenti) e{' '}
            <strong>@{DOMINI.docenti}</strong> (professori).
          </p>
        )}
        {motivo === 'email-non-verificata' && <p>Google non segnala questo indirizzo email come verificato.</p>}
        {motivo === 'email-mancante' && <p>Google non ha fornito un indirizzo email per questo account.</p>}
      </Riquadro>
      <div className="flex flex-wrap gap-2">
        <Bottone onClick={esci}>Esci e cambia account</Bottone>
        <Bottone onClick={copia} variante="secondario">
          {copiato ? 'Copiato' : 'Copia diagnostica'}
        </Bottone>
      </div>
      <TestoDaCopiare testo={daCopiare} />
    </main>
  )
}
