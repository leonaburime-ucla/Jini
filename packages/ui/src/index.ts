// @jini/ui — generic, product-neutral UI primitives.
// See packages/ui/README.md for scope and docs/jini-port/ui-extraction-plan.md
// for the extraction plan. Real component/feature-slice content is blocked on
// the components-sweep tasks in that plan; this package currently ships the
// framework-free/DOM utility layer lifted from the runtime/providers/lib
// sweep (see packages/ui/source-map.md).

export * from './utils/zip.js';
export * from './utils/sse.js';
export * from './utils/copy-to-clipboard.js';
export * from './utils/appearance.js';
export * from './utils/dom-subscriptions.js';
