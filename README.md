# WhosNext

Sito per organizzare l'ordine delle interrogazioni della classe: preferenze (inizio / metà / fine), generazione della lista, scambi tra compagni e stima della data.

- Piano completo: [PIANO.md](PIANO.md)
- Configurazione Firebase e test del login: [GUIDA-FIREBASE.md](GUIDA-FIREBASE.md)
- Informativa sulla privacy: [PRIVACY.md](PRIVACY.md)

## Stato

Avanzamento dettagliato in [PIANO.md](PIANO.md#avanzamento).

- ✅ Login con account della scuola: studenti (`@studenti.ittsrimini.edu.it`) e docenti (`@ittsrimini.edu.it`, sola lettura salvo permesso del capoclasse)
- ✅ Classi: crea, unisciti con codice / link / QR, gestione membri, badge DSA/BES, vice, permessi dei docenti
- ✅ Calendario, materie e interrogazioni (configurati da capoclasse e vice)
- ✅ Preferenze (inizio/metà/fine, posizione esatta per DSA/BES) e generazione della lista con stima delle date
- ✅ Riordino della lista, chi è stato interrogato, "Sono stato interrogato"
- ✅ Comodità: "Le mie interrogazioni" e "Da fare", messaggi per WhatsApp, guida della classe nuova, orario a griglia, conferme con "Annulla", cessione del ruolo, storico della lista
- ✅ App installabile (PWA) e apertura veloce anche offline (cache dei file e dei dati sul dispositivo)
- ✅ Online su Firebase Hosting: **https://whosnext-4b067.firebaseapp.com** (anche `whosnext-4b067.web.app`)
- ⏳ Prossimo passo: funzioni sul server (Netlify Functions, gratis) per scambi, notifiche e generazione automatica

## Sviluppo

Requisiti: Node.js 20+, Java (per gli emulatori Firebase).

```sh
npm install
cp .env.example .env   # poi compila i valori Firebase (vedi GUIDA-FIREBASE.md)
npm run dev            # sito collegato al progetto Firebase vero → http://localhost:5173
npm run dev:emu        # sito + emulatori con account finti, niente .env → http://localhost:5173 (pannello: :4000)
```

### Test

```sh
npm test               # test unitari (Vitest)
npm run test:regole    # regole di Firestore contro l'emulatore
npm run test:e2e       # percorso completo nel browser (Playwright, computer e telefono)
```

La prima volta `test:e2e` richiede il browser di Playwright: `npx playwright install chromium-headless-shell`.

Le icone dell'app (`public/pwa-*.png`, `public/apple-touch-icon.png`) si rigenerano con `node scripts/icone.mjs`.

### Pubblicazione

```sh
npm run deploy:regole  # pubblica firestore.rules e gli indici (serve npx firebase login)
npm run deploy:sito    # compila (con i valori di .env) e pubblica il sito su Firebase Hosting
```

## Struttura

```
src/lib/        logica e accesso ai dati (domain, codici, membri, classi, auth, hooks…)
src/pages/      Login, Classi, Unisciti, Classe, AdminClasse, Configura, Materia, Interrogazione, NonAmmesso
src/components/ componenti grafici condivisi
firestore.rules regole di sicurezza del database
tests/regole/   test delle regole (emulatore)
tests/e2e/      test nel browser (Playwright)
```

Stack: React + Vite + TypeScript, Tailwind CSS, Firebase (Auth + Firestore + Hosting), in futuro Netlify Functions per la logica sul server.
