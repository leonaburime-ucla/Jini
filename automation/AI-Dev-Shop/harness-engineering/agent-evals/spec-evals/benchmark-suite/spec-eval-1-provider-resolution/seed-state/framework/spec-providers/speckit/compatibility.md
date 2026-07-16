# Speckit Compatibility Excerpt

Speckit strict package files include `feature.spec.md`, `traceability.spec.md`, `spec-manifest.md`, and `spec-dod.md`.

When Speckit is active, ask the user whether spec files should use `prefixed` or `standard` naming.

Mechanical validator:

```bash
python3 framework/spec-providers/speckit/validators/validate_spec_package.py <spec_path>
```
