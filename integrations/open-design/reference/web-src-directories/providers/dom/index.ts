// Barrel for the dom provider folder. Each domain owns its own file so a new
// slice's DOM bridge gets its own filename instead of risking a silent
// collision with another slice's `dom.ts` (see chat-composer/chat-pane/
// browser-actions history).

export * from './core';
export * from './chat-composer.dom';
export * from './chat-pane.dom';
export * from './browser-actions.dom';
