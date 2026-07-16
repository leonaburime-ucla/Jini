# examples/minimal-host

The **neutrality proof + CI gate**. A ~35-line app that imports **only** `@jini/*` and boots `createDaemon` (or `createLocalNodeDaemon`) with a stub provider bundle — no project/design/artifact/OD concepts — then completes a chat run + a tool call.

The engine-boundary lint forbids this package from importing `apps/**`, `integrations/**`, `automation/**`, `@open-design/*`, or `next/*`. The release-set matrix boots this from **packed tarballs** (no workspace links) as a required check. If a kernel change can't be satisfied here without inventing a product concept, the change is rejected. See extraction-plan §7 + §12.
