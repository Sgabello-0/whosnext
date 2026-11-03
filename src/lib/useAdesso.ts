import { useEffect, useState } from 'react'

/** L'ora attuale, aggiornata ogni `ogniMs` (per scadenze e conti alla rovescia). */
export function useAdesso(ogniMs = 30_000): Date {
  const [adesso, setAdesso] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAdesso(new Date()), ogniMs)
    return () => clearInterval(id)
  }, [ogniMs])
  return adesso
}
