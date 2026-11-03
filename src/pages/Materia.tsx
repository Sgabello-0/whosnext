import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { creaInterrogazione, rifInterrogazioni, rifMateria } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza } from '../lib/formatoDate'
import { useDocumento, useQuery } from '../lib/hooks'
import { puoGestireDSA } from '../lib/membri'
import { useCalendario } from '../lib/useCalendario'
import { useClasse } from '../lib/useClasse'
import type { Interrogazione, Materia as TipoMateria } from '../lib/tipi'
import { BadgeStato } from '../components/BadgeStato'
import { FormInterrogazione } from '../components/FormInterrogazione'
import { GiorniMateria } from '../components/GiorniMateria'
import { ProssimeLezioni } from '../components/ProssimeLezioni'
import { StatoClasse } from '../components/StatoClasse'
import { Bottone, Caricamento, LinkBottone, Riquadro, Scheda } from '../components/ui'

export default function Materia() {
  const { classId = '', subjectId = '' } = useParams()
  const dati = useClasse(classId)
  const { cal } = useCalendario(classId)
  const materia = useDocumento<TipoMateria>(db && rifMateria(db, classId, subjectId))
  const interrogazioni = useQuery<Interrogazione>(
    db && query(rifInterrogazioni(db, classId, subjectId), orderBy('creato', 'desc')),
    `interrogazioni/${classId}/${subjectId}`,
  )
  const [nuova, setNuova] = useState(false)
  const navigate = useNavigate()

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  if (materia.errore) return <Riquadro tono="errore">{messaggioErrore(materia.errore)}</Riquadro>
  if (materia.dati === undefined) return <Caricamento />
  if (materia.dati === null) {
    return (
      <Scheda titolo="Materia non trovata">
        <p className="mb-4 text-sm text-slate-500">Forse è stata eliminata.</p>
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const m = materia.dati
  const staff = puoGestireDSA(dati.io)

  return (
    <>
      <div>
        <Link to={`/classe/${classId}`} className="text-sm text-accento hover:underline dark:text-blue-300">
          ← {dati.classe.nome}
        </Link>
        <h1 className="text-2xl font-semibold">{m.nome}</h1>
        <GiorniMateria giorni={m.orario} />
      </div>

      <Scheda titolo="Prossime lezioni">
        {cal ? <ProssimeLezioni giorni={m.orario} subjectId={subjectId} cal={cal} /> : <Caricamento />}
      </Scheda>

      <Scheda
        titolo="Interrogazioni"
        azioni={
          staff && !nuova ? (
            <Bottone variante="piccolo" onClick={() => setNuova(true)}>
              Nuova interrogazione
            </Bottone>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {nuova && db && (
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <FormInterrogazione
                giorniMateria={m.orario}
                testoSalva="Crea interrogazione"
                onAnnulla={() => setNuova(false)}
                onSalva={async (d) => {
                  const id = await creaInterrogazione(db!, classId, subjectId, d, dati.io.uid)
                  navigate(`/classe/${classId}/materia/${subjectId}/interrogazione/${id}`)
                }}
              />
            </div>
          )}
          {interrogazioni.errore ? (
            <Riquadro tono="errore">{messaggioErrore(interrogazioni.errore)}</Riquadro>
          ) : !interrogazioni.dati ? (
            <Caricamento />
          ) : interrogazioni.dati.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessuna interrogazione.{staff ? '' : ' Il capoclasse la aggiungerà quando il prof la annuncia.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {interrogazioni.dati.map((i) => (
                <li key={i.id}>
                  <Link
                    to={`/classe/${classId}/materia/${subjectId}/interrogazione/${i.id}`}
                    className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{i.nome}</span>
                      {i.stato === 'raccolta' && (
                        <span className="block text-xs text-slate-500">
                          Preferenze entro {formattaScadenza(i.scadenzaPreferenze.toDate())}
                        </span>
                      )}
                    </span>
                    <BadgeStato stato={i.stato} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Scheda>
    </>
  )
}
