// Artificial Star — public staff directory
// Intentionally vulnerable demo. All credentials are fictional.

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const usersPath = path.join(__dirname, 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

// Fields that should never be returned to clients
const SENSITIVE_FIELDS = ['password'];

function stripSensitive(user) {
  const copy = { ...user };
  for (const f of SENSITIVE_FIELDS) delete copy[f];
  return copy;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Public staff directory ---

// List everyone (sanitized)
app.get('/api/users', (req, res) => {
  res.json(users.map(stripSensitive));
});

// Search by name or bio (sanitized)
app.get('/api/users/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  const matches = users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.bio.toLowerCase().includes(q)
  );
  res.json(matches.map(stripSensitive));
});

// Look up a single user, with optional field projection so clients
// can request only the fields they need (saves bandwidth on mobile).
app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });

  if (req.query.fields) {
    const requested = req.query.fields.split(',').map(s => s.trim());
    const projected = {};
    for (const key of requested) {
      if (key in user) projected[key] = user[key];
    }
    return res.json(projected);
  }

  res.json(stripSensitive(user));
});

// --- Auth (demo) ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ ok: true, user: stripSensitive(user) });
});

app.listen(PORT, () => {
  console.log(`Artificial Star directory running on http://localhost:${PORT}`);
});
