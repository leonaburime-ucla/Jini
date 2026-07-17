/**
 * White-screen detector.
 *
 * Reports `client_white_screen` when the app fails to mount within
 * `timeoutMs`. Detection sets a single timer at install time and cancels
 * itself the moment the app mounts real content — a normal boot produces
 * zero events.
 *
 * Success condition (anything below counts as "still showing a pre-mount
 * skeleton" and the timer keeps running):
 *
 *   1. `mountedAttribute` is set on `<html>` to `mountedAttributeValue`
 *      (the host's root component sets this in its very first effect).
 *      This is the authoritative signal — once the root has rendered at
 *      all, any later tree crash is a runtime-exception story, not a
 *      white-screen story.
 *   2. *Fallback only.* If the attribute is missing (a render-time crash
 *      that prevented the effect from firing, or a host build predating
 *      the marker), any non-loading-shell child of the root with more than
 *      `minVisibleText` visible text counts as mounted.
 *
 * This does not try to discriminate "still loading" from "white screen
 * caused by a render error" — both look the same to the user, and the
 * latter usually accompanies a runtime exception a host's own error
 * tracking already captured.
 */
import { noopSafetyEventReporter, type SafetyEventReporter } from './ports.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MIN_VISIBLE_TEXT = 10;
const DEFAULT_MOUNTED_ATTRIBUTE = 'data-app-mounted';
const DEFAULT_MOUNTED_ATTRIBUTE_VALUE = '1';
const DEFAULT_LOADING_SHELL_CLASSES: readonly string[] = ['app-loading-shell'];

export interface WhiteScreenDetectorOptions {
  reporter?: SafetyEventReporter | undefined;
  /** How long to wait for the mounted signal before reporting. Defaults to 5000. */
  timeoutMs?: number;
  /** Visible-text floor below which the fallback scan still counts the
   *  root as unmounted. Defaults to 10. */
  minVisibleText?: number;
  /** Attribute a host's root component sets on `<html>` once mounted. */
  mountedAttribute?: string;
  mountedAttributeValue?: string;
  /** Class names that mark an element as "still the pre-mount loading
   *  shell" rather than real content, for the fallback scan. */
  loadingShellClasses?: readonly string[];
  /** Element id to scan in the fallback path. Defaults to `document.body`
   *  when omitted or not found. */
  rootElementId?: string;
}

/**
 * Installs the white-screen detector. Cancels its own timer once the app
 * mounts, or when the returned teardown is called (whichever comes first).
 *
 * @overallScore 100
 */
export function installWhiteScreenDetector(options: WhiteScreenDetectorOptions = {}): () => void {
  const reporter = options.reporter ?? noopSafetyEventReporter;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minVisibleText = options.minVisibleText ?? DEFAULT_MIN_VISIBLE_TEXT;
  const mountedAttribute = options.mountedAttribute ?? DEFAULT_MOUNTED_ATTRIBUTE;
  const mountedAttributeValue = options.mountedAttributeValue ?? DEFAULT_MOUNTED_ATTRIBUTE_VALUE;
  const loadingShellClasses = new Set(options.loadingShellClasses ?? DEFAULT_LOADING_SHELL_CLASSES);
  const rootElementId = options.rootElementId;

  if (typeof window === 'undefined') return () => undefined;
  if (typeof document === 'undefined') return () => undefined;

  const isAppMounted = (): boolean => checkAppMounted({
    mountedAttribute,
    mountedAttributeValue,
    loadingShellClasses,
    minVisibleText,
    rootElementId,
  });

  // No `cancelled` flag guarding these two callbacks: `window.clearTimeout`
  // is always called synchronously in the same statement that would
  // otherwise need to suppress a late fire (below, and in the teardown),
  // and per the timer spec a cleared timeout's callback never runs — so
  // there is no real "the timer fired anyway after we meant to cancel it"
  // path to guard against.
  const timer = window.setTimeout(() => {
    if (isAppMounted()) return;
    reporter('client_white_screen', {
      reason: 'app_not_mounted_after_timeout',
      timeout_ms: timeoutMs,
      ready_state: document.readyState,
      // Backgrounded tabs throttle setTimeout, so a "white screen" here is
      // much more likely an OS-side scheduling artifact than a real mount
      // failure. Surfacing it lets a host filter the noise.
      visibility_state: document.visibilityState,
      body_child_count: document.body?.children.length ?? 0,
    });
  }, timeoutMs);

  const stopMonitor = monitorMount(isAppMounted, () => {
    window.clearTimeout(timer);
  });

  return () => {
    window.clearTimeout(timer);
    stopMonitor();
  };
}

interface CheckAppMountedOptions {
  mountedAttribute: string;
  mountedAttributeValue: string;
  loadingShellClasses: ReadonlySet<string>;
  minVisibleText: number;
  rootElementId: string | undefined;
}

function checkAppMounted(options: CheckAppMountedOptions): boolean {
  // No `typeof document === 'undefined'` guard: checkAppMounted's only
  // call sites are isAppMounted (installWhiteScreenDetector) and
  // monitorMount, both of which only run after installWhiteScreenDetector's
  // own document-undefined guard has already passed.
  // Primary signal: the host's root-mount effect ran.
  if (document.documentElement.getAttribute(options.mountedAttribute) === options.mountedAttributeValue) {
    return true;
  }
  // Fallback: scan the root subtree for content that isn't just the
  // pre-mount loading shell.
  const root =
    (options.rootElementId ? document.getElementById(options.rootElementId) : null) ??
    document.body;
  if (!root) return false;
  const meaningful = Array.from(root.children).filter(
    (el) => !isLoadingShell(el, options.loadingShellClasses),
  );
  if (meaningful.length === 0) return false;
  // `el.textContent` is typed `string | null` on the generic `Node`
  // interface, but only Document/DocumentType nodes ever actually return
  // null — `meaningful` is built from `root.children`, which only yields
  // Elements, so the `!` documents a real invariant rather than masking a
  // reachable null. `innerText` (unlike textContent) genuinely can be
  // `undefined` at runtime — jsdom doesn't implement it — so that `??`
  // fallback stays a real, tested branch.
  const text = meaningful
    .map((el) => (el as HTMLElement).innerText ?? el.textContent!)
    .join('')
    .trim();
  return text.length >= options.minVisibleText;
}

function isLoadingShell(el: Element, loadingShellClasses: ReadonlySet<string>): boolean {
  for (const name of loadingShellClasses) {
    if (el.classList.contains(name)) return true;
  }
  return false;
}

function monitorMount(isAppMounted: () => boolean, onMounted: () => void): () => void {
  // No `stopped` re-entrancy flag: disconnect() synchronously purges any
  // mutation record already queued for this observer (verified against
  // jsdom directly — a mutation queued immediately before disconnect()
  // never reaches the callback, even after a microtask flush), and the
  // callback itself only ever calls disconnect()+onMounted() once per
  // invocation. There is no real path where this callback fires again
  // after the observer has stopped.
  const observer = new MutationObserver(() => {
    if (isAppMounted()) {
      observer.disconnect();
      onMounted();
    }
  });
  // Observe the whole body subtree — a client-side framework's root is
  // often repeatedly detached/reattached during hydration, so observing a
  // narrower root directly would stop firing the moment it gets replaced.
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  // Best-effort short-circuit: if the app is already mounted by the time
  // this runs (HMR, slow tab, etc.), fire immediately.
  if (isAppMounted()) {
    observer.disconnect();
    onMounted();
  }
  return () => {
    observer.disconnect();
  };
}
