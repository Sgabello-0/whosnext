import { limit, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { formattaGiorno } from '../../lib/calendar'
import { rifStorico } from '../../lib/configurazione'
import { formattaScadenza } from '../../lib/formatoDate'
import { useQuery } from '../../lib/hooks'
import type { DocStorico, Membro } from '../../lib/tipi'
import { History } from 'lucide-react'
import { Soffietto } from '../ui'

/** Chi ha cambiato la lista e quando: visibile a tutti, per trasparenza. */
export function StoricoLista(p: { classId: string; subjectId: string; interrogazioneId: string; membri: Map<string, Membro> }) {
  const voci = useQuery<DocStorico>(
    db && query(rifStorico(db, p.classId, p.subjectId, p.interrogazioneId), orderBy('quando', 'desc'), limit(50)),
    `storico/${p.classId}/${p.subjectId}/${p.interrogazioneId}`,
  )
  if (!voci.dati || voci.dati.length === 0) return null
  const nome = (uid: string | undefined) => (uid && p.membri.get(uid)?.nome) || 'ex membro'

  function descrivi(v: DocStorico): string {
    const chi = nome(v.chi)
    const d = v.dettagli
    switch (v.tipo) {
      case 'generata':
        return v.chi === 'automatico' ? 'La lista è stata generata in automatico alla scadenza' : `${chi} ha generato la lista`
      case 'riordino': {
        const s = d.spostati ?? []
        if (s.length === 0) return `${chi} ha salvato la lista senza cambiamenti`
        const elenco = s.slice(0, 5).map((x) => `${nome(x.uid)} da ${x.da} a ${x.a}`)
        return `${chi} ha spostato ${elenco.join(', ')}${s.length > 5 ? ` e altri ${s.length - 5}` : ''}`
      }
      case 'interrogati':
        return `${chi} ha segnato ${(d.uids ?? []).map((u) => nome(u)).join(', ')} come interrogati${d.data ? ` (${formattaGiorno(d.data).toLowerCase()})` : ''}`
      case 'annullato':
        return `${chi} ha tolto il segno di interrogato a ${nome(d.uid)}`
      case 'scambio': {
        const [x, y] = d.uids ?? []
        const [px, py] = d.posizioni ?? []
        return `${nome(x)} e ${nome(y)} si sono scambiati di posto${px && py ? ` (n° ${px} ↔ n° ${py})` : ''}`
      }
    }
  }

  return (
    <Soffietto titolo={`Storico delle modifiche (${voci.dati.length})`} icona={History}>
      <ol className="space-y-3 border-l-2 border-slate-100 pl-4 text-sm dark:border-slate-800" aria-label="Storico delle modifiche">
        {voci.dati.map((v) => (
          <li key={v.id}>
            <span className="block">{descrivi(v)}</span>
            {v.quando && <span className="block text-xs text-slate-600 dark:text-slate-400">{formattaScadenza(v.quando.toDate())}</span>}
          </li>
        ))}
      </ol>
    </Soffietto>
  )
}
