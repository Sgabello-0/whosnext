import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarDays, Clock, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { db } from '../lib/firebase'
import { momentoLocale, NOMI_GIORNI_BREVI, oggiISO } from '../lib/calendar'
import { dateDisponibili } from '../lib/programma'
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
import { Bottone, Caricamento, Info, IntestazionePagina, LinkBottone, Riquadro, Scheda, Soffietto } from '../components/ui'

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
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Forse è stata eliminata.</p>
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
      testo: 'Verranno eliminate anche preferenze e lista. L\'operazione non è reversibile.',
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
      <IntestazionePagina
        indietro={{ to: `/classe/${classId}/materia/${subjectId}`, testo: materia.dati.nome }}
        titolo={i.nome}
        badge={<BadgeStato stato={i.stato} />}
        sottotitolo={i.descrizione ? <p className="whitespace-pre-line">{i.descrizione}</p> : undefined}
        azioni={
          staff &&
          !modifica && (
            <>
              <Bottone variante="piccolo" icona={Pencil} onClick={() => setModifica(true)}>
                Modifica
              </Bottone>
              <Bottone variante="piccolo" icona={Trash2} onClick={elimina}>
                Elimina
              </Bottone>
            </>
          )
        }
      />

      {errore && <Riquadro tono="errore">{errore}</Riquadro>}

      {modifica && db ? (
        <Scheda titolo="Modifica interrogazione" icona={Pencil}>
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
        <div className="flex flex-wrap gap-2">
          {i.stato === 'raccolta' && (
            <Info icona={Clock}>
              Preferenze entro {formattaScadenza(scadenza)} <span className="text-slate-600 dark:text-slate-400">({tempoMancante(scadenza, adesso)})</span>
            </Info>
          )}
          <Info icona={CalendarDays}>
            {i.giorni.length ? i.giorni.map((g) => NOMI_GIORNI_BREVI[g]).join(' · ') : 'nessun giorno fisso'}
          </Info>
          <Info icona={Users}>
            {i.perLezione ? `${i.perLezione} ${i.perLezione === 1 ? 'studente' : 'studenti'} per lezione` : 'per lezione: non indicato'}
          </Info>
        </div>
      )}

      {i.stato === 'raccolta' && io.ruolo !== 'docente' && (
        <SceltaPreferenza
          classId={classId}
          subjectId={subjectId}
          interrogazioneId={interrogazioneId}
          uid={io.uid}
          dsa={dati.dsa.has(io.uid)}
          dateDSA={
            cal && dati.dsa.has(io.uid)
              ? dateDisponibili({
                  giorni: i.giorni,
                  subjectId,
                  cal,
                  adesso: momentoLocale(adesso),
                  creata: i.creato ? oggiISO(i.creato.toDate()) : null,
                  scadenza: momentoLocale(scadenza),
                  perLezione: i.perLezione,
                  numeroStudenti: studenti.length,
                })
              : []
          }
          aperta={!scaduta}
          escluso={(i.esclusi ?? []).includes(io.uid)}
        />
      )}
      {i.stato === 'raccolta' && io.ruolo === 'docente' && (
        <Riquadro tono="info" icona={Eye}>
          Gli studenti stanno scegliendo le preferenze. La lista comparirà qui dopo la scadenza.
        </Riquadro>
      )}
      {i.stato === 'raccolta' && staff && (
        <PannelloPreferenze
          classId={classId}
          subjectId={subjectId}
          interrogazioneId={interrogazioneId}
          mioUid={io.uid}
          studenti={studenti}
          scaduta={scaduta}
          nomeInterrogazione={i.nome}
          nomeMateria={materia.dati.nome}
          scadenza={scadenza}
          esclusi={i.esclusi ?? []}
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
          dsa={dati.dsa}
          nomeMateria={materia.dati.nome}
        />
      )}

      <Soffietto titolo="Prossime lezioni" icona={CalendarDays}>
        {cal ? <ProssimeLezioni giorni={i.giorni} subjectId={subjectId} cal={cal} /> : <Caricamento />}
      </Soffietto>
    </>
  )
}
