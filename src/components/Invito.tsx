import { useEffect, useState } from 'react'
import { Check, Copy, Link2, QrCode, UserPlus } from 'lucide-react'
import { formattaCodice } from '../lib/codici'
import { copiaTesto } from '../lib/diagnostica'
import { Scheda } from './ui'
import { Condividi } from './Condividi'
import { linkAssoluto, messaggioInvito } from '../lib/messaggi'

export function linkInvito(codice: string): string {
  return linkAssoluto(`/unisciti/${codice}`)
}

function PulsanteTesto(props: { onClick: () => void; icona: typeof Copy; children: string }) {
  const Icona = props.icona
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-accento hover:bg-accento-chiaro dark:text-blue-300 dark:hover:bg-blue-950"
    >
      <Icona aria-hidden className="size-4" />
      {props.children}
    </button>
  )
}

/** Codice d'invito con messaggio pronto, link e QR code. */
export function Invito({ codice, nomeClasse }: { codice: string; nomeClasse: string }) {
  const link = linkInvito(codice)
  const [qr, setQr] = useState<string | null>(null)
  const [mostraQr, setMostraQr] = useState(false)
  const [copiato, setCopiato] = useState<'codice' | 'link' | null>(null)

  useEffect(() => {
    if (!mostraQr) return
    // La libreria del QR si scarica solo quando serve
    import('qrcode')
      .then((m) => m.default.toDataURL(link, { width: 480, margin: 1, errorCorrectionLevel: 'M' }))
      .then(setQr, () => setQr(null))
  }, [link, mostraQr])

  async function copia(cosa: 'codice' | 'link') {
    if (await copiaTesto(cosa === 'codice' ? codice : link)) {
      setCopiato(cosa)
      setTimeout(() => setCopiato(null), 2000)
    }
  }

  return (
    <Scheda titolo="Invita i compagni" icona={UserPlus} sottotitolo="Anche i professori entrano con lo stesso codice.">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/50">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">Codice della classe</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em]" aria-label={`Codice ${codice.split('').join(' ')}`}>
              {formattaCodice(codice)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => copia('codice')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            {copiato === 'codice' ? <Check aria-hidden className="size-4 text-emerald-600" /> : <Copy aria-hidden className="size-4" />}
            {copiato === 'codice' ? 'Copiato' : 'Copia codice'}
          </button>
        </div>
        <Condividi titolo={`Unisciti a ${nomeClasse}`} testo={messaggioInvito({ nomeClasse, link, codice })} />
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          <PulsanteTesto icona={copiato === 'link' ? Check : Link2} onClick={() => copia('link')}>
            {copiato === 'link' ? 'Copiato' : 'Copia link'}
          </PulsanteTesto>
          <PulsanteTesto icona={QrCode} onClick={() => setMostraQr((v) => !v)}>
            {mostraQr ? 'Nascondi QR' : 'Mostra QR'}
          </PulsanteTesto>
        </div>
        {mostraQr && qr && (
          <img
            src={qr}
            alt={`QR code per entrare in ${nomeClasse}`}
            className="mx-auto w-full max-w-64 rounded-xl bg-white p-2 shadow-sm"
          />
        )}
      </div>
    </Scheda>
  )
}
