import type { DatiClasse } from '../lib/useClasse'
import { messaggioErrore } from '../lib/errori'
import { Caricamento, LinkBottone, Riquadro, Scheda } from './ui'

/** Mostra caricamento, errori o "non fai parte della classe". null quando i dati sono pronti. */
export function StatoClasse({ dati }: { dati: DatiClasse }) {
  if (dati.stato === 'caricamento') return <Caricamento />
  if (dati.stato === 'errore') return <Riquadro tono="errore">{messaggioErrore(dati.errore)}</Riquadro>
  if (dati.stato === 'non-membro')
    return (
      <Scheda titolo="Non fai parte di questa classe">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Forse sei uscito, il capoclasse ti ha rimosso oppure ha eliminato la classe. Per rientrare serve un codice d'invito.
        </p>
        <LinkBottone to="/">Torna alle tue classi</LinkBottone>
      </Scheda>
    )
  return null
}
