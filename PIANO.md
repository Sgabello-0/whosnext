# Interrogazioni di Classe

Piano per il sito della classe, anno scolastico 2026-2027 (fino al 06/06/2027).

> Requisiti: Git, Node.js 20+, GitHub CLI (`gh auth login`). Account: GitHub, Firebase, Netlify.

## Primi passi

1. Creare un repository sul GitHub dell'utente, caricare tutto il progetto e fare commit regolari. Netlify si collega al repository per pubblicare il sito automaticamente.
2. **Test del login scolastico** prima di tutto il resto: pagina minima con login Google, da provare con un account `@studenti.ittsrimini.edu.it`. Se la scuola lo blocca ("il tuo amministratore non consente l'accesso"), bisogna chiedere al referente informatico di autorizzare l'ID client OAuth.
3. Pubblicare in modalità "Produzione" la schermata di consenso OAuth di Firebase. In modalità "Test" possono entrare al massimo 100 utenti, aggiunti a mano.
4. Accesso: se il test funziona, solo `@studenti.ittsrimini.edu.it`, controllato sia nella pagina sia nelle regole di Firestore. **Piano B** se il login è bloccato: anche Gmail personali, con codice d'invito e approvazione del capoclasse.

## Stack (tutto gratuito)

- **Frontend**: React + Vite + TypeScript, Tailwind, `@dnd-kit` per il trascinamento, installabile come PWA (serve per le notifiche push su iPhone).
- **Login e database**: Firebase (piano Spark): Auth con Google, Firestore in tempo reale.
- **Hosting e logica protetta**: Netlify + Netlify Functions con `firebase-admin`, per generare la lista, accettare gli scambi (in transazione) e inviare email e push.
- **Email**: Brevo o Resend, piano gratuito. **Push**: Firebase Cloud Messaging.
- **Job pianificato**: Netlify Scheduled Function ogni ora, per le scadenze delle preferenze, la generazione delle liste e i promemoria.

## Modello dati (Firestore)

```
users/{uid}               nome, email, foto, impostazioni { autoRifiutaScambi, notificheEmail, notifichePush }, fcmTokens[]
classes/{classId}         nome, codiceInvito, capoclasseUid, viceUids[], dominioConsentito?
  members/{uid}           nome, ruolo (capo|vice|studente), dsa: bool
  calendar/settings       giorniScolastici (lun-sab on/off), eccezioni [{data, tipo: vacanza|lezione-extra}], fineAnno: 2027-06-06
  subjects/{subjectId}    nome, orario: [giorniSettimana]
    interrogations/{iId}  nome, descrizione?, giorni?, perLezione?, scadenzaPreferenze, stato: raccolta|lista|conclusa
      preferences/{uid}   scelta: inizio|meta|fine|indifferente, posizioneDSA?
      list/current        ordine: [uid], interrogati: {uid: data}
      swaps/{swapId}      daUid, aUid, stato: pending|accettato|rifiutato|annullato, creato
inbox/{uid}/items/{id}    tipo, riferimento, letto
```

Le regole di sicurezza permettono letture e scritture solo ai membri della classe. Ordine della lista, badge DSA e calendario li modificano solo capo e vice. Gli scambi li accetta solo il server (Functions).

## Funzionalità

### Accesso e classi

- Login con Google, eventualmente limitato al dominio della scuola.
- "Crea classe": chi la crea diventa capoclasse e riceve un codice o link d'invito, anche come QR. "Unisciti" con il codice.
- Il capoclasse gestisce i membri: li rimuove, dà il badge DSA/BES, nomina un vice.

### Configurazione del capoclasse

- **Calendario** completamente personalizzabile: giorni con o senza scuola, materie per giorno, vacanze regionali o d'istituto, lezioni extra o annullate.
- Feste nazionali 2026-27 già inserite: 1/11, 8/12, 25-26/12, 1/1, 6/1, Pasqua 28/3/2027, Pasquetta 29/3, 25/4, 1/5, 2/6.
- **Materie**: nome e giorni di lezione.
- **Interrogazioni**: nome, descrizione facoltativa, giorni (di default quelli della materia), quanti interroga per lezione (facoltativo), scadenza per le preferenze.

### Preferenze e generazione della lista

Prima della scadenza ogni studente sceglie: Inizio / Metà / Fine / Non mi interessa. Chi ha il badge DSA/BES sceglie invece una posizione precisa, da 1 al numero di studenti della classe.

1. DSA/BES: ricevono la posizione esatta. Se due chiedono la stessa, la ottiene chi l'ha chiesta prima e l'altro va alla posizione libera più vicina.
2. I posti rimasti si dividono in tre fasce: inizio, metà e fine.
3. Chi ha scelto Inizio viene mescolato a caso e messo dai primi posti liberi. Chi ha scelto Fine viene messo dagli ultimi. Chi ha scelto Metà occupa la fascia centrale partendo dal centro. Se una fascia è troppo piena, chi è in più passa ai posti liberi più vicini.
4. "Non mi interessa" occupa a caso i posti rimasti. Chi non ha risposto viene trattato allo stesso modo, ma per ultimo.
5. Viene salvato un rapporto di soddisfazione (quanti hanno ottenuto la fascia scelta), visibile al capo.

Dopo la generazione il capo può riordinare la lista trascinando i nomi.

### Lista pubblica e scambi

- Tutti vedono la lista. Accanto a ogni nome c'è il tasto "Chiedi scambio", con conferma "Sei sicuro?".
- Il destinatario riceve una notifica nell'inbox, un'email e una push. Al prossimo accesso la prima cosa che vede è un popup Accetta / Rifiuta.
- Impostazione "Rifiuta automaticamente gli scambi": le richieste vengono rifiutate subito e chi le ha fatte riceve un avviso.
- Quando uno scambio viene accettato (in transazione): le due posizioni si scambiano. Le richieste in attesa *verso* chi ha accettato passano a chi ora ha la sua vecchia posizione (Leonardo aveva chiesto a Mario, Mario accetta me, quindi ora Leonardo chiede a me), e allo stesso modo le richieste verso l'altra persona. Le richieste *inviate* dai due vengono annullate e loro ricevono un avviso. Vengono eliminate le richieste che diventerebbero verso sé stessi o duplicate.
- Non si può fare uno scambio con chi è già stato interrogato.

### Segnare chi è stato interrogato (semi-automatico)

- Dopo ogni lezione il sito prepara i primi N non ancora interrogati come "probabilmente interrogati". Il capo o il vice conferma con un tocco e corregge chi era assente.
- Ognuno può segnarsi da solo con "Sono stato interrogato" e il capo approva. Gli assenti tornano in testa ai non interrogati.

### Stima della data

`k` = posizione tra i non ancora interrogati (da 0), `lezioneIndex = floor(k / perLezione)`.

- Se ci sono sia i giorni sia il numero per lezione: "Stimata: Martedì 03/11", contando solo le lezioni valide, senza feste ed eccezioni.
- Se c'è solo il numero per lezione: "Tra 1 lezione", "Tra 2 lezioni".
- Se manca il numero per lezione: "Stima non disponibile", più "Prossima lezione: Martedì 03/11" se ci sono i giorni.
- Dopo il 06/06/2027: "Oltre la fine dell'anno".

## Idee opzionali

- Ruolo vice capoclasse.
- Storico delle modifiche: chi ha spostato chi e quando.
- Esporta la lista come immagine o PDF per WhatsApp, ed esporta la propria data stimata in Google Calendar (.ics).
- Promemoria il giorno prima della data stimata.
- Limite di richieste di scambio aperte per persona e niente scambi nelle 24 ore prima della lezione.
- Preferenze anonime e badge DSA non visibile agli altri.
- Tema scuro e uso comodo da telefono.

## Struttura del progetto

```
src/  pages/ Login, Classi, Classe, Materia, Interrogazione, Inbox, Impostazioni, AdminClasse
      lib/   firebase.ts, calendar.ts, estimate.ts, generateList.ts, swaps.ts
netlify/functions/ generate-list.ts, swap-request.ts, swap-respond.ts, mark-done.ts, scheduled-hourly.ts, notify.ts
firestore.rules, netlify.toml
```

La logica pura (lista, stime, calendario, redistribuzione degli scambi) sta in moduli condivisi, testati con Vitest.

## Verifica

- Vitest: fasce, DSA, conflitti, classi piccole; stime con feste, senza giorni, senza numero, oltre il 06/06; il caso Leonardo → Mario → me.
- Firebase Emulator + `netlify dev` in locale con 3-4 account di test, per provare l'intero percorso: classe, preferenze, lista, scambi, interrogati.
- Prova a larghezza da telefono.
- Il deploy su Netlify e il progetto Firebase li crea l'utente con il proprio account, con una guida passo passo.

---

Piano originale: https://claude.ai/artifact/GuDsdk3q595wj9TucFntAU
