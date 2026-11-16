# Solution (spoilers)

## The bug

In `server.js`, the handler for `GET /api/users/:id` applies the
`stripSensitive()` filter only on the default branch:

```js
if (req.query.fields) {
  const requested = req.query.fields.split(',').map(s => s.trim());
  const projected = {};
  for (const key of requested) {
    if (key in user) projected[key] = user[key];
  }
  return res.json(projected);   // ← password NOT stripped here
}
res.json(stripSensitive(user)); // ← stripped only on this path
```

The field-projection optimization — added for "mobile clients that only
need a few fields" — trusts the client to not request sensitive fields.
The blacklist (`SENSITIVE_FIELDS`) is never consulted inside the
projection branch.

## Proof of concept

```bash
curl 'http://localhost:3000/api/users/1?fields=username,password'
# {"username":"gkittle85","password":"BlockParty-85!Rumble"}
```

Any user id works. The attack needs no authentication.

## Minimal fix

Apply the same blacklist inside the projection path:

```js
for (const key of requested) {
  if (SENSITIVE_FIELDS.includes(key)) continue;
  if (key in user) projected[key] = user[key];
}
```

Equivalent: project first, then run the result through
`stripSensitive()`.

## Why this is a realistic bug

Field projection is a common performance optimization (REST,
MongoDB-style `fields=`, GraphQL-ish selectors). When it's added after
the "safe serialization" wrapper already exists, it's easy for the
reviewer to notice `stripSensitive()` on the default path and miss that
the new branch bypasses it entirely.
