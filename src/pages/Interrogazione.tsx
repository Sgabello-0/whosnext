import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '../lib/firebase'
import { NOMI_GIORNI_BREVI } from '../lib/calendar'
import { aggiornaInterrogazione, eliminaInterrogazione, rifInterrogazione, rifMateria } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza, tempoMancante } from '../lib/formatoDate'
import { useDocumento } from '../lib/hooks'
import { puoGestireDSA, puoModificareListe } from '../lib/membri'
import { useCalendario } from '../lib/useCalendario'
import { useClasse } from '../lib/useClasse'
import { useAdesso } from '../lib/useAdesso'
import type { Interrogazione as TipoInterrogazione, Materia } from '../lib/tipi'
import { BadgeStato } from '../components/BadgeStato'
import { FormInterrogazione } from '../components/FormInterrogazione'
import { ProssimeLezioni } from '../components/ProssimeLezioni'
import { StatoClasse } from '../components/StatoClasse'
import { useAvvisi } from '../components/Avvisi'
import { useConferma } from '../components/Conferma'
import { SceltaPreferenza } from '../components/interrogazione/SceltaPreferenza'
import { PannelloPreferenze } from '../components/interrogazione/PannelloPreferenze'
import { ListaInterrogazione } from '../components/interrogazione/ListaInterrogazione'
import { Bottone, Caricamento, LinkBottone, Riquadro, Scheda } from '../components/ui'

export default function Interrogazione() {
  const { classId = '', subjectId = '', interrogazioneId = '' } = useParams()
  const dati = useClasse(classId)
  const { cal } = useCalendario(classId)
  const materia = useDocumento<Materia>(db && rifMateria(db, classId, subjectId))
  const interr = useDocumento<TipoInterrogazione>(db && rifInterrogazione(db, classId, subjectId, interrogazioneId))
  const adesso = useAdesso()
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const [modifica, setModifica] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const navigate = useNavigate()

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  const erroreLettura = interr.errore ?? materia.errore
  if (erroreLettura) return <Riquadro tono="errore">{messaggioErrore(erroreLettura)}</Riquadro>
  if (interr.dati === undefined || materia.dati === undefined) return <Caricamento />
  if (interr.dati === null || materia.dati === null) {
    return (
      <Scheda titolo="Interrogazione non trovata">
        <p className="mb-4 text-sm text-slate-500">Forse è stata eliminata.</p>
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const i = interr.dati
  const io = dati.io
  const staff = puoGestireDSA(io)
  const scadenza = i.scadenzaPreferenze.toDate()
  const scaduta = scadenza <= adesso
  const studenti = dati.membri.filter((m) => m.ruolo !== 'docente')

  async function elimina() {
    if (!db) return
    const ok = await conferma({
      titolo: `Eliminare "${i.nome}"?`,
      testo: 'Spariscono anche preferenze e lista. Non si può annullare.',
      pulsante: 'Elimina',
      pericolo: true,
    })
    if (!ok) return
    try {
      await eliminaInterrogazione(db, classId, subjectId, interrogazioneId)
      avvisi.mostra('Interrogazione eliminata')
      navigate(`/classe/${classId}/materia/${subjectId}`, { replace: true })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <>
      <div>
        <Link to={`/classe/${classId}/materia/${subjectId}`} className="text-sm text-accento hover:underline dark:text-blue-300">
          ← {materia.dati.nome}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold break-words">{i.nome}</h1>
          <BadgeStato stato={i.stato} />
        </div>
        {i.descrizione && <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-400">{i.descrizione}</p>}
      </div>

      {errore && <Riquadro tono="errore">{errore}</Riquadro>}

      {modifica && db ? (
        <Scheda titolo="Modifica interrogazione">
          <FormInterrogazione
            iniziale={{ ...i, scadenzaPreferenze: scadenza }}
            giorniMateria={materia.dati.orario}
            testoSalva="Salva modifiche"
            onAnnulla={() => setModifica(false)}
            onSalva={async (d) => {
              await aggiornaInterrogazione(db!, classId, subjectId, interrogazioneId, d)
              avvisi.mostra('Modifiche salvate')
              setModifica(false)
            }}
          />
        </Scheda>
      ) : (
        <Scheda
          titolo="Dettagli"
          azioni={
            staff ? (
              <div className="flex gap-1.5">
                <Bottone variante="piccolo" onClick={() => setModifica(true)}>
                  Modifica
                </Bottone>
                <Bottone variante="piccolo" onClick={elimina}>
                  Elimina
                </Bottone>
              </div>
            ) : undefined
          }
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Preferenze entro</dt>
            <dd>
              {formattaScadenza(scadenza)} <span className="text-slate-500">({tempoMancante(scadenza, adesso)})</span>
            </dd>
            <dt className="text-slate-500">Giorni</dt>
            <dd>{i.giorni.length ? i.giorni.map((g) => NOMI_GIORNI_BREVI[g]).join(' · ') : 'nessun giorno fisso'}</dd>
            <dt className="text-slate-500">Per lezione</dt>
            <dd>{i.perLezione ? `${i.perLezione} ${i.perLezione === 1 ? 'studente' : 'studenti'}` : 'non indicato'}</dd>
          </dl>
        </Scheda>
      )}

      <Scheda titolo="Prossime lezioni">
        {cal ? <ProssimeLezioni giorni={i.giorni} subjectId={subjectId} cal={cal} /> : <Caricamento />}
      </Scheda>

      {i.stato === 'raccolta' && io.ruolo !== 'docente' && (
        <SceltaPreferenza
          classId={classId}
          subjectId={subjectId}
          interrogazioneId={interrogazioneId}
          uid={io.uid}
          dsa={dati.dsa.has(io.uid)}
          numeroStudenti={studenti.length}
          aperta={!scaduta}
        />
      )}
      {i.stato === 'raccolta' && io.ruolo === 'docente' && (
        <Riquadro tono="info">Gli studenti stanno scegliendo le preferenze. La lista comparirà qui dopo la scadenza.</Riquadro>
      )}
      {i.stato === 'raccolta' && staff && (
        <PannelloPreferenze
          classId={classId}
          subjectId={subjectId}
          interrogazioneId={interrogazioneId}
          mioUid={io.uid}
          studenti={studenti}
          scaduta={scaduta}
        />
      )}
      {i.stato !== 'raccolta' && cal && (
        <ListaInterrogazione
          classId={classId}
          subjectId={subjectId}
          interrogazioneId={interrogazioneId}
          interrogazione={i}
          membri={dati.membri}
          mioUid={io.uid}
          cal={cal}
          staff={staff}
          puoModificare={puoModificareListe(io)}
        />
      )}
    </>
  )
}
