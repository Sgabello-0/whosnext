/**
 * Chi avvisare e con quale testo: nuova interrogazione, lista generata, richiesta di scambio,
 * "domani sei interrogato", cambio di posto. Ogni avviso ha una chiave, così rifare un'operazione
 * (o due esecuzioni insieme) non lo manda due volte.
 */
import type { Firestore, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore'
import { calendarioDa, type Calendario } from '../../src/lib/calendar'
import { testoStima, type Stima } from '../../src/lib/estimate'
import { percorsoInterrogazione } from '../../src/lib/messaggi'
import { programmaLista } from '../../src/lib/programma'
import { assenzaInRitardo as inRitardo, chiSiSposta, giorniAssenza } from '../../src/lib/spostamenti'
import { percorsoDi, rifDa, type Rif } from './generazione'
import { dataItalia, domaniItalia, momentoItalia, oraItalia, scadenzaItalia } from './ora'
import { avvisa, type Postino } from './postino'
import { assenzaInRitardo, cambioPosto, confermaInterrogato, domaniPossibile, listaPronta, nuovaInterrogazione, richiestaScambio, toccaDomani } from './testi'
import { SITO } from './http'


type Lista = { ordine: string[]; fissi?: Record<string, string>; interrogati: Record<string, string> }
type DatiInterrogazione = {
  nome: string
  stato: string
  giorni: number[]
  perLezione: number | null
  senzaLista?: boolean
  scadenzaPreferenze: Timestamp
  creato?: Timestamp
  creatoDa?: string
}

async function contesto(db: Firestore, r: Rif) {
  const interr = db.doc(percorsoDi(r))
  const [i, materia, cal] = await Promise.all([
    interr.get(),
    db.doc(`classes/${r.classId}/subjects/${r.subjectId}`).get(),
    db.doc(`classes/${r.classId}/calendar/settings`).get(),
  ])
  const percorso = percorsoInterrogazione(r.classId, r.subjectId, r.interrogazioneId)
  return {
    dati: i.data() as DatiInterrogazione | undefined,
    materia: (materia.data()?.nome as string | undefined) ?? 'Interrogazione',
    cal: calendarioDa(cal.data() as Partial<Calendario> | undefined),
    percorso,
    link: `${SITO}${percorso}`,
    rifLista: interr.collection('list').doc('current'),
  }
}

/** Le stime di tutti, come le vede il sito (ora italiana). */
function programma(c: Awaited<ReturnType<typeof contesto>>, r: Rif, lista: Lista, adesso: Date) {
  return programmaLista({
    ordine: lista.ordine,
    fissi: lista.fissi,
    interrogati: lista.interrogati,
    perLezione: c.dati?.perLezione ?? null,
    giorni: c.dati?.giorni ?? [],
    subjectId: r.subjectId,
    cal: c.cal,
    adesso: momentoItalia(adesso),
    creata: c.dati?.creato ? dataItalia(c.dati.creato.toDate()) : null,
  })
}

const SENZA_STIMA: Stima = { tipo: 'non-disponibile', prossimaLezione: null }

/** "Lista generata: sei il n° 3 di 25, stimata martedì 10/11" a ognuno della lista. */
export async function avvisaListaPronta(db: Firestore, postino: Postino, r: Rif, adesso: Date): Promise<number> {
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  if (!c.dati || c.dati.stato === 'raccolta' || !lista) return 0
  const { righe } = programma(c, r, lista, adesso)
  let mandate = 0
  for (const { uid, numero, stima } of righe) {
    const n = listaPronta({
      materia: c.materia,
      nome: c.dati.nome,
      percorso: c.percorso,
      link: c.link,
      posizione: numero,
      totale: lista.ordine.length,
      stima: testoStima(stima ?? SENZA_STIMA),
    })
    try {
      if ((await avvisa(db, postino, uid, `lista/${percorsoDi(r)}/${uid}`, n)) === 'mandata') mandate++
    } catch (e) {
      // uno che non si raggiunge non toglie l'avviso agli altri
      console.error(`Avviso "lista pronta" non consegnato a ${uid}:`, e)
    }
  }
  return mandate
}

type Scambio = { da: string; daPos: number; aPos: number; stato: string; a: string | null; creato?: Timestamp; aggiornato?: Timestamp }

async function nome(db: Firestore, classId: string, uid: string): Promise<string> {
  return ((await db.doc(`classes/${classId}/members/${uid}`).get()).data()?.nome as string | undefined) ?? 'Un compagno'
}

/** A chi occupa la posizione richiesta. Solo se a chiederlo è proprio chi ha fatto la richiesta. */
export async function avvisaRichiestaScambio(db: Firestore, postino: Postino, r: Rif, id: string, chiamante: string) {
  const s = (await db.doc(`${percorsoDi(r)}/scambi/${id}`).get()).data() as Scambio | undefined
  if (!s || s.da !== chiamante || s.stato !== 'attesa') return 'non-valido'
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  const destinatario = lista?.ordine[s.aPos]
  if (!c.dati || !lista || !destinatario || lista.ordine[s.daPos] !== s.da) return 'non-valido'
  const n = richiestaScambio({
    materia: c.materia,
    nome: c.dati.nome,
    percorso: c.percorso,
    link: c.link,
    chi: await nome(db, r.classId, s.da),
    mia: s.aPos + 1,
    sua: s.daPos + 1,
  })
  return avvisa(db, postino, destinatario, `scambio/${percorsoDi(r)}/${id}/${s.creato?.toMillis()}/${destinatario}`, n)
}

/** Un errore in un'interrogazione (dati rovinati, invio fallito) si registra e non ferma le altre. */
async function ognuna(percorso: string, fai: () => Promise<number>): Promise<number> {
  try {
    return await fai()
  } catch (e) {
    console.error(`Avvisi non riusciti per ${percorso}:`, e)
    return 0
  }
}

/** La sera (dalle 18 alle 22, ora italiana): "Domani sei interrogato" a chi ha la data stimata domani. */
export async function ricordaDomani(db: Firestore, postino: Postino, adesso: Date): Promise<number> {
  const ora = oraItalia(adesso)
  if (ora < 18 || ora >= 22) return 0
  const domani = domaniItalia(adesso)
  const inCorso = await db.collectionGroup('interrogations').where('stato', '==', 'lista').get()
  let mandate = 0
  for (const d of inCorso.docs) mandate += await ognuna(d.ref.path, () => avvisoDomani(db, postino, d, adesso, domani))
  return mandate
}

async function avvisoDomani(db: Firestore, postino: Postino, d: QueryDocumentSnapshot, adesso: Date, domani: string) {
  let mandate = 0
  const r = rifDa(d.ref.path)
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  if (!c.dati || !lista) return 0
  const dati = { materia: c.materia, nome: c.dati.nome, percorso: c.percorso, giorno: domani }
  for (const { uid, numero, stima } of programma(c, r, lista, adesso).righe) {
    // data certa: "domani sei interrogato"; non si sa chi tocca ma c'è lezione: "possibile"
    const sicuro = stima?.tipo === 'data' && stima.data === domani
    const possibile = stima?.tipo === 'non-disponibile' && stima.prossimaLezione === domani
    if (!sicuro && !possibile) continue
    const n = sicuro ? toccaDomani({ ...dati, posizione: numero }) : domaniPossibile(dati)
    if ((await avvisa(db, postino, uid, `domani/${d.ref.path}/${uid}/${domani}`, n)) === 'mandata') mandate++
  }
  return mandate
}

/**
 * "Nuova interrogazione: scegli il posto" a tutti gli studenti della classe (tranne chi l'ha creata).
 * Solo se a chiederlo è chi l'ha creata, mentre le preferenze sono ancora aperte.
 */
export async function avvisaNuovaInterrogazione(db: Firestore, postino: Postino, r: Rif, chiamante: string, adesso: Date) {
  const c = await contesto(db, r)
  if (!c.dati || c.dati.stato !== 'raccolta' || c.dati.creatoDa !== chiamante) return 'non-valido'
  const scadenza = c.dati.scadenzaPreferenze.toDate()
  if (scadenza <= adesso) return 'non-valido'
  const [membri, dsa] = await Promise.all([
    db.collection(`classes/${r.classId}/members`).get(),
    db.collection(`classes/${r.classId}/dsa`).get(),
  ])
  const conDSA = new Set(dsa.docs.map((d) => d.id))
  let mandate = 0
  for (const m of membri.docs) {
    if (m.data().ruolo === 'docente' || m.id === chiamante) continue
    const n = nuovaInterrogazione({
      materia: c.materia,
      nome: c.dati.nome,
      percorso: c.percorso,
      link: c.link,
      scadenza: scadenzaItalia(scadenza),
      dsa: conDSA.has(m.id),
    })
    try {
      if ((await avvisa(db, postino, m.id, `nuova/${percorsoDi(r)}/${m.id}`, n)) === 'mandata') mandate++
    } catch (e) {
      console.error(`Avviso "nuova interrogazione" non consegnato a ${m.id}:`, e)
    }
  }
  return mandate
}

/** Al solo capoclasse: uno studente si è segnato come interrogato (solo se a chiederlo è proprio lui). */
export async function avvisaSegnalazione(db: Firestore, postino: Postino, r: Rif, chiamante: string) {
  const seg = (await db.doc(`${percorsoDi(r)}/segnalazioni/${chiamante}`).get()).data() as { data?: string } | undefined
  if (!seg?.data) return 'non-valido'
  const c = await contesto(db, r)
  const capo = (await db.doc(`classes/${r.classId}`).get()).data()?.capoclasseUid as string | undefined
  if (!c.dati || !capo || capo === chiamante) return 'non-valido'
  const n = confermaInterrogato({
    materia: c.materia,
    nome: c.dati.nome,
    percorso: c.percorso,
    chi: await nome(db, r.classId, chiamante),
    giorno: seg.data,
  })
  return avvisa(db, postino, capo, `segnalazione/${percorsoDi(r)}/${chiamante}/${seg.data}`, n)
}

type VoceStorico = {
  tipo: string
  chi: string
  quando?: Timestamp
  dettagli?: { uid?: string; data?: string; nuova?: string; prima?: Lista & { fissi: Record<string, string> } }
}

/**
 * Dopo una modifica della lista: a chi ha cambiato posto per mano d'altri e, se uno studente
 * ha detto "non ci sarò" dopo il termine, a capoclasse e vice. Solo se a chiederlo è chi l'ha fatta.
 */
export async function avvisaCambioLista(db: Firestore, postino: Postino, r: Rif, id: string, chiamante: string, adesso: Date) {
  const v = (await db.doc(`${percorsoDi(r)}/storico/${id}`).get()).data() as VoceStorico | undefined
  const d = v?.dettagli
  if (!v || !d?.prima || v.chi !== chiamante) return 'non-valido'
  if (v.tipo === 'assenza' && d.uid !== chiamante) return 'non-valido'
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  if (!c.dati || !lista) return 'non-valido'

  const interr = { materia: c.materia, nome: c.dati.nome, percorso: c.percorso }
  const dopo = programma(c, r, lista, adesso)
  // senza lista non ci sono posti: conta solo la data fissata a qualcuno
  const toccati = c.dati.senzaLista
    ? v.tipo === 'fissato' && d.uid && d.uid !== chiamante
      ? [d.uid]
      : []
    : chiSiSposta({ tipo: v.tipo, uid: d.uid, chi: chiamante, prima: programma(c, r, d.prima, adesso), dopo })
  let mandate = 0
  const manda = async (uid: string, chiave: string, n: Parameters<typeof avvisa>[4]) => {
    try {
      if ((await avvisa(db, postino, uid, chiave, n)) === 'mandata') mandate++
    } catch (e) {
      console.error(`Avviso "${chiave}" non consegnato:`, e)
    }
  }
  for (const uid of toccati) {
    const riga = dopo.righe.find((x) => x.uid === uid)
    const n = cambioPosto({
      ...interr,
      uscito: !riga,
      posizione: riga?.numero ?? null,
      totale: lista.ordine.length,
      stima: testoStima(riga?.stima ?? SENZA_STIMA),
    })
    await manda(uid, `posto/${percorsoDi(r)}/${id}/${uid}`, n)
  }

  if (v.tipo === 'assenza' && d.data && d.nuova && v.quando) {
    const classe = (await db.doc(`classes/${r.classId}`).get()).data()
    if (inRitardo(dataItalia(v.quando.toDate()), d.data, giorniAssenza(classe?.assenzaGiorni))) {
      const chi = await nome(db, r.classId, chiamante)
      const staff = await db.collection(`classes/${r.classId}/members`).where('ruolo', 'in', ['capo', 'vice']).get()
      for (const m of staff.docs) {
        if (m.id === chiamante) continue
        await manda(m.id, `assenza/${percorsoDi(r)}/${id}/${m.id}`, assenzaInRitardo({ ...interr, chi, giorno: d.data, nuova: d.nuova }))
      }
    }
  }
  return mandate
}
