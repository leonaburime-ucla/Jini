# Jini sample projects

These deliberately small workspaces ship with Jini Playground so a new user can test an
agent without pointing it at personal code.

- `starter-site/` is a working, zero-dependency browser task board for visual and feature
  edits. Open `index.html` directly in a browser.
- `bug-hunt/` is a small JavaScript module with one intentional defect and a failing test.
  Run `npm test` inside that directory, then ask an agent to diagnose and fix it.

The playground daemon only grants runs access to these two directories. They are fixtures,
not dependencies of the Jini engine.
