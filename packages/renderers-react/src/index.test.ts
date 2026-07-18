import { describe, expect, it } from 'vitest';
import * as barrel from './index.js';
import * as registry from './registry.js';
import * as renderers from './renderers/index.js';
import * as urlLoadDecision from './url-load-decision.js';
import * as srcdoc from './srcdoc/index.js';
import * as i18n from './react/i18n.js';
import * as srcDocSandbox from './react/components/SrcDocSandbox.js';
import * as artifactView from './react/components/ArtifactView.js';
import * as annotationCanvas from './annotation-canvas/index.js';

// Guards against a module being fully built and tested but never re-exported
// from the package's public barrel (see packages/ui/src/index.test.ts for
// the precedent this mirrors).
const modules: Record<string, object> = {
  registry,
  'renderers/index': renderers,
  'url-load-decision': urlLoadDecision,
  'srcdoc/index': srcdoc,
  'react/i18n': i18n,
  'react/components/SrcDocSandbox': srcDocSandbox,
  'react/components/ArtifactView': artifactView,
  'annotation-canvas/index': annotationCanvas,
};

describe('package barrel (src/index.ts)', () => {
  it('checks a non-empty set of tracked modules (sanity check on the map above)', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  it('re-exports every value export from every tracked module', () => {
    const missing: string[] = [];
    for (const [path, mod] of Object.entries(modules)) {
      for (const exportName of Object.keys(mod)) {
        if (!(exportName in barrel)) missing.push(`${exportName} (from ${path})`);
      }
    }
    expect(missing, 'exports present in a module but missing from the package barrel').toEqual([]);
  });
});
