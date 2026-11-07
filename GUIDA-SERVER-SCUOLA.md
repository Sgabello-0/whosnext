# Pubblicare WhosNext su un server della scuola

Questa guida serve se un giorno la scuola mette a disposizione un proprio spazio:
- un indirizzo (per esempio `whosnext.ittsrimini.edu.it`);
- un server;
- un account email della scuola.

Non serve rifare l'app: si sposta solo quello che conviene.

## Com'è fatto oggi

| Parte | Cosa fa | Dove gira oggi |
|---|---|---|
| **Sito** | Le pagine (file statici di `npm run build`, cartella `dist/`) | Firebase Hosting |
| **Login e database** | Account Google della scuola, classi, liste, regole di sicurezza | Firebase (Google) |
| **Server** | `/api/notifica`, `/api/feedback` e il controllo ogni 15 minuti (`netlify/functions/`) | Netlify |

**Login e database conviene lasciarli su Firebase.**
- Sono gratuiti con queste dimensioni.
- La scuola usa già gli account Google.
- Spostarli vorrebbe dire riscrivere metà dell'app (login, regole, tempo reale).

Quello che può passare alla scuola sono il sito, il server e l'email.

---

## Caso 1: la scuola dà solo un indirizzo (il più semplice)

Esempio: `whosnext.ittsrimini.edu.it`. Il sito resta su Firebase Hosting, cambia solo l'indirizzo.

1. **Firebase:** Hosting → **Aggiungi dominio personalizzato** → scrivi l'indirizzo. Firebase indica dei record DNS (un `TXT` per la verifica e uno o due `A`).
2. **Tecnico della scuola:** aggiunge quei record DNS. Il certificato HTTPS lo crea Firebase da solo, in genere entro qualche ora.
3. **Login:** l'indirizzo nuovo va aggiunto in due posti.
   - **Firebase:** Authentication → Impostazioni → **Domini autorizzati** → aggiungi l'indirizzo.
   - **Google Cloud:** API e servizi → Credenziali → "Web client".
     - "Origini JavaScript autorizzate": `https://whosnext.ittsrimini.edu.it`.
     - "URI di reindirizzamento autorizzati": `https://whosnext.ittsrimini.edu.it/__/auth/handler`.
4. **`.env` del sito:** `VITE_FIREBASE_AUTH_DOMAIN=whosnext.ittsrimini.edu.it`, poi `npm run deploy:sito`.
5. **Netlify:** `URL_SITO=https://whosnext.ittsrimini.edu.it`.
   - Lascia l'indirizzo vecchio in `ORIGINI_PERMESSE` finché qualcuno lo usa ancora.
   - Le variabili valgono dalla pubblicazione successiva del server.
6. **Indirizzo vecchio:** fai in modo che porti a quello nuovo. Puoi usare una pagina di rinvio come quella in `reindirizzamento/` (vedi GUIDA-FIREBASE).
7. **App installata:** chi l'ha sul telefono la reinstalla dall'indirizzo nuovo. Con quella vecchia le notifiche continuano ad arrivare, ma sul vecchio indirizzo.

---

## Caso 2: la scuola dà un server (Linux, con accesso amministratore)

Sul server della scuola vanno il **sito** e il **server**. Firebase resta per login e database, quindi **non c'è nessun dato da spostare**.

### Cosa chiedere al tecnico
- **Sistema:** Linux (Debian o Ubuntu) con **Node.js 24** e un server web (**nginx** o Apache).
- **Indirizzo:** un sottodominio che punti al server, con HTTPS. Va bene Let's Encrypt (`certbot`), gratuito e automatico.
- **Rete:** il server deve poter **uscire** verso Internet, cioè verso Google (Firestore, invio delle notifiche push) e verso la posta. Non servono porte aperte oltre a 443 (HTTPS).
- **Avvio e controllo periodico:** un servizio che resti acceso (systemd) e un'operazione pianificata ogni 15 minuti (cron o un timer di systemd).

### 1. Il sito (file statici)
1. Nel `.env`:
   - `VITE_URL_NOTIFICHE=https://whosnext.ittsrimini.edu.it/api/notifica`;
   - `VITE_FIREBASE_AUTH_DOMAIN=whosnext.ittsrimini.edu.it`.
2. Lancia `npm run build` e copia la cartella `dist/` sul server, per esempio in `/var/www/whosnext`.
3. Nella configurazione di nginx servono quattro regole:
   - **pagine:** ogni indirizzo senza estensione apre `index.html`; un file che manca dà 404;
   - **intestazioni di sicurezza:** `X-Frame-Options: SAMEORIGIN` e `Content-Security-Policy: frame-ancestors 'self'`;
   - **server:** `/api/` va girato al server Node in locale (`proxy_pass http://127.0.0.1:8787`);
   - **login:** `/__/auth/` va girato a `https://<id-progetto>.firebaseapp.com/__/auth/`, altrimenti il login con Google non funziona sul dominio della scuola.

   Le prime due sono le stesse che oggi stanno in `firebase.json`.

### 2. Il server
Le funzioni in `netlify/functions/` ricevono una richiesta e restituiscono una risposta nel formato standard del web (`Request`/`Response`). Funzionano anche fuori da Netlify, con un piccolo "adattatore" di qualche decina di righe:
- un server Node (`node:http`) che riceve `/api/notifica` e `/api/feedback` e chiama le stesse funzioni;
- uno script che esegue `ogni-15-minuti` e si chiude, lanciato da cron ogni 15 minuti.

Il codice si compila con esbuild in un file unico, come fa già Netlify.

> Quando servirà, l'adattatore lo prepariamo insieme: è poco lavoro, e la logica (generazione, notifiche, feedback) resta identica e già coperta dai test.

Le variabili sono le stesse di oggi su Netlify. Vanno messe in un file leggibile solo dal servizio, per esempio `/etc/whosnext.env` con permessi `600`:
- `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`;
- `URL_SITO=https://whosnext.ittsrimini.edu.it`;
- `EMAIL_UTENTE`, `EMAIL_PASSWORD`, `FEEDBACK_A`, ed eventualmente `EMAIL_ATTIVE`.

### 3. Il giorno del passaggio
1. Pubblica sito e server sulla macchina della scuola e prova il login, una notifica e un feedback.
2. Su Firebase e Google Cloud aggiungi l'indirizzo nuovo (vedi il caso 1, punto 3).
3. Metti la pagina di rinvio sull'indirizzo vecchio.
4. Dopo qualche settimana senza problemi, spegni il progetto su Netlify.

---

## Caso 3: la scuola dà un indirizzo email (per esempio `whosnext@ittsrimini.edu.it`)

È il pezzo che oggi manca: le email da Gmail non arrivano agli account della scuola, quelle da un indirizzo della scuola sì.

1. Serve un account Google Workspace della scuola con una **password per le app** (verifica in due passaggi attiva). In alternativa il tecnico può abilitare il servizio SMTP relay di Google Workspace per il server.
2. Sul server, Netlify o quello della scuola, imposta:
   - `EMAIL_UTENTE=whosnext@ittsrimini.edu.it`;
   - `EMAIL_PASSWORD=<password per le app>`;
   - `EMAIL_ATTIVE=si`;
   - `URL_SITO`, che serve per i link nelle email.
3. Nel sito va rimesso l'interruttore "Email" nelle Impostazioni (il codice c'è già: `notificheEmail`).
4. Aggiorna la `PRIVACY.md`: le email ai compagni partono dall'indirizzo della scuola.

---

## Privacy: se la scuola "adotta" WhosNext

Se l'app diventa ufficiale della scuola, **titolare del trattamento** dei dati diventa la scuola: va sentito il suo responsabile della protezione dei dati (DPO).

In pratica:
- si aggiorna `PRIVACY.md` con i riferimenti della scuola;
- si valuta come trattare il badge DSA/BES, che è un dato delicato. Oggi è nascondibile dallo studente e sempre visibile a capoclasse e vice.

Firebase (Google) è già usato dalle scuole tramite Workspace. Il progetto può essere trasferito a un account della scuola (Console Firebase → Utenti e autorizzazioni → aggiungi un proprietario) senza spostare i dati.

## Costi
- **Caso 1:** zero.
- **Casi 2 e 3:** zero per WhosNext. Il server e l'email li fornisce la scuola.
