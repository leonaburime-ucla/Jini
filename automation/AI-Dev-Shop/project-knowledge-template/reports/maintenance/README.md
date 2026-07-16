# Maintenance Reports

This folder stores generated maintenance reports used by recurring harness cleanup passes.

The scheduled maintenance workflow refreshes `harness-maintenance.md` and can open a small PR when the generated report changes.

Retained load-bearing harness audits also live here.

Naming pattern:

`harness-load-bearing-<YYYY-MM-DD>.md`

Use `<AI_DEV_SHOP_ROOT>/framework/templates/load-bearing-harness-audit-template.md` and the rule set in `<AI_DEV_SHOP_ROOT>/harness-engineering/quality/load-bearing-harness-audit.md`.

Host capability reports are environment-specific and should be generated on demand rather than committed as universal truth. Use:

```bash
bash harness-engineering/validators/probe_host_capabilities.sh --md project-knowledge-template/reports/maintenance/host-capabilities.md --json project-knowledge-template/reports/maintenance/host-capabilities.json
```
