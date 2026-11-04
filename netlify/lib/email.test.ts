import { describe, expect, it } from 'vitest'
import { htmlEmail, testoEmail } from './email'

const e = { oggetto: 'Prova <b>', righe: ['Ciao **Anna <script>**', 'Seconda riga'], pulsante: 'Apri', link: 'https://x.it/a?b=1&c="2"' }

describe('email', () => {
  it('testo semplice: righe senza asterischi, link e piè di pagina', () => {
    expect(testoEmail(e)).toBe(
      'Ciao Anna <script>\n\nSeconda riga\n\nApri: https://x.it/a?b=1&c="2"\n\n— WhosNext\nPuoi disattivare le email dalle Impostazioni: https://whos-next.web.app/impostazioni',
    )
  })
  it('HTML: niente codice dai nomi, grassetto e link al sicuro', () => {
    const h = htmlEmail(e)
    expect(h).not.toContain('<script>')
    expect(h).toContain('<strong style="color:#0f172a">Anna &lt;script&gt;</strong>')
    expect(h).toContain('Prova &lt;b&gt;')
    expect(h).toContain('href="https://x.it/a?b=1&amp;c=&quot;2&quot;"')
  })
})
