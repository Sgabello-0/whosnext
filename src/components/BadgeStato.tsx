import type { StatoInterrogazione } from '../lib/tipi'
import { Badge } from './ui'

const TESTI: Record<StatoInterrogazione, string> = {
  raccolta: 'Preferenze aperte',
  lista: 'Lista pronta',
  conclusa: 'Conclusa',
}

export function BadgeStato({ stato, senzaLista }: { stato: StatoInterrogazione; senzaLista?: boolean }) {
  return (
    <Badge colore={stato === 'raccolta' ? 'ambra' : stato === 'lista' ? 'verde' : 'grigio'}>
      {senzaLista && stato === 'lista' ? 'In corso' : TESTI[stato]}
    </Badge>
  )
}
