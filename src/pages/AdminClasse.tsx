import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarX, Crown, GraduationCap, KeyRound, Pencil, RefreshCw, Trash2, UserCheck, Users } from 'lucide-react'
import { db } from '../lib/firebase'
import { cambiaCodiceInvito, impostaDSA, impostaGiorniAssenza, impostaPermessoDocente, impostaVice, rimuoviMembro, rinominaClasse } from '../lib/classi'
import { formattaCodice } from '../lib/codici'
import { eliminaClasse } from '../lib/eliminaClasse'
import { messaggioErrore } from '../lib/errori'
import { dividiMembri, puoGestireDSA } from '../lib/membri'
import { giorniAssenza, GIORNI_ASSENZA_MAX } from '../lib/spostamenti'
import { useClasse } from '../lib/useClasse'
import { useAvvisi } from '../components/Avvisi'
import { useConferma } from '../components/Conferma'
import { CediRuolo } from '../components/CediRuolo'
import type { Membro } from '../lib/tipi'
import { ListaMembri } from '../components/ListaMembri'
import { StatoClasse } from '../components/StatoClasse'
import { Avatar, Bottone, Campo, CLASSE_INPUT, IntestazionePagina, LinkBottone, Riquadro, Scheda, GrigliaSchede } from '../components/ui'

/** Gestione della classe: capoclasse (tutto) e vice (solo badge DSA/BES). */
export default function AdminClasse() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const conferma = useConferma()

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  const { classe, io, membri, dsa } = dati

  if (!puoGestireDSA(io)) {
    return (
      <Scheda titolo="Solo per capoclasse e vice">
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const capo = io.ruolo === 'capo'
  const { studenti, docenti } = dividiMembri(membri)
  const richieste = docenti.filter((d) => d.richiestaPermesso && !d.permessoModifica)

  /**
   * Esegue un'azione mostrando l'errore se fallisce; `chiave` disabilita i pulsanti di quel membro.
   * Se riesce mostra `avviso`, con "Annulla" quando c'è `annulla`.
   */
  async function esegui(chiave: string, azione: () => Promise<unknown>, avviso?: string, annulla?: () => Promise<void>) {
    setErrore(null)
    setOccupato(chiave)
    try {
      await azione()
      if (avviso) avvisi.mostra(avviso, { annulla })
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setOccupato(null)
    }
  }

  function azioniStudente(m: Membro) {
    if (!db) return null
    const d = db
    const haDSA = dsa.has(m.uid)
    const occ = occupato === m.uid
    return (
      <>
        <Bottone
          variante="piccolo"
          disabled={occ}
          onClick={() =>
            esegui(
              m.uid,
              () => impostaDSA(d, classId, m.uid, !haDSA, io.uid),
              haDSA ? `Badge DSA/BES tolto a ${m.nome}` : `Badge DSA/BES dato a ${m.nome}`,
              () => impostaDSA(d, classId, m.uid, haDSA, io.uid),
            )
          }
        >
          {haDSA ? 'Togli DSA/BES' : 'Dai DSA/BES'}
        </Bottone>
        {capo && m.ruolo !== 'capo' && (
          <Bottone
            variante="piccolo"
            disabled={occ}
            onClick={() =>
              esegui(
                m.uid,
                () => impostaVice(d, classId, m.uid, m.ruolo !== 'vice'),
                m.ruolo === 'vice' ? `${m.nome} non è più vice` : `${m.nome} è il nuovo vice`,
                () => impostaVice(d, classId, m.uid, m.ruolo === 'vice'),
              )
            }
          >
            {m.ruolo === 'vice' ? 'Togli vice' : 'Nomina vice'}
          </Bottone>
        )}
        {capo && m.ruolo !== 'capo' && (
          <Bottone variante="piccolo" disabled={occ} onClick={() => rimuovi(m)}>
            Rimuovi
          </Bottone>
        )}
      </>
    )
  }

  function azioniDocente(m: Membro) {
    if (!db || !capo) return null
    const d = db
    const occ = occupato === m.uid
    return (
      <>
        <Bottone
          variante="piccolo"
          disabled={occ}
          onClick={() =>
            esegui(
              m.uid,
              () => impostaPermessoDocente(d, classId, m.uid, !m.permessoModifica),
              m.permessoModifica ? `Permesso tolto a ${m.nome}` : `Permesso dato a ${m.nome}`,
              () => impostaPermessoDocente(d, classId, m.uid, m.permessoModifica),
            )
          }
        >
          {m.permessoModifica ? 'Togli permesso' : 'Dai permesso'}
        </Bottone>
        <Bottone variante="piccolo" disabled={occ} onClick={() => rimuovi(m)}>
          Rimuovi
        </Bottone>
      </>
    )
  }

  async function rimuovi(m: Membro) {
    if (!db) return
    const d = db
    const ok = await conferma({
      titolo: `Rimuovere ${m.nome}?`,
      testo: "Potrà rientrare solo con il codice d'invito: se serve, cambialo dalle impostazioni della classe.",
      pulsante: 'Rimuovi',
      pericolo: true,
    })
    if (ok) esegui(m.uid, () => rimuoviMembro(d, classId, m.uid), `${m.nome} rimosso dalla classe`)
  }

  return (
    <>
      <IntestazionePagina
        indietro={{ to: `/classe/${classId}`, testo: classe.nome }}
        titolo="Gestisci classe"
        sottotitolo={!capo ? 'Come vice puoi dare e togliere il badge DSA/BES.' : undefined}
      />

      {errore && <Riquadro tono="errore">{errore}</Riquadro>}

      <GrigliaSchede>
        {capo && richieste.length > 0 && (
          <Scheda titolo="Richieste di permesso dei docenti" icona={UserCheck} tono="avviso">
            <ul className="space-y-3">
              {richieste.map((m) => (
                <li key={m.uid} className="flex flex-wrap items-center gap-3">
                  <Avatar nome={m.nome} foto={m.foto} />
                  <span className="min-w-0 flex-1">
                    <strong>{m.nome}</strong> chiede di poter modificare le liste
                  </span>
                  <span className="flex gap-1.5">
                    <Bottone
                      variante="primario"
                      disabled={occupato === m.uid}
                      onClick={() =>
                        db && esegui(m.uid, () => impostaPermessoDocente(db!, classId, m.uid, true), `Permesso dato a ${m.nome}`)
                      }
                    >
                      Accetta
                    </Bottone>
                    <Bottone
                      variante="secondario"
                      disabled={occupato === m.uid}
                      onClick={() =>
                        db && esegui(m.uid, () => impostaPermessoDocente(db!, classId, m.uid, false), 'Richiesta rifiutata')
                      }
                    >
                      Rifiuta
                    </Bottone>
                  </span>
                </li>
              ))}
            </ul>
          </Scheda>
        )}

        <Scheda
          titolo={`Studenti (${studenti.length})`}
          icona={Users}
          sottotitolo="Con il badge DSA/BES lo studente sceglie il giorno dell'interrogazione. Lo vedono capoclasse, vice, docenti e lo studente, che può decidere di mostrarlo ai compagni dalle Impostazioni."
        >
          <ListaMembri membri={studenti} mioUid={io.uid} dsa={dsa} mostraEmail azioni={azioniStudente} />
        </Scheda>

        <Scheda
          titolo={`Docenti (${docenti.length})`}
          icona={GraduationCap}
          sottotitolo="I docenti vedono le liste. Con il permesso possono anche riordinarle e segnare chi è stato interrogato."
        >
          <ListaMembri membri={docenti} mioUid={io.uid} dsa={new Set()} mostraEmail azioni={azioniDocente} />
        </Scheda>

        {capo && (
          <ImpostazioniClasse
            classId={classId}
            nome={classe.nome}
            codice={classe.codiceInvito}
            giorni={giorniAssenza(classe.assenzaGiorni)}
            cedi={<CediRuolo classId={classId} mioUid={io.uid} studenti={studenti} />}
          />
        )}
      </GrigliaSchede>
    </>
  )
}

function ImpostazioniClasse({ classId, nome, codice, giorni, cedi }: { classId: string; nome: string; codice: string; giorni: number; cedi: ReactNode }) {
  const [nuovoNome, setNuovoNome] = useState(nome)
  const [inCorso, setInCorso] = useState(false)
  const avvisi = useAvvisi()
  const conferma = useConferma()

  async function esegui(azione: () => Promise<string>) {
    setInCorso(true)
    try {
      avvisi.mostra(await azione())
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  function rinomina(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    const d = db
    esegui(async () => {
      await rinominaClasse(d, classId, codice, nuovoNome)
      return 'Nome aggiornato'
    })
  }

  async function cambiaCodice() {
    if (!db) return
    const d = db
    const ok = await conferma({
      titolo: "Cambiare il codice d'invito?",
      testo: `Il codice ${formattaCodice(codice)} smetterà di funzionare, anche il link e il QR code. Chi è già nella classe resta.`,
      pulsante: 'Cambia codice',
    })
    if (ok) esegui(async () => `Nuovo codice: ${formattaCodice(await cambiaCodiceInvito(d, classId, nome, codice))}`)
  }

  return (
    <>
      <Scheda titolo="Nome della classe" icona={Pencil}>
        <form onSubmit={rinomina} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Campo etichetta="Nome della classe" valore={nuovoNome} onChange={setNuovoNome} maxLength={60} />
          </div>
          <Bottone type="submit" variante="secondario" disabled={inCorso || !nuovoNome.trim() || nuovoNome.trim() === nome}>
            Rinomina
          </Bottone>
        </form>
      </Scheda>
      <Scheda
        titolo="Codice d'invito"
        icona={KeyRound}
        sottotitolo="Se il codice è finito nelle mani sbagliate, o dopo aver rimosso qualcuno, cambialo."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xl font-bold tracking-[0.2em]">{formattaCodice(codice)}</span>
          <Bottone variante="secondario" icona={RefreshCw} onClick={cambiaCodice} disabled={inCorso}>
            Cambia codice d'invito
          </Bottone>
        </div>
      </Scheda>
      <TermineAssenze classId={classId} giorni={giorni} />
      <Scheda titolo="Passa il ruolo di capoclasse" icona={Crown} sottotitolo="Per esempio a fine anno o se cambi classe.">
        {cedi}
      </Scheda>
      <EliminaClasse classId={classId} nome={nome} codice={codice} />
    </>
  )
}

function TermineAssenze({ classId, giorni }: { classId: string; giorni: number }) {
  const avvisi = useAvvisi()
  const [valore, setValore] = useState(String(giorni))
  const [inCorso, setInCorso] = useState(false)
  const n = Number(valore)
  const valido = valore !== '' && Number.isInteger(n) && n >= 0 && n <= GIORNI_ASSENZA_MAX

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!db || !valido) return
    setInCorso(true)
    try {
      await impostaGiorniAssenza(db, classId, n)
      avvisi.mostra('Termine aggiornato')
    } catch (err) {
      avvisi.errore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Scheda
      titolo="Assenze il giorno dell'interrogazione"
      icona={CalendarX}
      sottotitolo="Dopo il termine lo studente passa comunque alla prima data disponibile, ma capoclasse e vice ricevono un avviso."
    >
      <form onSubmit={salva} className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-2 block font-medium">Si può dire "non ci sarò" entro quanti giorni prima</span>
          <input
            type="number"
            min={0}
            max={GIORNI_ASSENZA_MAX}
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            className={`${CLASSE_INPUT} max-w-28`}
          />
        </label>
        <Bottone type="submit" variante="secondario" disabled={inCorso || !valido || n === giorni}>
          Salva
        </Bottone>
      </form>
    </Scheda>
  )
}

function EliminaClasse({ classId, nome, codice }: { classId: string; nome: string; codice: string }) {
  const navigate = useNavigate()
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const [inCorso, setInCorso] = useState(false)

  async function elimina() {
    if (!db) return
    const ok = await conferma({
      titolo: `Eliminare ${nome}?`,
      testo: "Verranno eliminati per tutti membri, materie, interrogazioni e calendario. L'operazione non è reversibile.",
      pulsante: 'Elimina definitivamente',
      pericolo: true,
      richiediTesto: nome,
    })
    if (!ok) return
    setInCorso(true)
    try {
      await eliminaClasse(db, classId, codice)
      avvisi.mostra(`Classe ${nome} eliminata`)
      navigate('/', { replace: true })
    } catch (err) {
      avvisi.errore(messaggioErrore(err))
      setInCorso(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5 dark:border-rose-900 dark:bg-rose-950/20">
      <p className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
        <Trash2 aria-hidden className="size-4.5" />
        Elimina la classe
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Verranno eliminati per tutti membri, materie, interrogazioni e calendario. L'operazione non è reversibile.
      </p>
      <Bottone variante="pericolo" onClick={elimina} disabled={inCorso}>
        {inCorso ? 'Eliminazione…' : 'Elimina classe…'}
      </Bottone>
    </div>
  )
}
