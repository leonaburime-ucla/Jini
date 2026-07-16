# OpenSpec Compatibility Excerpt

OpenSpec creates change folders under `openspec/changes/<change-name>/`.

Required files include:

- `proposal.md`
- `specs/<domain>/spec.md`
- `tasks.md`

`design.md` is required by default `spec-driven` schema unless explicitly justified in `proposal.md`.

OpenSpec does not use Speckit prefixed/standard naming and does not use inline `[NEEDS CLARIFICATION]` markers.

Mechanical validator:

```bash
python3 framework/spec-providers/openspec/validators/validate_openspec_package.py <change_folder>
```
