# Interrogazioni di Classe

Piano per il sito della classe, anno scolastico 2026-2027 (fino al 06/06/2027).

> Requisiti: Git, Node.js 20+, GitHub CLI (`gh auth login`). Account: GitHub, Firebase, Netlify.

## Primi passi

1. Creare un repository sul GitHub dell'utente, caricare tutto il progetto e fare commit regolari. Netlify si collega al repository per pubblicare il sito automaticamente.
2. **Test del login scolastico** prima di tutto il resto: pagina minima con login Google, da provare con un account `@studenti.ittsrimini.edu.it`. Se la scuola lo blocca ("il tuo amministratore non consente l'accesso"), bisogna chiedere al referente informatico di autorizzare l'ID client OAuth.
3. Pubblicare in modalità "Produzione" la schermata di consenso OAuth di Firebase. In modalità "Test" possono entrare al massimo 100 utenti, aggiunti a mano.
4. Accesso: ~~se il test funziona~~ **il test ha funzionato (03/11/2026)**, quindi entrano solo gli account della scuola, controllati sia nella pagina sia nelle regole di Firestore:
   - `@studenti.ittsrimini.edu.it` → **studenti**;
   - `@ittsrimini.edu.it` → **docenti** (aggiunto il 03/11/2026, non ancora provato con un account reale: la scuola potrebbe avere regole diverse per i docenti).

   Il tipo di account dipende solo dal dominio dell'email verificata da Google, non si sceglie. Il Piano B (Gmail personali con codice d'invito) per ora non serve.

## Avanzamento

- [x] Repository GitHub e piano (03/11/2026)
- [x] Test del login con account `@studenti.ittsrimini.edu.it` (riuscito il 03/11/2026)
- [x] Dominio docenti `@ittsrimini.edu.it`
- [x] Classi: crea, unisciti con codice/link/QR, gestione membri (vice, DSA/BES, rimozione), permessi dei docenti, cambio codice
- [x] Calendario (giorni di scuola, feste nazionali calcolate, vacanze, lezioni extra/annullate), materie e interrogazioni; stima delle date pronta (`estimate.ts`)
- [x] Preferenze e generazione della lista (per ora la genera il capoclasse o il vice con un pulsante dopo la scadenza; con Netlify diventerà automatica)
- [x] Lista pubblica, riordino trascinando (anche con frecce e tastiera)
- [ ] Scambi (con le Netlify Functions: accettare uno scambio cambia la lista di tutti, quindi lo fa il server)
- [x] Segnare chi è stato interrogato (proposta dei primi N, assenti in testa, "Sono stato interrogato" con conferma) e stima delle date
- [x] Comodità: "Le mie interrogazioni" e "Da fare" nella pagina iniziale, messaggi pronti per WhatsApp, condividi la lista, guida per la classe nuova e orario a griglia, conferme con "Annulla", cessione del ruolo di capoclasse, storico delle modifiche alla lista
- [x] App installabile (PWA), pagine caricate a pezzi, cache dei dati sul dispositivo
- [ ] Notifiche (inbox, email, push) e job pianificato
- [ ] Deploy su Netlify

## Stack (tutto gratuito)

- **Frontend**: React + Vite + TypeScript, Tailwind, `@dnd-kit` per il trascinamento, installabile come PWA (serve per le notifiche push su iPhone).
- **Login e database**: Firebase (piano Spark): Auth con Google, Firestore in tempo reale.
- **Hosting e logica protetta**: Netlify + Netlify Functions con `firebase-admin`, per generare la lista, accettare gli scambi (in transazione) e inviare email e push.
- **Email**: Brevo o Resend, piano gratuito. **Push**: Firebase Cloud Messaging.
- **Job pianificato**: Netlify Scheduled Function ogni ora, per le scadenze delle preferenze, la generazione delle liste e i promemoria.

## Modello dati (Firestore)

```
users/{uid}               nome, email, foto, tipo (studente|docente), impostazioni { autoRifiutaScambi, notificheEmail, notifichePush }, fcmTokens[]
invites/{codice}          classId, nomeClasse            (si legge solo conoscendo il codice, non si può elencare)
classes/{classId}         nome, codiceInvito, capoclasseUid, creato
  members/{uid}           uid, nome, email, foto, ruolo (capo|vice|studente|docente), permessoModifica, richiestaPermesso, codiceUsato, entrato
  dsa/{uid}               impostatoDa, quando            (esiste = badge DSA/BES; lo leggono solo capo, vice e il diretto interessato)
  calendar/settings       giorniScolastici [7 bool, lun→dom], fineAnno: 2027-06-06,
                          eccezioni [{tipo: vacanza, da, a, descrizione} | {tipo: lezione-extra|lezione-annullata, data, subjectId}]
  subjects/{subjectId}    nome, orario: [giorniSettimana]
    interrogations/{iId}  nome, descrizione, giorni [] (vuoto = nessun giorno), perLezione|null, scadenzaPreferenze, stato: raccolta|lista|conclusa, creato, creatoDa
      preferences/{uid}   scelta: inizio|meta|fine|indifferente|posizione, posizioneDSA|null, aggiornato
      list/current        ordine: [uid], interrogati: {uid: data}, generata, generataDa
      list/rapporto       rapporto di soddisfazione e seme del sorteggio (solo capo e vice)
      storico/{id}        tipo (generata|riordino|interrogati|annullato), chi, quando, dettagli — obbligatorio a ogni modifica della lista
      segnalazioni/{uid}  "Sono stato interrogato": data, quando
      swaps/{swapId}      daUid, aUid, stato: pending|accettato|rifiutato|annullato, creato
inbox/{uid}/items/{id}    tipo, riferimento, letto
```

Il badge DSA/BES sta in una collezione separata (`dsa`) perché le regole di Firestore proteggono documenti interi, non singoli campi: se fosse un campo di `members` lo vedrebbe tutta la classe. Il vice e i docenti con permesso sono indicati dal `ruolo` e da `permessoModifica` nel documento del membro.

Le regole di sicurezza permettono letture e scritture solo ai membri della classe. Ordine della lista, badge DSA e calendario li modificano solo capo e vice. Gli scambi li accetta solo il server (Functions).

## Funzionalità

### Accesso e classi

- Login con Google, eventualmente limitato al dominio della scuola.
- "Crea classe": chi la crea diventa capoclasse e riceve un codice o link d'invito, anche come QR. "Unisciti" con il codice.
- Il capoclasse gestisce i membri: li rimuove, dà il badge DSA/BES, nomina un vice.

### Professori

- Entrano con l'account `@ittsrimini.edu.it` e si uniscono a una classe con il codice d'invito, come gli studenti. Non possono creare classi.
- Di base **vedono soltanto**: lista delle interrogazioni, chi è già stato interrogato, date stimate. Non vedono le preferenze né il badge DSA/BES.
- **Non fanno parte delle liste**: niente preferenze, niente posizione, niente scambi, e non vengono contati nel numero di studenti (posizioni DSA da 1 a N studenti).
- Possono **chiedere il permesso di modifica** al capoclasse, che lo accetta o lo rifiuta (notifica nell'inbox). Con il permesso possono fare ciò che fa il vice sulle liste: riordinare e segnare chi è stato interrogato. Il capoclasse può revocarlo in qualsiasi momento.
- Le regole di Firestore ricontrollano il dominio: un account studente non può mai avere il ruolo docente e viceversa.

### Configurazione del capoclasse

- **Calendario** completamente personalizzabile: giorni con o senza scuola, materie per giorno, vacanze regionali o d'istituto, lezioni extra o annullate.
- Feste nazionali 2026-27 già inserite: 1/11, 8/12, 25-26/12, 1/1, 6/1, Pasqua 28/3/2027, Pasquetta 29/3, 25/4, 1/5, 2/6. Sono calcolate per ogni anno (Pasqua compresa), con anche il 4 ottobre, festa nazionale dal 2026. Le vacanze dell'Emilia-Romagna 2026-27 sono già inserite nei calendari nuovi ([delibera regionale](https://scuola.regione.emilia-romagna.it/novita/notizie/2026/calendario-scolastico-2026-27)): 2/11/2026 (commemorazione dei defunti), Natale dal 24/12/2026 al 6/1/2027, Pasqua dal 25/3 al 30/3/2027. Per gli anni dopo si calcolano con la stessa regola (Natale 24/12–6/1, Pasqua dal giovedì prima al martedì dopo). Il capoclasse può toglierle e aggiungere quelle d'istituto (ponti, festa del patrono San Gaudenzo il 14/10…). La Regione fissa la fine delle lezioni a sabato 5/6/2027; nel sito resta il 6/6 (domenica), che per le lezioni è lo stesso.
- Giorni di scuola predefiniti: dal lunedì al venerdì (il sabato si attiva dal calendario).
- **Materie**: nome e giorni di lezione.
- **Interrogazioni**: nome, descrizione facoltativa, giorni (di default quelli della materia), quanti interroga per lezione (facoltativo), scadenza per le preferenze.

### Preferenze e generazione della lista

Prima della scadenza ogni studente sceglie: Inizio / Metà / Fine / Non mi interessa. Chi ha il badge DSA/BES sceglie invece una posizione precisa, da 1 al numero di studenti della classe.

1. DSA/BES: ricevono la posizione esatta. Se due chiedono la stessa, la ottiene chi l'ha chiesta prima e l'altro va alla posizione libera più vicina.
2. I posti rimasti si dividono in tre fasce: inizio, metà e fine.
3. Chi ha scelto Inizio viene mescolato a caso e messo dai primi posti liberi. Chi ha scelto Fine viene messo dagli ultimi. Chi ha scelto Metà occupa la fascia centrale partendo dal centro. Se una fascia è troppo piena, chi è in più passa ai posti liberi più vicini.
4. "Non mi interessa" occupa a caso i posti rimasti. Chi non ha risposto viene trattato allo stesso modo, ma per ultimo.
5. Viene salvato un rapporto di soddisfazione (quanti hanno ottenuto la fascia scelta), visibile al capo.

Dettagli decisi durante lo sviluppo:
- Le fasce: inizio e fine sono un terzo (arrotondato) dei posti liberi dopo i DSA, la metà prende il resto.
- Chi ha il badge DSA/BES può anche scegliere una fascia come tutti. Se il badge viene tolto dopo aver chiesto una posizione, quella preferenza vale come "non mi interessa".
- A parità di distanza, chi è spostato va al posto più in alto.
- Il sorteggio usa un seme salvato nel rapporto: con gli stessi dati si ricalcola la stessa lista.
- I docenti non sono nella lista e non esprimono preferenze. Le preferenze degli altri le vedono solo capo e vice.
- Il capoclasse può anticipare la scadenza modificando l'interrogazione.

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

Chi segna gli interrogati: capo, vice e docenti con permesso. Se il giorno stesso ne sono già stati segnati alcuni, la stima tiene conto dei posti già occupati in quella lezione. Quando sono stati interrogati tutti l'interrogazione diventa "conclusa" (torna "lista" se se ne toglie uno).

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

- Regole di Firestore: test contro l'emulatore (`npm run test:regole`), compresi i tentativi di aggirare il sito scrivendo direttamente sul database.
- Browser: test Playwright del percorso completo con più utenti, da computer e da telefono (`npm run test:e2e`).
- Vitest: domini studenti/docenti; fasce, DSA, conflitti, classi piccole, docenti esclusi dalla lista; stime con feste, senza giorni, senza numero, oltre il 06/06; il caso Leonardo → Mario → me.
- Firebase Emulator + `netlify dev` in locale con 3-4 account di test, per provare l'intero percorso: classe, preferenze, lista, scambi, interrogati.
- Prova a larghezza da telefono.
- Il deploy su Netlify e il progetto Firebase li crea l'utente con il proprio account, con una guida passo passo.

---

Piano originale: https://claude.ai/artifact/GuDsdk3q595wj9TucFntAU
