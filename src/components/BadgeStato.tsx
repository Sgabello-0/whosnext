import type { StatoInterrogazione } from '../lib/tipi'
import { Badge } from './ui'

const TESTI: Record<StatoInterrogazione, string> = {
  raccolta: 'Preferenze aperte',
  lista: 'Lista pronta',
  conclusa: 'Conclusa',
}

export function BadgeStato({ stato }: { stato: StatoInterrogazione }) {
  return <Badge colore={stato === 'raccolta' ? 'ambra' : stato === 'lista' ? 'verde' : 'grigio'}>{TESTI[stato]}</Badge>
}
