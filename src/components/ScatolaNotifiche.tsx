import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { collection, doc, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore'
import { Bell, CheckCheck } from 'lucide-react'
import { useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { formattaScadenza } from '../lib/formatoDate'
import { useQuery, type ConId } from '../lib/hooks'
import type { DocNotifica } from '../lib/tipi'

/** Notification Box: la campanella con le ultime notifiche (anche con le push spente). */
export function ScatolaNotifiche({ laterale }: { laterale?: boolean }) {
  const { uid } = useProfilo()
  const navigate = useNavigate()
  const [aperta, setAperta] = useState(false)
  const contenitore = useRef<HTMLDivElement>(null)
  const notifiche = useQuery<DocNotifica>(
    db && query(collection(db, 'users', uid, 'notifiche'), orderBy('quando', 'desc'), limit(30)),
    `notifiche/${uid}`,
  )
  const voci = notifiche.dati ?? []
  const nonLette = voci.filter((n) => !n.letta)

  useEffect(() => {
    if (!aperta) return
    const fuori = (e: MouseEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperta(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAperta(false)
    document.addEventListener('mousedown', fuori)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuori)
      document.removeEventListener('keydown', esc)
    }
  }, [aperta])

  function apri(n: ConId<DocNotifica>) {
    setAperta(false)
    if (db && !n.letta) void updateDoc(doc(db, n.percorso), { letta: true }).catch(() => undefined)
    navigate(n.link.startsWith('/') && !n.link.startsWith('//') ? n.link : '/')
  }

  async function tutteLette() {
    if (!db || nonLette.length === 0) return
    const batch = writeBatch(db)
    for (const n of nonLette) batch.update(doc(db, n.percorso), { letta: true })
    await batch.commit().catch(() => undefined)
  }

  return (
    <div ref={contenitore} className="relative">
      <button
        type="button"
        aria-label={nonLette.length > 0 ? `Notifiche (${nonLette.length} non lette)` : 'Notifiche'}
        aria-expanded={aperta}
        onClick={() => setAperta((a) => !a)}
        className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell aria-hidden className="size-5" />
        {nonLette.length > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-700 px-1 text-[10px] font-bold text-white"
          >
            {nonLette.length > 9 ? '9+' : nonLette.length}
          </span>
        )}
      </button>
      {aperta && (
        <div
          role="dialog"
          aria-label="Notifiche"
          className={`fixed z-30 flex max-h-[70dvh] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            laterale ? 'top-3 left-[16.5rem] w-96' : 'inset-x-2 top-14'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="font-semibold">Notifiche</h2>
            {nonLette.length > 0 && (
              <button type="button" onClick={tutteLette} className="flex items-center gap-1 text-xs font-medium text-accento hover:underline dark:text-blue-300">
                <CheckCheck aria-hidden className="size-4" />
                Segna tutte come lette
              </button>
            )}
          </div>
          {voci.length === 0 ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-400">Nessuna notifica per ora.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {voci.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => apri(n)}
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${n.letta ? '' : 'bg-accento-chiaro dark:bg-blue-950/60'}`}
                  >
                    <span className={`block ${n.letta ? 'font-medium' : 'font-bold'}`}>{n.titolo}</span>
                    <span className="block text-slate-700 dark:text-slate-300">{n.testo}</span>
                    {n.quando && <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{formattaScadenza(n.quando.toDate())}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
