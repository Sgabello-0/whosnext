import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { formattaCodice } from '../lib/codici'
import { copiaTesto } from '../lib/diagnostica'
import { Bottone, Scheda } from './ui'
import { Condividi } from './Condividi'
import { linkAssoluto, messaggioInvito } from '../lib/messaggi'

export function linkInvito(codice: string): string {
  return linkAssoluto(`/unisciti/${codice}`)
}

/** Codice d'invito con link, QR code e condivisione. */
export function Invito({ codice, nomeClasse }: { codice: string; nomeClasse: string }) {
  const link = linkInvito(codice)
  const [qr, setQr] = useState<string | null>(null)
  const [mostraQr, setMostraQr] = useState(false)
  const [copiato, setCopiato] = useState<'codice' | 'link' | null>(null)

  useEffect(() => {
    if (!mostraQr) return
    QRCode.toDataURL(link, { width: 480, margin: 1, errorCorrectionLevel: 'M' }).then(setQr, () => setQr(null))
  }, [link, mostraQr])

  async function copia(cosa: 'codice' | 'link') {
    if (await copiaTesto(cosa === 'codice' ? codice : link)) {
      setCopiato(cosa)
      setTimeout(() => setCopiato(null), 2000)
    }
  }


  return (
    <Scheda titolo="Invita i compagni">
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Fai entrare compagni e professori con questo codice, il link o il QR code.
        </p>
        <p className="font-mono text-3xl font-semibold tracking-widest" aria-label={`Codice ${codice.split('').join(' ')}`}>
          {formattaCodice(codice)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Bottone variante="piccolo" onClick={() => copia('codice')}>
            {copiato === 'codice' ? 'Copiato' : 'Copia codice'}
          </Bottone>
          <Bottone variante="piccolo" onClick={() => copia('link')}>
            {copiato === 'link' ? 'Copiato' : 'Copia link'}
          </Bottone>
          <Bottone variante="piccolo" onClick={() => setMostraQr((v) => !v)}>
            {mostraQr ? 'Nascondi QR' : 'Mostra QR'}
          </Bottone>
        </div>
        <Condividi
          etichetta="Messaggio d'invito pronto"
          titolo={`Unisciti a ${nomeClasse}`}
          testo={messaggioInvito({ nomeClasse, link, codice })}
        />
        {mostraQr && qr && (
          <img
            src={qr}
            alt={`QR code per entrare in ${nomeClasse}`}
            className="mx-auto w-full max-w-64 rounded-lg bg-white p-2"
          />
        )}
      </div>
    </Scheda>
  )
}
