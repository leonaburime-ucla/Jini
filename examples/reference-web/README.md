# Jini Playground — web host

This Vite + React app is Jini's runnable browser reference host. It consumes
`@jini/chat-react`, starts a real `@jini/node-host` daemon, and adapts the daemon's durable
run/SSE protocol to the headless chat transport.

The default Demo runtime is deterministic and requires no API key. It still creates a real
run, persists its events, streams them over HTTP, and renders them through the same UI used
for installed agents. Choose an installed runtime in the UI to run it against one of the
sample workspaces under `examples/sample-projects/`.

From the repository root:

```sh
pnpm playground:web
```

To open the same renderer in Chrome and Electron together:

```sh
pnpm playground
```
