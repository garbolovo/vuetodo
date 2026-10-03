const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'todos.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const getTodos = db.prepare('SELECT data FROM todos WHERE id = 1');
const upsertTodos = db.prepare(`
  INSERT INTO todos (id, data, updated_at) VALUES (1, ?, datetime('now'))
  ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`);

const app = express();
// credentials: true + reflecting the request origin (rather than "*") is
// required because the frontend sends `credentials: 'include'` so the
// browser forwards its cached Basic Auth entry on cross-origin requests.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/todos', (req, res) => {
  const row = getTodos.get();
  res.json(row ? JSON.parse(row.data) : []);
});

app.put('/api/todos', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON array of todos.' });
  }
  upsertTodos.run(JSON.stringify(req.body));
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`vuetodo-server listening on port ${PORT}, db at ${DB_PATH}`);
});
