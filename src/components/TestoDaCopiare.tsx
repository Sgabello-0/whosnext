/** Quando la copia automatica non riesce: il testo resta visibile da selezionare a mano. */
export function TestoDaCopiare({ testo }: { testo: string | null }) {
  if (!testo) return null
  return (
    <div className="space-y-2 text-sm">
      <p>Copia questo testo a mano (tieni premuto per selezionarlo):</p>
      <textarea
        readOnly
        value={testo}
        rows={8}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
      />
    </div>
  )
}
