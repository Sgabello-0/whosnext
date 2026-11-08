import { describe, expect, it } from 'vitest'
import { tipoTelefono } from './installazione'

const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
const CHROME_SU_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const COMPUTER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

describe('tipoTelefono', () => {
  it('riconosce Samsung Internet', () => expect(tipoTelefono(SAMSUNG)).toBe('samsung'))
  it('Chrome su un telefono Samsung resta Android: da lì si installa', () => expect(tipoTelefono(CHROME_SU_SAMSUNG)).toBe('android'))
  it('iPhone', () => expect(tipoTelefono(IPHONE)).toBe('iphone'))
  it('le app social vengono prima del browser', () => expect(tipoTelefono(`${SAMSUNG} Instagram 300.0`)).toBe('app-social'))
  it('dal computer nessun telefono', () => expect(tipoTelefono(COMPUTER)).toBeNull())
})
