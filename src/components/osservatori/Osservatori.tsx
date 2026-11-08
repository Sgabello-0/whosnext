import { query, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Calendario } from '../../lib/calendar'
import { rifClasse, rifMembri } from '../../lib/classi'
import {
  rifInterrogazioni,
  rifLista,
  rifMaterie,
  rifPreferenza,
  rifPreferenze,
  rifScambi,
  rifSegnalazioni,
} from '../../lib/configurazione'
import { oggiISO } from '../../lib/calendar'
import { useDocumento, useQuery, type ConId } from '../../lib/hooks'
import { puoGestireDSA, puoModificareListe } from '../../lib/membri'
import { useRegistra } from '../../lib/raccolta'
import { useCalendario } from '../../lib/useCalendario'
import type { Classe, DocLista, DocPreferenza, DocScambio, Interrogazione, Materia, Membro, Ruolo } from '../../lib/tipi'
import { validita } from '../../lib/scambi'
import { useRifiutoAutomatico } from '../interrogazione/Scambi'

type ContestoClasse = {
  classId: string
  nomeClasse: string
  mioUid: string
  ruolo: Ruolo
  staff: boolean
  puoModificare: boolean
  cal: Calendario
  numeroStudenti?: number
  nomi: Record<string, string>
  rifiutaScambi: boolean
}

/**
 * Osserva in tempo reale una classe (materie e interrogazioni in corso) e registra ogni
 * interrogazione nella raccolta. Non disegna niente.
 */
export function OsservaClasse({ classId, membro }: { classId: string; membro: Membro }) {
  const staff = puoGestireDSA(membro)
  const classe = useDocumento<Classe>(db && rifClasse(db, classId))
  const { cal } = useCalendario(classId)
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  // Il numero di studenti serve solo a capo e vice (per "X su N hanno scelto")
  const membri = useQuery<Membro>(db && rifMembri(db, classId), `membri/${classId}`)

  if (!classe.dati || !cal || !materie.dati) return null
  const contesto: ContestoClasse = {
    classId,
    nomeClasse: classe.dati.nome,
    mioUid: membro.uid,
    ruolo: membro.ruolo,
    staff,
    puoModificare: puoModificareListe(membro),
    cal,
    numeroStudenti: staff ? membri.dati?.filter((m) => m.ruolo !== 'docente').length : undefined,
    nomi: Object.fromEntries((membri.dati ?? []).map((m) => [m.uid, m.nome])),
    rifiutaScambi: !!membro.rifiutaScambi,
  }
  return (
    <>
      {materie.dati.map((m) => (
        <OsservaMateria key={m.id} contesto={contesto} materia={m} />
      ))}
    </>
  )
}

function OsservaMateria({ contesto, materia }: { contesto: ContestoClasse; materia: ConId<Materia> }) {
  const interrogazioni = useQuery<Interrogazione>(
    db && query(rifInterrogazioni(db, contesto.classId, materia.id), where('stato', 'in', ['raccolta', 'lista'])),
    `in-corso/${contesto.classId}/${materia.id}`,
  )
  return (
    <>
      {interrogazioni.dati?.map((i) => (
        <OsservaInterrogazione key={i.id} contesto={contesto} materia={materia} interrogazione={i} />
      ))}
    </>
  )
}

function OsservaInterrogazione(p: { contesto: ContestoClasse; materia: ConId<Materia>; interrogazione: ConId<Interrogazione> }) {
  const { contesto: c, materia, interrogazione: i } = p
  const chiave = `${c.classId}/${materia.id}/${i.id}`
  const raccolta = i.stato === 'raccolta'
  const inLista = i.stato === 'lista'

  const mia = useDocumento<DocPreferenza>(
    db && raccolta && c.ruolo !== 'docente' ? rifPreferenza(db, c.classId, materia.id, i.id, c.mioUid) : null,
  )
  const lista = useDocumento<DocLista>(db && inLista ? rifLista(db, c.classId, materia.id, i.id) : null)
  const preferenze = useQuery<DocPreferenza>(
    db && raccolta && c.staff ? rifPreferenze(db, c.classId, materia.id, i.id) : null,
    raccolta && c.staff ? `preferenze/${chiave}` : null,
  )
  const segnalazioni = useQuery<object>(
    db && inLista && c.puoModificare ? rifSegnalazioni(db, c.classId, materia.id, i.id) : null,
    inLista && c.puoModificare ? `segnalazioni/${chiave}` : null,
  )

  // Richieste di scambio per la mia posizione (studenti in lista, non ancora interrogati)
  const mioPos = lista.dati?.ordine.indexOf(c.mioUid) ?? -1
  const segui = inLista && c.ruolo !== 'docente' && !!lista.dati && mioPos >= 0 && !lista.dati.interrogati[c.mioUid]
  const arrivo = useQuery<DocScambio>(
    db && segui
      ? query(rifScambi(db, c.classId, materia.id, i.id), where('stato', '==', 'attesa'), where('aPos', '==', mioPos))
      : null,
    segui ? `scambi-arrivo/${chiave}/${mioPos}` : null,
  )
  const scambiValidi =
    segui && lista.dati ? (arrivo.dati ?? []).filter((s) => s.da !== c.mioUid && validita(s, lista.dati!) === 'valida') : []
  useRifiutoAutomatico(
    { classId: c.classId, subjectId: materia.id, interrogazioneId: i.id },
    c.mioUid,
    c.rifiutaScambi && segui,
    scambiValidi,
  )

  useRegistra(chiave, {
    chiave,
    classId: c.classId,
    nomeClasse: c.nomeClasse,
    subjectId: materia.id,
    nomeMateria: materia.nome,
    interrogazioneId: i.id,
    nome: i.nome,
    stato: i.stato,
    giorni: i.giorni,
    perLezione: i.perLezione,
    scadenza: i.scadenzaPreferenze.toMillis(),
    cal: c.cal,
    mioUid: c.mioUid,
    ruolo: c.ruolo,
    staff: c.staff,
    puoModificare: c.puoModificare,
    miaScelta:
      mia.dati === undefined ? undefined : mia.dati === null ? null : { scelta: mia.dati.scelta, dataDSA: mia.dati.dataDSA ?? null },
    creata: i.creato ? oggiISO(i.creato.toDate()) : null,
    esclusi: i.esclusi,
    nomi: c.nomi,
    lista:
      lista.dati === undefined
        ? undefined
        : lista.dati === null
          ? null
          : {
              ordine: lista.dati.ordine,
              fissi: lista.dati.fissi,
              interrogati: lista.dati.interrogati,
              generata: lista.dati.generata ? oggiISO(lista.dati.generata.toDate()) : null,
            },
    // gli esclusi non contano né tra le risposte né tra gli studenti
    risposte: preferenze.dati?.filter((d) => !i.esclusi?.includes(d.id)).length,
    numeroStudenti: c.numeroStudenti === undefined ? undefined : c.numeroStudenti - (i.esclusi?.length ?? 0),
    segnalazioni: segnalazioni.dati?.length,
    scambiInArrivo: c.rifiutaScambi ? 0 : scambiValidi.length,
  })
  return null
}
