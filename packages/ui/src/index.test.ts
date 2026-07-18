import { describe, expect, it } from 'vitest';
import * as barrel from './index.js';
import * as i18n from './features/i18n/index.js';
import * as observability from './features/observability/index.js';
import * as connectors from './features/connectors/index.js';
import * as browserChrome from './features/browser-chrome/index.js';
import * as sketchEditor from './features/sketch-editor/index.js';
import * as assetGrid from './features/asset-grid/index.js';
import * as viewerShell from './features/viewer-shell/index.js';
import * as versionManager from './features/version-manager/index.js';
import * as htmlViewer from './features/html-viewer/index.js';
import * as settingsDialog from './features/settings-dialog/index.js';
import * as settingsAppearance from './features/settings-dialog/tabs/appearance/index.js';
import * as settingsNotifications from './features/settings-dialog/tabs/notifications/index.js';
import * as settingsLanguage from './features/settings-dialog/tabs/language/index.js';
import * as settingsInstructions from './features/settings-dialog/tabs/instructions/index.js';
import * as settingsPrivacy from './features/settings-dialog/tabs/privacy/index.js';
import * as settingsIntegrations from './features/settings-dialog/tabs/integrations/index.js';

// Guards against the exact bug found while merging browser-chrome and
// viewer-shell: both features were fully built, individually tested, and
// 100%-coverage-verified, but their own `export * from './features/<x>/
// index.js'` line was never added to this package's public barrel — every
// internal test imported the feature directly, so nothing ever noticed the
// outside world couldn't reach it. New feature ships → add its index module
// to this map too, or this test can't check it.
const featureModules: Record<string, object> = {
  'features/i18n': i18n,
  'features/observability': observability,
  'features/connectors': connectors,
  'features/browser-chrome': browserChrome,
  'features/sketch-editor': sketchEditor,
  'features/asset-grid': assetGrid,
  'features/viewer-shell': viewerShell,
  'features/version-manager': versionManager,
  'features/html-viewer': htmlViewer,
  'features/settings-dialog': settingsDialog,
  'features/settings-dialog/tabs/appearance': settingsAppearance,
  'features/settings-dialog/tabs/notifications': settingsNotifications,
  'features/settings-dialog/tabs/language': settingsLanguage,
  'features/settings-dialog/tabs/instructions': settingsInstructions,
  'features/settings-dialog/tabs/privacy': settingsPrivacy,
  'features/settings-dialog/tabs/integrations': settingsIntegrations,
};

describe('package barrel (src/index.ts)', () => {
  it('checks a non-empty set of feature modules (sanity check on the map above)', () => {
    expect(Object.keys(featureModules).length).toBeGreaterThan(0);
  });

  it('re-exports every value export from every tracked features/**/index.ts', () => {
    const missing: string[] = [];
    for (const [path, mod] of Object.entries(featureModules)) {
      for (const exportName of Object.keys(mod)) {
        if (!(exportName in barrel)) {
          missing.push(`${exportName} (from ${path})`);
        }
      }
    }
    expect(missing, 'exports present in a feature module but missing from the package barrel').toEqual([]);
  });
});
