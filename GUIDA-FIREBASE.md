# Guida: progetto Firebase e test del login

Obiettivo: verificare che un account `@studenti.ittsrimini.edu.it` (studenti) o `@ittsrimini.edu.it` (docenti) possa entrare nel sito con "Accedi con Google".
Tempo: circa 10 minuti. Il progetto Firebase è gratuito (piano Spark).

> **Due account, due ruoli:**
> - con l'account **personale** (Gmail) **crei e gestisci** il progetto Firebase (passi 1–4);
> - con l'account **della scuola** fai solo **la prova di accesso** al sito (passo 5).

## 1. Crea il progetto Firebase

1. Vai su <https://console.firebase.google.com> e accedi con il **tuo account personale** (non quello della scuola: la scuola potrebbe non permettere di creare progetti).
2. **Crea un progetto** → nome ad esempio `interrogazioni-classe` → Google Analytics **disattivato** → Crea.

## 2. Attiva l'accesso con Google

1. Menu a sinistra: **Build → Authentication → Inizia**.
2. Scheda **Metodo di accesso** → **Google** → interruttore **Attiva**.
3. Scegli l'**email di assistenza del progetto** (la tua) → **Salva**.

## 3. Registra l'app web e copia la configurazione

1. Ingranaggio in alto a sinistra → **Impostazioni progetto** → sezione **Le tue app** → icona **`</>`** (Web).
2. Nickname: `whosnext`. Non serve spuntare Firebase Hosting (si attiva da solo al primo `npm run deploy:sito`) → **Registra app**.
3. Ti mostra un blocco `const firebaseConfig = { ... }`. Nella cartella del progetto:

   ```sh
   cp .env.example .env
   ```

   e copia i valori in `.env`:

   | firebaseConfig      | .env                                 |
   |---------------------|--------------------------------------|
   | `apiKey`            | `VITE_FIREBASE_API_KEY`              |
   | `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN`          |
   | `projectId`         | `VITE_FIREBASE_PROJECT_ID`           |
   | `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET`       |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID`  |
   | `appId`             | `VITE_FIREBASE_APP_ID`               |

   Questi valori non sono segreti (finiscono comunque nel sito pubblicato), ma `.env` resta fuori da Git per comodità.

## 4. Pubblica la schermata di consenso OAuth (importante per il test)

Firebase crea in automatico una schermata di consenso in modalità **Test**: in quella modalità può entrare solo chi è aggiunto a mano come utente di test (massimo 100), quindi l'account della scuola verrebbe rifiutato.

1. Vai su <https://console.cloud.google.com>, in alto seleziona lo **stesso progetto** creato con Firebase.
2. Menu → **API e servizi → Schermata consenso OAuth** (nelle versioni nuove: **Google Auth Platform → Pubblico**).
3. Tipo di utente: **Esterno**.
4. Prima compila la pagina **Branding**:
   - Nome dell'app: `WhosNext`
   - Email di assistenza utenti: il tuo Gmail
   - **Logo: lascialo vuoto** (caricare un logo obbliga a far verificare l'app da Google, con attese di settimane)
   - Home page dell'applicazione: `https://whos-next.web.app` (prima della pubblicazione: `https://github.com/Sgabello-0/whosnext`)
   - Norme sulla privacy: `https://github.com/Sgabello-0/whosnext/blob/main/PRIVACY.md`
   - Termini di servizio: vuoto (facoltativo)
   - Domini autorizzati: lascia quello `….firebaseapp.com` e aggiungi `github.com` e `whos-next.web.app`
   - Email del contatto sviluppatore: il tuo Gmail → **Salva**

   La privacy resta su GitHub: è un indirizzo pubblico e sempre aggiornato.
5. Stato di pubblicazione: **Pubblica app** → conferma. Diventa **In produzione**.

Usiamo solo nome, email e foto profilo (ambiti `openid`, `email`, `profile`), quindi Google non chiede la verifica dell'app.

## 5. Prova in locale

```sh
npm install
npm run dev
```

Apri <http://localhost:5173> (il dominio `localhost` è già autorizzato in Firebase) → **Accedi con Google** → scegli l'account `@studenti.ittsrimini.edu.it`.

## 6. Come leggere il risultato

| Cosa vedi | Significato | Cosa fare |
|---|---|---|
| Riquadro verde **"Funziona: accesso consentito"** | La scuola permette il login | Perfetto: si va avanti con il piano principale (solo account della scuola) |
| Google mostra **"Accesso bloccato"**, **"Il tuo amministratore non consente l'accesso"** o **"Errore 400: admin_policy_enforced"** | La scuola blocca le app di terze parti | Vedi sotto "Se la scuola blocca l'accesso" |
| Google mostra **"Errore 403: access_denied"** con "l'app è in fase di test" | La schermata di consenso è ancora in modalità Test | Ripeti il passo 4 |
| Riquadro rosso **"Dominio del sito non autorizzato"** | Il sito gira su un indirizzo non autorizzato | Firebase → Authentication → Impostazioni → Domini autorizzati → aggiungi l'indirizzo |
| Riquadro rosso **"l'account non è ammesso"** | Hai scelto un account non della scuola | Esci e riprova con l'account giusto |

In tutti i casi il tasto **Copia diagnostica** copia un riepilogo tecnico (senza password né token) da incollare in chat.

## Se la scuola blocca l'accesso

Serve che il referente informatico autorizzi l'app nella Console di amministrazione di Google Workspace.

1. Recupera l'**ID client OAuth**: Google Cloud Console → **API e servizi → Credenziali** → sezione "ID client OAuth 2.0" → riga **"Web client (auto created by Google Service)"** → copia l'ID (finisce con `.apps.googleusercontent.com`).
2. Manda al referente un messaggio come questo:

   > Buongiorno, per la classe stiamo preparando un sito (gratuito, senza pubblicità) che organizza l'ordine delle interrogazioni. Il login usa "Accedi con Google" e legge solo nome, email e foto profilo, nessun accesso a Drive, Gmail o altri dati.
   > Potrebbe autorizzarlo nella Console di amministrazione? Percorso: **Sicurezza → Accesso e controllo dei dati → Controlli API → Gestisci l'accesso delle app di terze parti → Aggiungi app → ID client OAuth**, ID:
   > `INCOLLA-QUI-L-ID-CLIENT.apps.googleusercontent.com`
   > con accesso **Attendibile** (o almeno "Limitato") per gli utenti di studenti.ittsrimini.edu.it.
   > Grazie!

3. **Piano B**, se la scuola non autorizza: il sito accetterà anche account Gmail personali, con codice d'invito della classe e approvazione del capoclasse (vedi `PIANO.md`).

## 7. Crea il database Firestore

Serve per classi, membri e liste. Si fa una volta sola, con il tuo account **personale**.

1. Console Firebase → menu a sinistra **Build → Firestore Database** → **Crea database**.
2. Edizione: **Standard** (se te lo chiede).
3. ID database: lascia `(default)`.
4. Località: **`eur3 (Europe)`** oppure **`europe-west8 (Milano)`**. **Non si può cambiare dopo**, quindi scegli una località in Europa.
5. Regole: **Avvia in modalità produzione** (blocca tutto finché non pubblichiamo le nostre regole) → **Crea**.

## 8. Pubblica le regole di sicurezza

Le regole (`firestore.rules`) decidono chi può leggere e scrivere cosa: solo account della scuola, solo membri della classe, ecc. Vanno pubblicate ogni volta che cambiano.

Nel terminale, nella cartella del progetto:

```sh
npx firebase login          # una volta sola: si apre il browser, usa il tuo account personale
npm run deploy:regole       # pubblica firestore.rules e firestore.indexes.json
```

Deve finire con `✔  Deploy complete!`. **Ripetilo ogni volta che `firestore.rules` cambia** (te lo dirò io), altrimenti le nuove funzioni del sito vengono bloccate. Il progetto di destinazione è già indicato in `.firebaserc` (`whosnext-4b067`).

> Se `firebase login` non apre il browser, usa `npx firebase login --no-localhost` e segui le istruzioni.

## 9. Prova il sito

```sh
npm run dev
```

Apri <http://localhost:5173>, accedi con l'account della scuola, crea una classe e prova a entrare con un secondo account (ad esempio da un'altra finestra in navigazione privata o dal telefono, se è sulla stessa rete: vedi `npm run dev -- --host`).

## Prove senza account veri (emulatore)

Per provare con tanti account finti (anche di docenti) senza toccare il database vero:

```sh
npm run dev:emu
```

Apri <http://localhost:5173>: la finestra di login è finta, clicca **Add new account** e inventa un'email `@studenti.ittsrimini.edu.it` o `@ittsrimini.edu.it`. Usa più finestre in navigazione privata per avere più utenti insieme. I dati spariscono quando chiudi (Ctrl+C). Su <http://localhost:4000> c'è il pannello dell'emulatore, per guardare cosa c'è nel database.

Serve Java (è già installato su questo computer).

> Il **primo** accesso dopo aver avviato l'emulatore a volte resta fermo dopo "Sign in with Google.com" (la finestra finta scarica uno script da Google che la prima volta può bloccarsi). Chiudi la finestra e clicca di nuovo **Accedi con Google**: dalla seconda volta funziona.

## Pubblicare il sito (Firebase Hosting)

```sh
npm run deploy:sito
```

Compila il sito con i valori del tuo `.env` e lo pubblica su **https://whos-next.web.app**. Gratis con il piano Spark, senza carta di credito.

- Il login usa lo stesso indirizzo del sito: nel `.env` c'è `VITE_FIREBASE_AUTH_DOMAIN=whos-next.web.app`. Così l'accesso funziona anche su iPhone con l'app installata (Safari blocca i login su domini diversi).
- Per questo `whos-next.web.app` è stato aggiunto in tre posti: Firebase → Authentication → **Domini autorizzati**; Google Cloud → Credenziali → "Web client (auto created by Google Service)" (origine `https://whos-next.web.app` e reindirizzamento `https://whos-next.web.app/__/auth/handler`); Branding della schermata di consenso → **Domini autorizzati**.
- I vecchi indirizzi `whosnext-4b067.web.app` e `whosnext-4b067.firebaseapp.com` mostrano solo la pagina della cartella `reindirizzamento/`: portano allo stesso percorso sul nuovo indirizzo e tolgono dal telefono la vecchia copia salvata dell'app.
- Gli indirizzi dei tunnel di prova (`….trycloudflare.com`) si possono togliere dai domini autorizzati quando non servono più.
- L'uso (letture e scritture del database, traffico del sito) si vede in Firebase → Firestore → **Utilizzo** e in Hosting.

## Server: generazione automatica e notifiche (Netlify Functions)

Il server (cartella `netlify/`) genera le liste alla scadenza e manda le notifiche. Gira gratis su Netlify; il sito resta su Firebase Hosting.

1. **Chiave per le push**: Firebase → ⚙ Impostazioni progetto → **Cloud Messaging** → *Configurazione web* → *Certificati push web* → **Genera coppia di chiavi**. Copia la chiave pubblica in `.env` come `VITE_FIREBASE_VAPID_KEY` (non è segreta).
2. **Account di servizio** (questo sì è segreto): Impostazioni progetto → **Account di servizio** → **Genera nuova chiave privata**. Si scarica un file JSON: non va mai su GitHub né in chat.
3. **Email (facoltativa)**: un Gmail dedicato (es. `whosnext.avvisi@gmail.com`) con la verifica in due passaggi attiva → Account Google → Sicurezza → **Password per le app** → copia la password di 16 lettere.
4. **Netlify**: *Add new project* → *Import an existing project* → GitHub → `whosnext` → lascia le impostazioni (le legge da `netlify.toml`) → **Deploy**.
5. Netlify → *Project configuration* → **Environment variables** → aggiungi (ambito *Functions*, segna come segrete quelle con ★):
   - `FIREBASE_CLIENT_EMAIL` = il valore di `client_email` nel file JSON
   - ★ `FIREBASE_PRIVATE_KEY` = il valore di `private_key` (da `-----BEGIN` a `END PRIVATE KEY-----\n`)
   - `EMAIL_UTENTE` e ★ `EMAIL_PASSWORD` (solo se hai fatto il passo 3)
6. *Deploys* → **Trigger deploy** (le variabili valgono dal deploy successivo). Poi cancella il file JSON dal computer.
7. Nel `.env` del sito: `VITE_URL_NOTIFICHE=https://<nome-progetto>.netlify.app/api/notifica`, poi `npm run deploy:sito`.

Le notifiche già mandate sono in Firestore → `invii` (una per chiave: non partono mai due volte). I log del server sono su Netlify → *Logs* → *Functions*.
