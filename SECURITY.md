# Security

This repository is a sanitized portfolio demonstration and must be connected only to test infrastructure with fictitious data.

## Credentials

- Never commit `.env` files, tokens, private keys, or production credentials.
- Use `.env.example` only as a template.
- If a credential is committed accidentally, revoke it immediately and remove it from Git history before publishing.

## Database

Review all SQL migrations and Row-Level Security policies against your own Supabase configuration before deployment. The included schema is a development reference and is not a substitute for a production security review.

## Reporting

Please report suspected security issues privately to the repository owner rather than opening a public issue with sensitive details.
