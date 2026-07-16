# Self-Validation Templates

These templates are for downstream runtime verification, not for the upstream planning stages.

Pick the closest stack template, copy it into the working repo or report flow, then fill in the real commands, health checks, critical-path assertions, and local enforcement rules for that project.

For the full downstream setup checklist, use `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/self-validation.md` and fill in every item under `What The Host Project Must Define`.

Each host project should also decide:

- which static-analysis checks are advisory vs blocking locally
- which runtime checks are advisory vs blocking in CI
- whether one bounded diagnosis pass is allowed before the final self-validation rerun

Available templates:

- `generic-web-app-template.md`
- `node-api-template.md`
- `python-service-template.md`
- `supabase-template.md`
