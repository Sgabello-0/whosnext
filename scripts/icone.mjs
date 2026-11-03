// Genera le icone PNG dell'app (PWA e iPhone) disegnandole con Chromium.
// Uso: node scripts/icone.mjs
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const cartella = fileURLToPath(new URL('../public/', import.meta.url))

/** Icona: quadrato blu con le tre righe della lista. `margine` (0–1) lascia spazio per le icone "maskable". */
function svg(margine) {
  const s = 1 - margine * 2
  const t = (v) => (16 + (v - 16) * s).toFixed(2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="${margine ? 0 : 7}" fill="#2f5bd3"/>
    <path d="M${t(9)} ${t(10)}h${(14 * s).toFixed(2)}M${t(9)} ${t(16)}h${(14 * s).toFixed(2)}M${t(9)} ${t(22)}h${(9 * s).toFixed(2)}"
      stroke="#fff" stroke-width="${(3 * s).toFixed(2)}" stroke-linecap="round"/>
  </svg>`
}

const icone = [
  { nome: 'pwa-192.png', lato: 192, margine: 0 },
  { nome: 'pwa-512.png', lato: 512, margine: 0 },
  { nome: 'pwa-512-maskable.png', lato: 512, margine: 0.12 },
  { nome: 'apple-touch-icon.png', lato: 180, margine: 0.06 },
]

const browser = await chromium.launch()
const pagina = await browser.newPage()
for (const i of icone) {
  await pagina.setViewportSize({ width: i.lato, height: i.lato })
  await pagina.setContent(
    `<html><body style="margin:0;background:transparent">${svg(i.margine).replace('<svg ', `<svg width="${i.lato}" height="${i.lato}" `)}</body></html>`,
  )
  await pagina.screenshot({ path: cartella + i.nome, omitBackground: i.margine === 0 })
  console.log('creata', i.nome)
}
await browser.close()
