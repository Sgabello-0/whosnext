import { useEffect, useRef, useState } from 'react'
import { query, where } from 'firebase/firestore'
import { ArrowLeftRight, Check, MessageCircle, X } from 'lucide-react'
import { db } from '../../lib/firebase'
import { rifScambi } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import { useQuery } from '../../lib/hooks'
import { linkAssoluto, linkWhatsApp, messaggioScambio, percorsoInterrogazione } from '../../lib/messaggi'
import { accettaScambio, annullaScambio, rifiutaScambio, validita, type Scambio } from '../../lib/scambi'
import { avvisaServer } from '../../lib/avvisaServer'
import type { DocLista, DocScambio, Membro } from '../../lib/tipi'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'
import { Avatar, Bottone, Scheda } from '../ui'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

/** Le mie richieste (inviate) e quelle in arrivo per la mia posizione, in tempo reale. */
export function useScambi(r: Rif, uid: string, lista: DocLista, attivo: boolean) {
  const chiave = `${r.classId}/${r.subjectId}/${r.interrogazioneId}`
  const mioPos = lista.ordine.indexOf(uid)
  const segui = attivo && mioPos >= 0
  const mie = useQuery<DocScambio>(
    db && segui ? query(rifScambi(db, r.classId, r.subjectId, r.interrogazioneId), where('da', '==', uid)) : null,
    segui ? `scambi-miei/${chiave}/${uid}` : null,
  )
  const arrivo = useQuery<DocScambio>(
    db && segui
      ? query(rifScambi(db, r.classId, r.subjectId, r.interrogazioneId), where('stato', '==', 'attesa'), where('aPos', '==', mioPos))
      : null,
    segui ? `scambi-arrivo/${chiave}/${mioPos}` : null,
  )
  return {
    mie: (mie.dati ?? []) as Scambio[],
    // solo quelle ancora possibili (le altre restano a chi le ha chieste come "non più valide")
    inArrivo: ((arrivo.dati ?? []) as Scambio[]).filter((s) => s.da !== uid && validita(s, lista) === 'valida'),
  }
}

/** Con "Rifiuta in automatico" acceso, le richieste che arrivano (anche seguendo la posizione) si rifiutano da sole. */
export function useRifiutoAutomatico(r: Rif, uid: string, attivo: boolean, inArrivo: Scambio[]) {
  const fatti = useRef(new Set<string>())
  useEffect(() => {
    if (!db || !attivo) return
    for (const s of inArrivo) {
      const k = `${s.id}/${s.creato?.toMillis()}`
      if (fatti.current.has(k)) continue
      fatti.current.add(k)
      rifiutaScambio(db, r, s.id, uid).then(
        () => avvisaServer('scambio-esito', r, s.id),
        () => fatti.current.delete(k),
      )
    }
  }, [attivo, inArrivo, r, uid])
}

const TRE_GIORNI = 3 * 24 * 3_600_000

export function PannelloScambi(p: {
  r: Rif
  uid: string
  lista: DocLista
  membri: Map<string, Membro>
  stima: (uid: string) => string
  nomeMateria: string
  nomeInterrogazione: string
  mie: Scambio[]
  inArrivo: Scambio[]
  rifiutoAutomatico: boolean
}) {
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const [occupato, setOccupato] = useState<string | null>(null)
  const nome = (uid: string | undefined) => (uid && p.membri.get(uid)?.nome) || 'Ex membro'
  const link = linkAssoluto(percorsoInterrogazione(p.r.classId, p.r.subjectId, p.r.interrogazioneId))
  const adesso = Date.now()

  const inviate = p.mie
    .filter((s) => s.stato === 'attesa' || (s.stato !== 'annullato' && adesso - (s.aggiornato?.toMillis() ?? 0) < TRE_GIORNI))
    .sort((a, b) => (b.aggiornato?.toMillis() ?? 0) - (a.aggiornato?.toMillis() ?? 0))
  const inArrivo = p.rifiutoAutomatico ? [] : p.inArrivo
  if (inArrivo.length === 0 && inviate.length === 0) return null

  async function esegui(id: string, azione: () => Promise<void>, avviso: string) {
    setOccupato(id)
    try {
      await azione()
      avvisi.mostra(avviso)
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setOccupato(null)
    }
  }

  async function accetta(s: Scambio) {
    if (!db) return
    const d = db
    const chi = nome(s.da)
    const ok = await conferma({
      titolo: `Scambiare il posto con ${chi}?`,
      testo: `Tu diventi il n° ${s.daPos + 1} (${p.stima(s.da).toLowerCase()}), ${chi} il n° ${s.aPos + 1}. La lista cambia subito per tutti.`,
      pulsante: 'Accetta lo scambio',
    })
    if (ok) {
      await esegui(
        s.id,
        async () => {
          await accettaScambio(d, p.r, s, p.uid, p.lista)
          avvisaServer('scambio-esito', p.r, s.id)
        },
        `Scambio fatto: ora sei il n° ${s.daPos + 1}`,
      )
    }
  }

  return (
    <Scheda titolo="Scambi" icona={ArrowLeftRight} tono={inArrivo.length > 0 ? 'evidenza' : 'normale'}>
      <ul className="space-y-4" aria-label="Richieste di scambio">
        {inArrivo.map((s) => (
          <li key={s.id} className="space-y-3 rounded-xl bg-accento-chiaro p-3 dark:bg-blue-950/50">
            <div className="flex items-center gap-3">
              <Avatar nome={nome(s.da)} foto={p.membri.get(s.da)?.foto ?? null} />
              <p className="min-w-0 flex-1 text-sm">
                <strong>{nome(s.da)}</strong> vorrebbe scambiare il posto con te
                <span className="block text-slate-600 dark:text-slate-300">
                  Tu passeresti dal n° {s.aPos + 1} al n° {s.daPos + 1} · {p.stima(s.da)}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Bottone icona={Check} disabled={occupato === s.id} onClick={() => accetta(s)}>
                Accetta
              </Bottone>
              <Bottone
                variante="secondario"
                icona={X}
                disabled={occupato === s.id}
                onClick={() =>
                  db &&
                  esegui(
                    s.id,
                    async () => {
                      await rifiutaScambio(db!, p.r, s.id, p.uid)
                      avvisaServer('scambio-esito', p.r, s.id)
                    },
                    `Hai rifiutato lo scambio con ${nome(s.da)}`,
                  )
                }
              >
                Rifiuta
              </Bottone>
            </div>
          </li>
        ))}

        {inviate.map((s) => {
          const destinatario = p.lista.ordine[s.aPos]
          const valida = s.stato === 'attesa' && validita(s, p.lista) === 'valida'
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="min-w-0 flex-1">
                {s.stato === 'accettato' ? (
                  <>
                    <Check aria-hidden className="mr-1 inline size-4 text-emerald-600" />
                    <strong>{nome(s.a ?? undefined)}</strong> ha accettato lo scambio
                  </>
                ) : s.stato === 'rifiutato' ? (
                  <>
                    <strong>{nome(s.a ?? undefined)}</strong> ha rifiutato lo scambio
                  </>
                ) : valida ? (
                  <>
                    Hai chiesto il n° {s.aPos + 1} a <strong>{nome(destinatario)}</strong>
                    <span className="block text-xs text-slate-500">In attesa di risposta</span>
                  </>
                ) : (
                  <>
                    La richiesta per il n° {s.aPos + 1} non è più valida
                    <span className="block text-xs text-slate-500">La lista è cambiata</span>
                  </>
                )}
              </span>
              {s.stato === 'attesa' && (
                <span className="flex flex-wrap gap-2">
                  {valida && destinatario && (
                    <a
                      href={linkWhatsApp(
                        messaggioScambio({
                          nome: nome(destinatario),
                          materia: p.nomeMateria,
                          interrogazione: p.nomeInterrogazione,
                          mia: s.daPos + 1,
                          sua: s.aPos + 1,
                          link,
                        }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle aria-hidden className="size-3.5" />
                      Avvisa su WhatsApp
                    </a>
                  )}
                  <Bottone
                    variante="piccolo"
                    disabled={occupato === s.id}
                    onClick={() => db && esegui(s.id, () => annullaScambio(db!, p.r, s.id), valida ? 'Richiesta annullata' : 'Richiesta tolta')}
                  >
                    {valida ? 'Annulla' : 'Togli'}
                  </Bottone>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Scheda>
  )
}
