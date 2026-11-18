# Protected homework checklist

`/homework` serves the HTML, assets, CSV export, and API behind HTTP Basic authentication. The frontend Render site rewrites this path to the existing backend. None of the homework UI or data is copied into the public static publish directory.

`auth-config.json` contains a username, random salt, and a SHA-256 verifier of a scrypt-derived key. It contains no password or usable decryption key. The website password is generated and held only in the collector's owner-only `data/site-access.env` file. Do not replace the verifier or salt without migrating stored data: the password-derived key also encrypts the database document with AES-256-GCM.

The existing Supabase `exec_sql` migration RPC initializes a dedicated RLS-enabled `webtop_homework` table and narrowly scoped read/compare-and-swap functions. Only encrypted envelopes reach Postgres. Homework, Webtop credentials, cookies, and plaintext website passwords are not committed. Compare-and-swap retries preserve simultaneous checkbox and collector updates.

The collector publishes a snapshot to `POST /homework/api/ingest` using Basic authentication. Existing hosted completion marks take precedence over a repeated source snapshot. A changed assignment reopens the task; a renewed attachment URL does not. `POST /homework/api/complete` updates shared completion. There is no collection/login endpoint in the hosted UI.

Build and verify:

```sh
npm run build
node --test tests/homework.test.cjs
```

To regenerate the UI from its source in the sibling collector project:

```sh
cd ../../webtop-homework
node site.mjs prepare --repository ../arnavnovia
```

The local collector remains responsible for Webtop login and automatic updates. It sends neither Webtop credentials nor browser session state to the hosted application.
