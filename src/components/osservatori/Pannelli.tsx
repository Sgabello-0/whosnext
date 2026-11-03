import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formattaGiorno } from '../../lib/calendar'
import { confrontaDaFare, confrontaMie, voceMia, vociDaFare, type InterrogazioneOsservata, type VoceDaFare, type VoceMia } from '../../lib/daFare'
import { formattaScadenza, tempoMancante } from '../../lib/formatoDate'
import { percorsoInterrogazione } from '../../lib/messaggi'
import { useInterrogazioniOsservate } from '../../lib/raccolta'
import { ETICHETTA_SCELTA } from '../../lib/testiPreferenze'
import { useAdesso } from '../../lib/useAdesso'
import { Badge, Scheda } from '../ui'

function percorso(d: InterrogazioneOsservata): string {
  return percorsoInterrogazione(d.classId, d.subjectId, d.interrogazioneId)
}

function Titolo({ d, mostraClasse }: { d: InterrogazioneOsservata; mostraClasse: boolean }) {
  return (
    <span className="block font-medium">
      {d.nomeMateria} – {d.nome}
      {mostraClasse && <span className="font-normal text-slate-500"> · {d.nomeClasse}</span>}
    </span>
  )
}

function Riga(props: { to: string; children: ReactNode; destra?: ReactNode }) {
  return (
    <li>
      <Link
        to={props.to}
        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="min-w-0 text-sm">{props.children}</span>
        {props.destra}
      </Link>
    </li>
  )
}

// ───────────── Da fare ─────────────

function testoDaFare(v: VoceDaFare): string {
  switch (v.tipo) {
    case 'genera':
      return 'Le preferenze sono chiuse: genera la lista'
    case 'segnalazioni':
      return v.quante === 1 ? '1 segnalazione "Sono stato interrogato" da confermare' : `${v.quante} segnalazioni da confermare`
    case 'segna':
      return `Segna chi è stato interrogato ${formattaGiorno(v.data).toLowerCase()}`
    case 'risposte':
      return `${v.risposte} su ${v.totale} hanno scelto · entro ${formattaScadenza(new Date(v.scadenza))}`
  }
}

/** Le cose da fare per chi gestisce la classe (capo, vice, docenti con permesso). */
export function PannelloDaFare({ classId }: { classId?: string }) {
  const adesso = useAdesso()
  const tutte = useInterrogazioniOsservate().filter((d) => !classId || d.classId === classId)
  const voci = tutte.flatMap((d) => vociDaFare(d, adesso).map((voce) => ({ voce, d }))).sort(confrontaDaFare)
  if (voci.length === 0) return null
  const piuClassi = new Set(tutte.map((d) => d.classId)).size > 1

  return (
    <Scheda titolo={`Da fare (${voci.length})`}>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Da fare">
        {voci.map(({ voce, d }) => (
          <Riga
            key={`${d.chiave}/${voce.tipo}`}
            to={percorso(d)}
            destra={voce.tipo === 'risposte' ? undefined : <Badge colore={voce.tipo === 'genera' ? 'ambra' : 'blu'}>da fare</Badge>}
          >
            <Titolo d={d} mostraClasse={piuClassi} />
            <span className="block text-slate-600 dark:text-slate-400">{testoDaFare(voce)}</span>
          </Riga>
        ))}
      </ul>
    </Scheda>
  )
}

// ───────────── Le mie interrogazioni ─────────────

function DescrizioneMia({ v, adesso }: { v: VoceMia; adesso: Date }) {
  switch (v.tipo) {
    case 'da-scegliere':
      return (
        <>
          Scegli quando essere interrogato entro {formattaScadenza(new Date(v.scadenza))} (
          {tempoMancante(new Date(v.scadenza), adesso)})
        </>
      )
    case 'scelta':
      return (
        <>
          Hai scelto: {v.scelta === 'posizione' ? `posizione n° ${v.posizioneDSA}` : ETICHETTA_SCELTA[v.scelta].toLowerCase()}
          {' · '}lista dopo {formattaScadenza(new Date(v.scadenza))}
        </>
      )
    case 'attesa-lista':
      return <>Preferenze chiuse: la lista arriva a breve</>
    case 'in-lista':
      return (
        <>
          <strong>
            n° {v.posizione} di {v.totale}
          </strong>{' '}
          · {v.testo}
        </>
      )
    case 'docente-lista':
      return (
        <>
          {v.interrogati} su {v.totale} interrogati
        </>
      )
  }
}

/** Tutte le interrogazioni dell'utente in tutte le classi, in un colpo d'occhio. */
export function PannelloMie({ caricamento }: { caricamento: boolean }) {
  const adesso = useAdesso()
  const tutte = useInterrogazioniOsservate()
  const voci = tutte
    .flatMap((d) => {
      const voce = voceMia(d, adesso)
      return voce ? [{ voce, d }] : []
    })
    .sort(confrontaMie)
  const piuClassi = new Set(tutte.map((d) => d.classId)).size > 1

  return (
    <Scheda titolo="Le mie interrogazioni">
      {voci.length === 0 ? (
        <p className="text-sm text-slate-500">
          {caricamento ? 'Caricamento…' : 'Nessuna interrogazione in corso. Quando il capoclasse ne aggiunge una, la trovi qui.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Le mie interrogazioni">
          {voci.map(({ voce, d }) => (
            <Riga
              key={d.chiave}
              to={percorso(d)}
              destra={voce.tipo === 'da-scegliere' ? <Badge colore="ambra">da scegliere</Badge> : undefined}
            >
              <Titolo d={d} mostraClasse={piuClassi} />
              <span className="block text-slate-600 dark:text-slate-400">
                <DescrizioneMia v={voce} adesso={adesso} />
              </span>
            </Riga>
          ))}
        </ul>
      )}
    </Scheda>
  )
}
