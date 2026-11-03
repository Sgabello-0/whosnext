import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '../lib/firebase'
import { NOMI_GIORNI_BREVI } from '../lib/calendar'
import { aggiornaInterrogazione, eliminaInterrogazione, rifInterrogazione, rifMateria } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza, tempoMancante } from '../lib/formatoDate'
import { useDocumento } from '../lib/hooks'
import { puoGestireDSA } from '../lib/membri'
import { useCalendario } from '../lib/useCalendario'
import { useClasse } from '../lib/useClasse'
import type { Interrogazione as TipoInterrogazione, Materia } from '../lib/tipi'
import { BadgeStato } from '../components/BadgeStato'
import { FormInterrogazione } from '../components/FormInterrogazione'
import { ProssimeLezioni } from '../components/ProssimeLezioni'
import { StatoClasse } from '../components/StatoClasse'
import { Bottone, Caricamento, LinkBottone, Riquadro, Scheda } from '../components/ui'

export default function Interrogazione() {
  const { classId = '', subjectId = '', interrogazioneId = '' } = useParams()
  const dati = useClasse(classId)
  const { cal } = useCalendario(classId)
  const materia = useDocumento<Materia>(db && rifMateria(db, classId, subjectId))
  const interr = useDocumento<TipoInterrogazione>(db && rifInterrogazione(db, classId, subjectId, interrogazioneId))
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
  const staff = puoGestireDSA(dati.io)
  const scadenza = i.scadenzaPreferenze.toDate()

  async function elimina() {
    if (!db) return
    if (!confirm(`Eliminare l'interrogazione "${i.nome}"?`)) return
    try {
      await eliminaInterrogazione(db, classId, subjectId, interrogazioneId)
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
              {formattaScadenza(scadenza)} <span className="text-slate-500">({tempoMancante(scadenza)})</span>
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

      {i.stato === 'raccolta' && (
        <Riquadro tono="info" titolo="Preferenze">
          A breve qui sceglierai se essere interrogato all'inizio, a metà o alla fine. Dopo la scadenza il sito genererà
          la lista.
        </Riquadro>
      )}
    </>
  )
}
