# Changelog

The chart's values are its public interface. Versioning:

- **Major**: a value renamed or removed, a dependency newly required, or a
  changed meaning for an existing value.
- **Minor**: a new optional value or optional dependency with a safe default.
- **Patch**: template fixes with no change to the values contract.

## 1.0.0

- Explicit dependency contract: `database` (existingSecret or url),
  `temporal` (enabled, address, namespace), `opa` (enabled, url, policyPath).
- `values.schema.json`, install-time messages for missing dependencies,
  NOTES.txt dependency summary, `helm test` dependency check.
- Istio VirtualService is now off by default and requires host and gateway.
