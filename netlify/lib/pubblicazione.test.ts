/**
 * Netlify ripubblica il server solo se cambiano i file elencati in netlify.toml ("ignore"):
 * qui si controlla che l'elenco contenga tutti i file da cui dipendono le funzioni,
 * così una modifica al server non resta mai senza pubblicazione.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const RADICE = join(import.meta.dirname, '../..')

function dipendenze(file: string, visti = new Set<string>()): Set<string> {
  if (visti.has(file)) return visti
  visti.add(file)
  const testo = readFileSync(join(RADICE, file), 'utf8')
  for (const [, percorso] of testo.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)) {
    const base = join(dirname(file), percorso!)
    const candidati = [base, base.replace(/\.mjs$/, '.mts'), base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
    const trovato = candidati.find((c) => existsSync(join(RADICE, c)) && !c.endsWith('/'))
    if (trovato) dipendenze(relative(RADICE, join(RADICE, trovato)), visti)
  }
  return visti
}

describe('pubblicazione del server su Netlify', () => {
  it('l\'elenco in netlify.toml copre tutti i file usati dalle funzioni', () => {
    const toml = readFileSync(join(RADICE, 'netlify.toml'), 'utf8')
    const riga = toml.match(/ignore = "git diff --quiet \$CACHED_COMMIT_REF \$COMMIT_REF -- ([^"]+)"/)
    expect(riga, 'manca la riga "ignore" in netlify.toml').toBeTruthy()
    const elenco = riga![1]!.split(/\s+/).filter((p) => !p.startsWith("':("))
    const usati = new Set<string>()
    for (const f of ['netlify/functions/notifica.mts', 'netlify/functions/ogni-15-minuti.mts']) for (const d of dipendenze(f)) usati.add(d)
    const scoperti = [...usati].filter((f) => !elenco.some((p) => f === p || f.startsWith(`${p}/`)))
    expect(scoperti, 'file del server non elencati in netlify.toml (ignore)').toEqual([])
  })
})
