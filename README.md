# Interrogazioni di Classe

Sito per organizzare l'ordine delle interrogazioni della classe: preferenze (inizio / metà / fine), generazione della lista, scambi tra compagni e stima della data.

- Piano completo: [PIANO.md](PIANO.md)
- Configurazione Firebase e test del login: [GUIDA-FIREBASE.md](GUIDA-FIREBASE.md)

## Stato

Fase 1: **test del login** con un account `@studenti.ittsrimini.edu.it`.

## Sviluppo

Requisiti: Node.js 20+.

```sh
npm install
cp .env.example .env   # poi compila i valori Firebase
npm run dev            # http://localhost:5173
npm test               # test Vitest
npm run build          # build di produzione in dist/
```

Stack: React + Vite + TypeScript, Tailwind CSS, Firebase (Auth + Firestore), Netlify (hosting + Functions).
