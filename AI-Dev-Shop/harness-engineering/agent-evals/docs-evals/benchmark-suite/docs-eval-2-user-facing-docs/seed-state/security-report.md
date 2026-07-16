# Security Report Excerpt

User-facing behavior change:

- Invoice exports now require Bearer JWT auth and admin role.
- Previously, export links were accessible with session auth alone.

Docs must document the new auth/admin requirement.
