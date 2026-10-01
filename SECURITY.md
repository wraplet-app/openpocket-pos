# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's **"Report a vulnerability"** advisory
form on this repository (Security → Advisories), or email the maintainers at
`info@wraplet.app`.

Include: a description, reproduction steps, affected version/commit, and
potential impact. We aim to acknowledge within 72 hours and to provide a
remediation timeline after triage.

## Scope

OpenPocket POS stores financial and customer data locally on-device. Areas of
particular interest:

- SQLite data handling, migrations and backup/restore.
- Money, payment, discount, tax and inventory calculations.
- Any future cloud sync, auth or backup adapters.
- Handling of customer PII (name, phone, email, address).

## Data handling expectations

- No business data lives only in ephemeral state — it belongs in SQLite.
- Logs must not contain sensitive customer or financial data.
- Queries against user input must be parameterized.

## Supported versions

Pre-1.0: only the latest released version receives security fixes.
