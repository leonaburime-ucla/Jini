// Shared, multi-consumer browser-global primitives — for functions that
// genuinely have more than one owning slice/component. Nothing lives here
// yet (every current dom/*.dom.ts function turned out to be single-consumer
// when checked against actual imports); add a function here only once a
// second real consumer needs it, rather than speculatively.

export {};
