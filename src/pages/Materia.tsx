import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarDays, CheckCheck, ClipboardList, Hourglass, ListOrdered, Plus } from 'lucide-react'
import { orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { avvisaServer } from '../lib/avvisaServer'
import { rifInterrogazioni, rifMateria } from '../lib/configurazione'
import { creaDaModulo } from '../lib/preferenze'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza } from '../lib/formatoDate'
import { useDocumento, useQuery } from '../lib/hooks'
import { puoGestireDSA } from '../lib/membri'
import { useCalendario } from '../lib/useCalendario'
import { useClasse } from '../lib/useClasse'
import type { Interrogazione, Materia as TipoMateria } from '../lib/tipi'
import { FormInterrogazione } from '../components/FormInterrogazione'
import { NOMI_GIORNI_BREVI } from '../lib/calendar'
import { ProssimeLezioni } from '../components/ProssimeLezioni'
import { StatoClasse } from '../components/StatoClasse'
import { useAvvisi } from '../components/Avvisi'
import { Bottone, Caricamento, IntestazionePagina, LinkBottone, Modulo, Pallino, Riquadro, RigaLink, Scheda, Vuoto } from '../components/ui'

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
  const avvisi = useAvvisi()

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  if (materia.errore) return <Riquadro tono="errore">{messaggioErrore(materia.errore)}</Riquadro>
  if (materia.dati === undefined) return <Caricamento />
  if (materia.dati === null) {
    return (
      <Scheda titolo="Materia non trovata">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Forse è stata eliminata.</p>
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const m = materia.dati
  const staff = puoGestireDSA(dati.io)

  return (
    <>
      <IntestazionePagina
        indietro={{ to: `/classe/${classId}`, testo: dati.classe.nome }}
        titolo={m.nome}
        sottotitolo={m.orario.length ? `Lezioni: ${m.orario.map((g) => NOMI_GIORNI_BREVI[g]).join(' · ')}` : 'Nessun giorno di lezione fisso'}
      />

      <Scheda titolo="Interrogazioni" icona={ClipboardList}>
        <div className="space-y-4">
          {staff && !nuova && (
            <Bottone icona={Plus} onClick={() => setNuova(true)}>
              Nuova interrogazione
            </Bottone>
          )}
          {nuova && db && (
            <Modulo>
              <FormInterrogazione
                giorniMateria={m.orario}
                testoSalva="Crea interrogazione"
                onAnnulla={() => setNuova(false)}
                onSalva={async (d) => {
                  const id = await creaDaModulo(db!, classId, subjectId, d, dati.io.uid)
                  if (!d.senzaLista) avvisaServer('nuova-interrogazione', { classId, subjectId, interrogazioneId: id })
                  avvisi.mostra(d.senzaLista ? 'Interrogazione creata, senza lista' : 'Interrogazione creata: ora tutti possono scegliere la preferenza')
                  navigate(`/classe/${classId}/materia/${subjectId}/interrogazione/${id}`)
                }}
              />
            </Modulo>
          )}
          {interrogazioni.errore ? (
            <Riquadro tono="errore">{messaggioErrore(interrogazioni.errore)}</Riquadro>
          ) : !interrogazioni.dati ? (
            <Caricamento />
          ) : interrogazioni.dati.length === 0 ? (
            <Vuoto icona={ClipboardList}>
              Nessuna interrogazione.{staff ? '' : ' Il capoclasse la aggiungerà quando il prof la annuncia.'}
            </Vuoto>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {interrogazioni.dati.map((i) => (
                <RigaLink
                  key={i.id}
                  to={`/classe/${classId}/materia/${subjectId}/interrogazione/${i.id}`}
                  sinistra={
                    i.stato === 'raccolta' ? (
                      <Pallino icona={Hourglass} colore="ambra" />
                    ) : i.stato === 'lista' ? (
                      <Pallino icona={ListOrdered} colore="verde" />
                    ) : (
                      <Pallino icona={CheckCheck} colore="grigio" />
                    )
                  }
                >
                  <span className="block font-medium">{i.nome}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                    {i.stato === 'raccolta'
                      ? `Preferenze entro ${formattaScadenza(i.scadenzaPreferenze.toDate())}`
                      : i.stato === 'lista'
                        ? 'Lista pronta'
                        : 'Conclusa'}
                  </span>
                </RigaLink>
              ))}
            </ul>
          )}
        </div>
      </Scheda>

      <Scheda titolo="Prossime lezioni" icona={CalendarDays}>
        {cal ? <ProssimeLezioni giorni={m.orario} subjectId={subjectId} cal={cal} /> : <Caricamento />}
      </Scheda>
    </>
  )
}
