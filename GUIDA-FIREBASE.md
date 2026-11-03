# Guida: progetto Firebase e test del login

Obiettivo: verificare che un account `@studenti.ittsrimini.edu.it` possa entrare nel sito con "Accedi con Google".
Tempo: circa 10 minuti. Serve solo un account Google personale (il progetto Firebase è gratuito, piano Spark).

## 1. Crea il progetto Firebase

1. Vai su <https://console.firebase.google.com> e accedi con il **tuo account personale** (non quello della scuola: la scuola potrebbe non permettere di creare progetti).
2. **Crea un progetto** → nome ad esempio `interrogazioni-classe` → Google Analytics **disattivato** → Crea.

## 2. Attiva l'accesso con Google

1. Menu a sinistra: **Build → Authentication → Inizia**.
2. Scheda **Metodo di accesso** → **Google** → interruttore **Attiva**.
3. Scegli l'**email di assistenza del progetto** (la tua) → **Salva**.

## 3. Registra l'app web e copia la configurazione

1. Ingranaggio in alto a sinistra → **Impostazioni progetto** → sezione **Le tue app** → icona **`</>`** (Web).
2. Nickname: `whosnext`. **Non** spuntare Firebase Hosting (useremo Netlify) → **Registra app**.
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
4. Stato di pubblicazione: **Pubblica app** → conferma. Diventa **In produzione**.

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

## Dopo il deploy su Netlify

Quando il sito sarà pubblicato (ad esempio `whosnext.netlify.app`), aggiungi quell'indirizzo in **Firebase → Authentication → Impostazioni → Domini autorizzati** e copia le stesse variabili `VITE_*` in **Netlify → Site configuration → Environment variables**.
