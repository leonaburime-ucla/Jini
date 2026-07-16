# Offloads

Use this folder as the repo-local template surface for large logs, diffs, traces, JSON blobs, and other artifacts that should not stay inline in chat or handoff text.

During normal project work, retained offloads live under `<ADS_MEMORY_ROOT>/reports/offloads/`.

If an offload is only for local iteration and should not be kept in git, prefer `<ADS_MEMORY_ROOT>/.local-artifacts/` instead of `<ADS_MEMORY_ROOT>/reports/offloads/`.

Use `<AI_DEV_SHOP_ROOT>/harness-engineering/runtime/context-offloading.md` as the rule set and `<AI_DEV_SHOP_ROOT>/framework/templates/context-offload-template.md` as the default markdown format.

Suggested layout:

```text
<ADS_MEMORY_ROOT>/reports/offloads/
  <workstream>/
    <timestamp>-<slug>.md
    <timestamp>-<slug>.txt
```

This repo-local template folder exists so ADS keeps the same workspace shape in version control.

Feature-bound offloads can also live under `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature-name>/offloads/` when the evidence belongs tightly to one feature run.
