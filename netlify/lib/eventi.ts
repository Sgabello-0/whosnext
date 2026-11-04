/**
 * Chi avvisare e con quale testo: lista pronta, richieste di scambio e loro esito, promemoria.
 * Ogni avviso ha una chiave, così rifare un'operazione (o due esecuzioni insieme) non lo manda due volte.
 */
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { calendarioDa, type Calendario } from '../../src/lib/calendar'
import { stimaInterrogazione, testoStima } from '../../src/lib/estimate'
import { nonInterrogati } from '../../src/lib/lista'
import { percorsoInterrogazione } from '../../src/lib/messaggi'
import { percorsoDi, rifDa, type Rif } from './generazione'
import { dataItalia, domaniItalia, oraItalia, oraMinutiItalia } from './ora'
import { avvisa, type Postino } from './postino'
import { esitoScambio, listaPronta, richiestaScambio, ricordaScelta, toccaDomani } from './testi'

const SITO = process.env.URL_SITO ?? 'https://whos-next.web.app'

type Lista = { ordine: string[]; interrogati: Record<string, string> }

async function contesto(db: Firestore, r: Rif) {
  const interr = db.doc(percorsoDi(r))
  const [i, materia, cal] = await Promise.all([
    interr.get(),
    db.doc(`classes/${r.classId}/subjects/${r.subjectId}`).get(),
    db.doc(`classes/${r.classId}/calendar/settings`).get(),
  ])
  const percorso = percorsoInterrogazione(r.classId, r.subjectId, r.interrogazioneId)
  return {
    dati: i.data() as { nome: string; stato: string; giorni: number[]; perLezione: number | null; scadenzaPreferenze: Timestamp } | undefined,
    materia: (materia.data()?.nome as string | undefined) ?? 'Interrogazione',
    cal: calendarioDa(cal.data() as Partial<Calendario> | undefined),
    percorso,
    link: `${SITO}${percorso}`,
    rifLista: interr.collection('list').doc('current'),
  }
}

function stimatore(c: Awaited<ReturnType<typeof contesto>>, r: Rif, lista: Lista, oggi: string) {
  const mancanti = nonInterrogati(lista.ordine, lista.interrogati)
  const giaOggi = Object.values(lista.interrogati).filter((d) => d === oggi).length
  return (uid: string) =>
    stimaInterrogazione({
      k: mancanti.indexOf(uid),
      perLezione: c.dati?.perLezione ?? null,
      giorni: c.dati?.giorni ?? [],
      subjectId: r.subjectId,
      cal: c.cal,
      da: oggi,
      giaInterrogatiDa: giaOggi,
    })
}

/** "La lista è pronta: sei il n° 3 di 25, stimata martedì 10/11" a ognuno della lista. */
export async function avvisaListaPronta(db: Firestore, postino: Postino, r: Rif, adesso: Date): Promise<number> {
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  if (!c.dati || c.dati.stato === 'raccolta' || !lista) return 0
  const stima = stimatore(c, r, lista, dataItalia(adesso))
  let mandate = 0
  for (const [i, uid] of lista.ordine.entries()) {
    const n = listaPronta({
      materia: c.materia,
      nome: c.dati.nome,
      percorso: c.percorso,
      link: c.link,
      posizione: i + 1,
      totale: lista.ordine.length,
      stima: testoStima(stima(uid)),
    })
    if ((await avvisa(db, postino, uid, `lista/${percorsoDi(r)}/${uid}`, n)) === 'mandata') mandate++
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

/** A chi aveva chiesto lo scambio, quando l'altro risponde. Solo se a chiederlo è chi ha risposto. */
export async function avvisaEsitoScambio(db: Firestore, postino: Postino, r: Rif, id: string, chiamante: string) {
  const s = (await db.doc(`${percorsoDi(r)}/scambi/${id}`).get()).data() as Scambio | undefined
  if (!s || s.a !== chiamante || (s.stato !== 'accettato' && s.stato !== 'rifiutato')) return 'non-valido'
  const c = await contesto(db, r)
  const lista = (await c.rifLista.get()).data() as Lista | undefined
  if (!c.dati || !lista) return 'non-valido'
  const n = esitoScambio({
    materia: c.materia,
    nome: c.dati.nome,
    percorso: c.percorso,
    chi: await nome(db, r.classId, chiamante),
    accettato: s.stato === 'accettato',
    posizione: lista.ordine.indexOf(s.da) + 1,
  })
  return avvisa(db, postino, s.da, `esito/${percorsoDi(r)}/${id}/${s.aggiornato?.toMillis()}`, n)
}

/** Scadenza entro 6 ore: un promemoria (uno solo) agli studenti che non hanno ancora scelto. */
export async function ricordaScelte(db: Firestore, postino: Postino, adesso: Date): Promise<number> {
  const entro = new Date(adesso.getTime() + 6 * 3_600_000)
  const vicine = await db
    .collectionGroup('interrogations')
    .where('stato', '==', 'raccolta')
    .where('scadenzaPreferenze', '>', Timestamp.fromDate(adesso))
    .where('scadenzaPreferenze', '<=', Timestamp.fromDate(entro))
    .get()
  let mandate = 0
  for (const d of vicine.docs) {
    const r = rifDa(d.ref.path)
    const dati = d.data() as { nome: string; scadenzaPreferenze: Timestamp }
    const [membri, preferenze, materia] = await Promise.all([
      db.collection(`classes/${r.classId}/members`).get(),
      d.ref.collection('preferences').get(),
      db.doc(`classes/${r.classId}/subjects/${r.subjectId}`).get(),
    ])
    const hanno = new Set(preferenze.docs.map((p) => p.id))
    const scadenza = dati.scadenzaPreferenze.toDate()
    for (const m of membri.docs) {
      if (m.data().ruolo === 'docente' || hanno.has(m.id)) continue
      const n = ricordaScelta({
        materia: (materia.data()?.nome as string | undefined) ?? 'Interrogazione',
        nome: dati.nome,
        percorso: percorsoInterrogazione(r.classId, r.subjectId, r.interrogazioneId),
        ora: oraMinutiItalia(scadenza),
      })
      if ((await avvisa(db, postino, m.id, `scegli/${d.ref.path}/${scadenza.getTime()}/${m.id}`, n)) === 'mandata') mandate++
    }
  }
  return mandate
}

/** La sera (dalle 18 alle 22, ora italiana): "Interrogazione prevista per domani" a chi ha la data stimata domani. */
export async function ricordaDomani(db: Firestore, postino: Postino, adesso: Date): Promise<number> {
  const ora = oraItalia(adesso)
  if (ora < 18 || ora >= 22) return 0
  const domani = domaniItalia(adesso)
  const inCorso = await db.collectionGroup('interrogations').where('stato', '==', 'lista').get()
  let mandate = 0
  for (const d of inCorso.docs) {
    const r = rifDa(d.ref.path)
    const c = await contesto(db, r)
    const lista = (await c.rifLista.get()).data() as Lista | undefined
    if (!c.dati || !lista) continue
    const stima = stimatore(c, r, lista, dataItalia(adesso))
    for (const uid of nonInterrogati(lista.ordine, lista.interrogati)) {
      const s = stima(uid)
      if (s.tipo !== 'data' || s.data !== domani) continue
      const n = toccaDomani({
        materia: c.materia,
        nome: c.dati.nome,
        percorso: c.percorso,
        giorno: domani,
        posizione: lista.ordine.indexOf(uid) + 1,
      })
      if ((await avvisa(db, postino, uid, `domani/${d.ref.path}/${uid}/${domani}`, n)) === 'mandata') mandate++
    }
  }
  return mandate
}
