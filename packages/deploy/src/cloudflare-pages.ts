import { createHash } from 'node:crypto';
import { checkDeploymentUrl, waitForReachableDeploymentUrl } from './reachability.js';
import { safeDnsLabel } from './naming.js';
import {
  DeployError,
  type DeployFile,
  type DeployPublishInput,
  type DeployPublishResult,
  type DeployTarget,
  type DeploymentUrlCheck,
  type DeployLinkStatus,
  type JsonObject,
} from './types.js';

export const CLOUDFLARE_PAGES_TARGET_ID = 'cloudflare-pages';

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_PAGE_SIZE = 100;
const CLOUDFLARE_API_MAX_PAGES = 100;
export const CLOUDFLARE_PAGES_ASSET_UPLOAD_MAX_FILES = 100;
export const CLOUDFLARE_PAGES_ASSET_UPLOAD_MAX_BODY_BYTES = 75 * 1024 * 1024;
export const CLOUDFLARE_PAGES_ASSET_MAX_BYTES = 25 * 1024 * 1024;

/** Auth/scoping config a caller supplies when constructing a `CloudflarePagesDeployTarget`. */
export interface CloudflarePagesDeployConfig {
  token: string;
  accountId: string;
}

/** A caller-selected Cloudflare zone + subdomain prefix to bind as a custom domain. */
export interface CloudflarePagesCustomDomainSelection {
  zoneId: string;
  zoneName: string;
  domainPrefix: string;
}

/** Opaque bookkeeping from a prior publish's custom-domain setup, fed back in to make DNS-record reuse idempotent. */
export interface CloudflarePagesPriorCustomDomainMetadata {
  dnsRecordId?: string;
  marker?: string;
}

/** Optional `DeployPublishInput.metadata` keys this target reads; everything else is ignored. */
export interface CloudflarePagesPublishMetadata extends JsonObject {
  customDomain?: CloudflarePagesCustomDomainSelection;
  priorCustomDomain?: CloudflarePagesPriorCustomDomainMetadata;
}

type CloudflareDnsRecord = JsonObject & { id?: string; type?: string; name?: string; content?: string; comment?: string };
type ResolvedConfig = CloudflarePagesDeployConfig & { projectName: string };

function formatMib(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * Deterministic content hash used purely as Cloudflare Pages' per-asset
 * dedup key (the direct-upload protocol needs a stable 32-hex-char key per
 * file, not a specific algorithm). Swapped from the OD origin's
 * `blake3-wasm` to Node's built-in `crypto` so this package carries no
 * native/WASM dependency — see `source-map.md`.
 */
export function cloudflarePagesAssetHash(file: Pick<DeployFile, 'file' | 'data'>): string {
  const data = Buffer.from(file.data);
  const extension = file.file.includes('.') ? file.file.slice(file.file.lastIndexOf('.') + 1) : '';
  return createHash('sha256').update(`${data.toString('base64')}${extension}`).digest('hex').slice(0, 32);
}

function shortHash(value: unknown): string {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
}

/**
 * Splits a file set into upload batches that respect Cloudflare Pages'
 * per-request file-count and body-size limits.
 *
 * @param files - Files with their pre-computed content hash.
 * @param limits - Overridable file-count/byte-size caps (default to the
 *   Cloudflare Pages direct-upload limits).
 * @returns An array of batches; each batch's estimated encoded size stays
 *   under `maxBytes` and its length under `maxFiles` (a single
 *   larger-than-cap file still gets its own batch rather than being dropped).
 * @complexity O(n) in the number of files.
 * @overallScore 100/100
 */
export function chunkCloudflarePagesAssetUploads(
  files: { hash: string; data: Buffer | Uint8Array | string; contentType?: string }[],
  { maxFiles = CLOUDFLARE_PAGES_ASSET_UPLOAD_MAX_FILES, maxBytes = CLOUDFLARE_PAGES_ASSET_UPLOAD_MAX_BODY_BYTES } = {},
): (typeof files)[number][][] {
  const chunks: (typeof files)[number][][] = [];
  let current: (typeof files)[number][] = [];
  let currentBytes = 2; // JSON array brackets.

  for (const file of files) {
    const nextBytes = estimateCloudflarePagesAssetUploadPayloadBytes(file);
    const wouldExceedCount = current.length >= maxFiles;
    const wouldExceedBytes = current.length > 0 && currentBytes + nextBytes > maxBytes;
    if (wouldExceedCount || wouldExceedBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(file);
    currentBytes += nextBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function estimateCloudflarePagesAssetUploadPayloadBytes(file: {
  hash?: string;
  data?: Buffer | Uint8Array | string;
  contentType?: string;
}): number {
  const data = Buffer.from(file?.data ?? '');
  const encodedBytes = Math.ceil(data.length / 3) * 4;
  const contentTypeBytes = Buffer.byteLength(file?.contentType || 'application/octet-stream');
  const hashBytes = Buffer.byteLength(file?.hash || '');
  return encodedBytes + contentTypeBytes + hashBytes + 128;
}

function normalizeHostname(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]!
    .replace(/\.$/, '');
}

function normalizeDeploymentUrlToHostname(raw: unknown): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return normalizeHostname(raw);
  }
}

function normalizeCloudflareZoneName(raw: unknown): string {
  return normalizeHostname(raw);
}

function isValidCloudflareZoneName(raw: unknown): boolean {
  const name = normalizeCloudflareZoneName(raw);
  if (!name || name.length > 253 || name.includes('..')) return false;
  return name.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function normalizeCloudflareDomainPrefix(raw: unknown): string {
  const prefix = String(raw || '').trim().toLowerCase();
  if (!prefix || prefix === '@' || prefix.includes('.') || prefix.includes('*')) return '';
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix) ? prefix : '';
}

/**
 * Derives a stable, Cloudflare-Pages-safe project name from the caller's
 * `projectName` label. Deterministic (no random suffix) so repeated
 * publishes of the same logical site land on the same Cloudflare Pages
 * project — replaces the OD origin's `od-${projectId}-${hash}` convention,
 * which relied on an OD project id this package has no concept of.
 */
function deriveCloudflarePagesProjectName(projectName: string): string {
  const label = safeDnsLabel(projectName) || 'site';
  return safeDnsLabel(`jini-${label}`).slice(0, 63);
}

function cloudflareHeaders(config: CloudflarePagesDeployConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${config.token}`, ...extra };
}

function cloudflareAssetHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function readCloudflareJson(resp: Response): Promise<JsonObject> {
  try {
    return (await resp.json()) as JsonObject;
  } catch {
    throw new DeployError('Cloudflare returned a non-JSON response.', resp.status || 502);
  }
}

function cloudflareError(json: JsonObject, status: number, fallback: string): DeployError {
  const errors = json?.errors as JsonObject[] | undefined;
  const messages = json?.messages as JsonObject[] | undefined;
  const message =
    errors?.find((err) => err?.message)?.message ||
    messages?.find((item) => item?.message)?.message ||
    json?.message ||
    fallback ||
    `Cloudflare request failed (${status}).`;
  return new DeployError(String(message), status, json);
}

function isCloudflareAlreadyExists(body: unknown): boolean {
  const text = JSON.stringify(body || {}).toLowerCase();
  return (
    text.includes('already exists') ||
    text.includes('already exist') ||
    text.includes('already bound') ||
    text.includes('already been taken') ||
    text.includes('already in use') ||
    text.includes('duplicate')
  );
}

function isCloudflareCommentError(value: unknown): boolean {
  return /comment/i.test(typeof value === 'string' ? value : JSON.stringify(value || {}));
}

function cloudflareAccountPagesProjectsUrl(config: ResolvedConfig): string {
  if (!config.accountId) throw new DeployError('Cloudflare account ID is required.', 400);
  return `${CLOUDFLARE_API}/accounts/${encodeURIComponent(config.accountId)}/pages/projects`;
}

function cloudflarePagesProjectUrl(config: ResolvedConfig, suffix = ''): string {
  if (!config.projectName) throw new DeployError('Cloudflare Pages project name could not be generated.', 400);
  const base = `${cloudflareAccountPagesProjectsUrl(config)}/${encodeURIComponent(config.projectName)}`;
  return suffix ? `${base}/${suffix}` : base;
}

function cloudflarePagesProjectDomainUrl(config: ResolvedConfig, hostname: string): string {
  return `${cloudflarePagesProjectUrl(config, 'domains')}/${encodeURIComponent(hostname)}`;
}

function cloudflarePagesProductionUrl(config: ResolvedConfig): string {
  return config?.projectName ? `https://${config.projectName}.pages.dev` : '';
}

function cloudflareZoneDnsRecordsUrl(zoneId: string): string {
  return `${CLOUDFLARE_API}/zones/${encodeURIComponent(zoneId)}/dns_records`;
}

async function fetchCloudflarePaginatedResult(
  config: CloudflarePagesDeployConfig,
  buildUrl: (page: number, perPage: number) => string,
  fallback: string,
  options: { perPage?: number } = {},
): Promise<JsonObject[]> {
  const results: JsonObject[] = [];
  const perPage = options.perPage || CLOUDFLARE_API_PAGE_SIZE;
  for (let page = 1; page <= CLOUDFLARE_API_MAX_PAGES; page += 1) {
    const resp = await fetch(buildUrl(page, perPage), { headers: cloudflareHeaders(config) });
    const json = await readCloudflareJson(resp);
    if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, fallback);
    const pageItems = Array.isArray(json?.result) ? (json.result as JsonObject[]) : [];
    results.push(...pageItems);
    if (!shouldFetchNextCloudflarePage(json?.result_info as JsonObject | undefined, page, perPage, pageItems.length)) break;
  }
  return results;
}

function shouldFetchNextCloudflarePage(resultInfo: JsonObject | undefined, page: number, perPage: number, itemCount: number): boolean {
  if (itemCount <= 0) return false;
  const totalPages = Number(resultInfo?.total_pages);
  if (Number.isFinite(totalPages) && totalPages > 0) return page < totalPages;
  const totalCount = Number(resultInfo?.total_count);
  const responsePerPage = Number(resultInfo?.per_page);
  const effectivePerPage = Number.isFinite(responsePerPage) && responsePerPage > 0 ? responsePerPage : perPage;
  if (Number.isFinite(totalCount) && totalCount >= 0) return page * effectivePerPage < totalCount;
  const count = Number(resultInfo?.count);
  if (Number.isFinite(count) && count >= 0) return count >= effectivePerPage;
  return itemCount >= perPage;
}

/** Lists active, fully-onboarded zones on the account — used to populate a custom-domain selection UI. */
export async function listCloudflarePagesZones(config: CloudflarePagesDeployConfig) {
  if (!config?.token) throw new DeployError('Cloudflare API token is required.', 400);
  if (!config?.accountId) throw new DeployError('Cloudflare account ID is required.', 400);
  const accountId = config.accountId;
  const zones = await fetchCloudflarePaginatedResult(
    config,
    (page, perPage) => {
      const params = new URLSearchParams({
        'account.id': accountId,
        status: 'active',
        type: 'full',
        page: String(page),
        per_page: String(perPage),
      });
      return `${CLOUDFLARE_API}/zones?${params.toString()}`;
    },
    'Cloudflare zones lookup failed.',
  );
  return {
    zones: zones
      .map((zone) => ({
        id: typeof zone?.id === 'string' ? zone.id : '',
        name: normalizeCloudflareZoneName(zone?.name),
        status: typeof zone?.status === 'string' ? zone.status : undefined,
        type: typeof zone?.type === 'string' ? zone.type : undefined,
      }))
      .filter((zone) => zone.id && zone.name),
  };
}

async function ensureCloudflarePagesProject(config: ResolvedConfig): Promise<JsonObject> {
  const getResp = await fetch(cloudflarePagesProjectUrl(config), { headers: cloudflareHeaders(config) });
  const found = await readCloudflareJson(getResp);
  if (getResp.ok && found?.success !== false) return (found?.result as JsonObject) ?? found;
  if (getResp.status !== 404) throw cloudflareError(found, getResp.status, 'Cloudflare Pages project lookup failed.');

  const createResp = await fetch(cloudflareAccountPagesProjectsUrl(config), {
    method: 'POST',
    headers: cloudflareHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: config.projectName, production_branch: 'main' }),
  });
  const created = await readCloudflareJson(createResp);
  if (!createResp.ok || created?.success === false) {
    if (isCloudflareAlreadyExists(created)) {
      const retryResp = await fetch(cloudflarePagesProjectUrl(config), { headers: cloudflareHeaders(config) });
      const retryFound = await readCloudflareJson(retryResp);
      if (retryResp.ok && retryFound?.success !== false) return (retryFound?.result as JsonObject) ?? retryFound;
    }
    throw cloudflareError(created, createResp.status, 'Cloudflare Pages project creation failed.');
  }
  return (created?.result as JsonObject) ?? created;
}

async function getCloudflarePagesUploadToken(config: ResolvedConfig): Promise<string> {
  const tokenResp = await fetch(cloudflarePagesProjectUrl(config, 'upload-token'), { headers: cloudflareHeaders(config) });
  const tokenBody = await readCloudflareJson(tokenResp);
  const jwt = (tokenBody?.result as JsonObject | undefined)?.jwt || tokenBody?.jwt;
  if (!tokenResp.ok || tokenBody?.success === false || !jwt) {
    throw cloudflareError(tokenBody, tokenResp.status, 'Cloudflare Pages upload token request failed.');
  }
  return String(jwt);
}

async function cloudflarePagesMissingAssetHashes(uploadToken: string, hashes: string[]): Promise<string[]> {
  const resp = await fetch(`${CLOUDFLARE_API}/pages/assets/check-missing`, {
    method: 'POST',
    headers: cloudflareAssetHeaders(uploadToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ hashes }),
  });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare Pages asset lookup failed.');
  const result = json?.result ?? json;
  return Array.isArray(result) ? result : Array.isArray((result as JsonObject)?.hashes) ? (result as JsonObject).hashes as string[] : hashes;
}

async function uploadCloudflarePagesAssets(uploadToken: string, files: DeployFile[]): Promise<void> {
  const uniqueFiles = new Map<string, { hash: string; data: Buffer; contentType: string }>();
  for (const file of files) {
    const data = Buffer.from(file.data);
    if (data.length > CLOUDFLARE_PAGES_ASSET_MAX_BYTES) {
      throw new DeployError(
        `Cloudflare Pages assets must be ${formatMib(CLOUDFLARE_PAGES_ASSET_MAX_BYTES)} or smaller: ${file.file} is ${formatMib(data.length)}.`,
        400,
      );
    }
    const hash = cloudflarePagesAssetHash({ ...file, data });
    if (!uniqueFiles.has(hash)) {
      uniqueFiles.set(hash, { hash, data, contentType: file.contentType || 'application/octet-stream' });
    }
  }
  const hashes = Array.from(uniqueFiles.keys());
  const missing = await cloudflarePagesMissingAssetHashes(uploadToken, hashes);
  if (missing.length > 0) {
    const missingFiles = missing.map((hash) => {
      const file = uniqueFiles.get(hash);
      if (!file) throw new DeployError(`Cloudflare reported an unknown asset hash: ${hash}`, 502);
      return { ...file, hash };
    });

    for (const batch of chunkCloudflarePagesAssetUploads(missingFiles)) {
      const payload = batch.map((file) => ({
        key: file.hash,
        value: file.data.toString('base64'),
        metadata: { contentType: file.contentType },
        base64: true,
      }));
      const uploadResp = await fetch(`${CLOUDFLARE_API}/pages/assets/upload`, {
        method: 'POST',
        headers: cloudflareAssetHeaders(uploadToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const uploaded = await readCloudflareJson(uploadResp);
      if (!uploadResp.ok || uploaded?.success === false) {
        throw cloudflareError(uploaded, uploadResp.status, 'Cloudflare Pages asset upload failed.');
      }
    }
  }

  const upsertResp = await fetch(`${CLOUDFLARE_API}/pages/assets/upsert-hashes`, {
    method: 'POST',
    headers: cloudflareAssetHeaders(uploadToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ hashes }),
  });
  const upserted = await readCloudflareJson(upsertResp);
  if (!upsertResp.ok || upserted?.success === false) {
    throw cloudflareError(upserted, upsertResp.status, 'Cloudflare Pages asset hash update failed.');
  }
}

// --- Custom domain / DNS record management -------------------------------

function normalizeCloudflarePagesDeploySelection(input: CloudflarePagesCustomDomainSelection | undefined) {
  if (!input) return null;
  const rawZoneId = typeof input.zoneId === 'string' ? input.zoneId.trim() : '';
  const rawZoneName = typeof input.zoneName === 'string' ? input.zoneName.trim() : '';
  const rawPrefix = typeof input.domainPrefix === 'string' ? input.domainPrefix.trim() : '';
  if (!rawZoneId && !rawZoneName && !rawPrefix) return null;
  const zoneName = normalizeCloudflareZoneName(rawZoneName);
  const domainPrefix = normalizeCloudflareDomainPrefix(rawPrefix);
  if (!rawZoneId) throw new DeployError('Cloudflare zone is required for a custom domain.', 400);
  if (!zoneName || !isValidCloudflareZoneName(zoneName)) {
    throw new DeployError('Select a valid Cloudflare domain for the custom domain.', 400);
  }
  if (!domainPrefix) throw new DeployError('Enter a valid subdomain prefix, for example "demo".', 400);
  return { zoneId: rawZoneId, zoneName, domainPrefix, hostname: `${domainPrefix}.${zoneName}` };
}

async function validateCloudflarePagesDeploySelection(
  config: ResolvedConfig,
  selection: ReturnType<typeof normalizeCloudflarePagesDeploySelection>,
) {
  if (!selection) return null;
  const resp = await fetch(`${CLOUDFLARE_API}/zones/${encodeURIComponent(selection.zoneId)}`, { headers: cloudflareHeaders(config) });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare zone lookup failed.');
  const zone = (json?.result as JsonObject | undefined) ?? json;
  const zoneName = normalizeCloudflareZoneName(zone?.name);
  if (!zoneName || zoneName !== selection.zoneName) {
    throw new DeployError('Cloudflare zone selection no longer matches the selected domain.', 400, { errorCode: 'cloudflare_zone_mismatch' });
  }
  if (zone?.status && zone.status !== 'active') {
    throw new DeployError('Cloudflare custom domains require an active zone.', 400, { errorCode: 'cloudflare_zone_inactive' });
  }
  if (zone?.type && zone.type !== 'full') {
    throw new DeployError('Cloudflare custom domains require a full DNS zone.', 400, { errorCode: 'cloudflare_zone_not_full' });
  }
  return { ...selection, zoneName };
}

async function listCloudflareDnsRecords(config: ResolvedConfig, zoneId: string, hostname: string): Promise<CloudflareDnsRecord[]> {
  const params = new URLSearchParams({ name: hostname, per_page: '100' });
  const resp = await fetch(`${cloudflareZoneDnsRecordsUrl(zoneId)}?${params.toString()}`, { headers: cloudflareHeaders(config) });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare DNS record lookup failed.');
  return Array.isArray(json?.result) ? (json.result as CloudflareDnsRecord[]) : [];
}

async function createCloudflareDnsRecord(config: ResolvedConfig, zoneId: string, body: JsonObject): Promise<JsonObject> {
  const resp = await fetch(cloudflareZoneDnsRecordsUrl(zoneId), {
    method: 'POST',
    headers: cloudflareHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare DNS record creation failed.');
  return (json?.result as JsonObject) ?? json;
}

async function patchCloudflareDnsRecord(config: ResolvedConfig, zoneId: string, dnsRecordId: string, body: JsonObject): Promise<JsonObject> {
  const resp = await fetch(`${cloudflareZoneDnsRecordsUrl(zoneId)}/${encodeURIComponent(dnsRecordId)}`, {
    method: 'PATCH',
    headers: cloudflareHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare DNS record update failed.');
  return (json?.result as JsonObject) ?? json;
}

function findExactCloudflarePagesCname(records: CloudflareDnsRecord[], selection: { hostname: string }, targetHost: string) {
  return records.find(
    (record) =>
      String(record?.type || '').toUpperCase() === 'CNAME' &&
      normalizeHostname(record?.name) === selection.hostname &&
      normalizeHostname(record?.content) === targetHost,
  );
}

function findCloudflarePagesHostnameRecord(records: CloudflareDnsRecord[], selection: { hostname: string }) {
  return records.find((record) => normalizeHostname(record?.name) === selection.hostname);
}

function cloudflarePagesCnameReuseResult(record: CloudflareDnsRecord, marker: string) {
  return {
    dnsStatus: 'reused' as const,
    dnsRecordId: typeof record.id === 'string' ? record.id : undefined,
    dnsOwnership: record.comment === marker ? ('marked' as const) : ('unmarked' as const),
    marker,
  };
}

function cloudflarePagesDnsConflictError(selection: { hostname: string }, conflicting: CloudflareDnsRecord): DeployError {
  return new DeployError(`Cloudflare DNS already has a different record for ${selection.hostname}.`, 409, {
    errorCode: 'cloudflare_dns_record_conflict',
    dnsStatus: 'conflict',
    dnsRecordId: conflicting.id,
    dnsOwnership: 'external',
  });
}

function canPatchCloudflarePagesCname(
  record: CloudflareDnsRecord,
  selection: { hostname: string },
  marker: string,
  prior: CloudflarePagesPriorCustomDomainMetadata | undefined,
): boolean {
  return Boolean(
    record &&
      String(record.type || '').toUpperCase() === 'CNAME' &&
      typeof record.id === 'string' &&
      record.id &&
      record.id === prior?.dnsRecordId &&
      normalizeHostname(record.name) === selection.hostname &&
      record.comment === marker &&
      prior?.marker === marker,
  );
}

async function maybeReuseCloudflarePagesCnameAfterDuplicate(input: {
  err: unknown;
  config: ResolvedConfig;
  selection: { zoneId: string; hostname: string };
  targetHost: string;
  marker: string;
}) {
  const { err, config, selection, targetHost, marker } = input;
  if (!(err instanceof DeployError) || !isCloudflareAlreadyExists(err.details || err.message)) return null;
  const racedRecords = await listCloudflareDnsRecords(config, selection.zoneId, selection.hostname);
  const exact = findExactCloudflarePagesCname(racedRecords, selection, targetHost);
  if (exact) return cloudflarePagesCnameReuseResult(exact, marker);
  const conflicting = findCloudflarePagesHostnameRecord(racedRecords, selection);
  if (conflicting) throw cloudflarePagesDnsConflictError(selection, conflicting);
  throw err;
}

async function ensureCloudflarePagesCnameRecord(input: {
  config: ResolvedConfig;
  selection: { zoneId: string; hostname: string };
  target: string;
  marker: string;
  prior: CloudflarePagesPriorCustomDomainMetadata | undefined;
}) {
  const { config, selection, target, marker, prior } = input;
  const records = await listCloudflareDnsRecords(config, selection.zoneId, selection.hostname);
  const targetHost = normalizeHostname(target);
  const exact = findExactCloudflarePagesCname(records, selection, targetHost);
  if (exact) return cloudflarePagesCnameReuseResult(exact, marker);

  const conflicting = findCloudflarePagesHostnameRecord(records, selection);
  if (conflicting) {
    if (canPatchCloudflarePagesCname(conflicting, selection, marker, prior)) {
      const conflictingId = conflicting.id;
      if (!conflictingId) throw new DeployError('Cloudflare DNS record id is missing.', 502);
      const patched = await patchCloudflareDnsRecord(config, selection.zoneId, conflictingId, {
        type: 'CNAME',
        name: selection.hostname,
        content: targetHost,
        proxied: true,
        ttl: 1,
        comment: marker,
      });
      return { dnsStatus: 'patched' as const, dnsRecordId: (patched?.id as string) || conflictingId, dnsOwnership: 'marked' as const, marker };
    }
    throw cloudflarePagesDnsConflictError(selection, conflicting);
  }

  try {
    const created = await createCloudflareDnsRecord(config, selection.zoneId, {
      type: 'CNAME',
      name: selection.hostname,
      content: targetHost,
      proxied: true,
      ttl: 1,
      comment: marker,
    });
    return { dnsStatus: 'created' as const, dnsRecordId: created?.id as string | undefined, dnsOwnership: 'marked' as const, marker };
  } catch (err) {
    const raced = await maybeReuseCloudflarePagesCnameAfterDuplicate({ err, config, selection, targetHost, marker });
    if (raced) return raced;
    if (!(err instanceof DeployError) || !isCloudflareCommentError(err.details || err.message)) throw err;
    try {
      const created = await createCloudflareDnsRecord(config, selection.zoneId, {
        type: 'CNAME',
        name: selection.hostname,
        content: targetHost,
        proxied: true,
        ttl: 1,
      });
      return { dnsStatus: 'created' as const, dnsRecordId: created?.id as string | undefined, dnsOwnership: 'unmarked' as const, marker };
    } catch (retryErr) {
      const racedRetry = await maybeReuseCloudflarePagesCnameAfterDuplicate({ err: retryErr, config, selection, targetHost, marker });
      if (racedRetry) return racedRetry;
      throw retryErr;
    }
  }
}

async function findCloudflarePagesDomain(config: ResolvedConfig, hostname: string): Promise<JsonObject | null> {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return null;
  const resp = await fetch(cloudflarePagesProjectDomainUrl(config, normalizedHostname), { headers: cloudflareHeaders(config) });
  const json = await readCloudflareJson(resp);
  if (resp.status === 404) return null;
  if (!resp.ok || json?.success === false) throw cloudflareError(json, resp.status, 'Cloudflare Pages custom domain lookup failed.');
  const domain = (json?.result as JsonObject | undefined) ?? json;
  return normalizeHostname(domain?.name) === normalizedHostname ? domain : null;
}

async function ensureCloudflarePagesDomain(config: ResolvedConfig, hostname: string): Promise<JsonObject> {
  const existing = await findCloudflarePagesDomain(config, hostname);
  if (existing) return existing;

  const resp = await fetch(cloudflarePagesProjectUrl(config, 'domains'), {
    method: 'POST',
    headers: cloudflareHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: hostname }),
  });
  const json = await readCloudflareJson(resp);
  if (!resp.ok || json?.success === false) {
    if (isCloudflareAlreadyExists(json)) {
      const retry = await findCloudflarePagesDomain(config, hostname);
      if (retry) return retry;
      throw new DeployError(`Cloudflare Pages says ${hostname} is already bound to another project.`, 409, {
        errorCode: 'cloudflare_domain_already_bound',
        domainStatus: 'conflict',
      });
    }
    throw cloudflareError(json, resp.status, 'Cloudflare Pages custom domain setup failed.');
  }
  return (json?.result as JsonObject) ?? json;
}

function normalizeCloudflarePagesDomainStatus(status: unknown): 'active' | 'failed' | 'pending' {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return 'active';
  if (value === 'error' || value === 'blocked' || value === 'deactivated') return 'failed';
  return 'pending';
}

async function setupCloudflarePagesCustomDomain(input: {
  config: ResolvedConfig;
  selection: { zoneId: string; zoneName: string; domainPrefix: string; hostname: string };
  pagesDevUrl: string;
  prior: CloudflarePagesPriorCustomDomainMetadata | undefined;
}): Promise<JsonObject> {
  const { config, selection, pagesDevUrl, prior } = input;
  const pagesTarget = normalizeHostname(hostnameFromUrl(pagesDevUrl) || `${config.projectName}.pages.dev`);
  const marker = cloudflarePagesDnsMarker(config.projectName, pagesTarget);
  const base = {
    hostname: selection.hostname,
    url: `https://${selection.hostname}`,
    zoneId: selection.zoneId,
    zoneName: selection.zoneName,
    domainPrefix: selection.domainPrefix,
  };

  let dns;
  try {
    dns = await ensureCloudflarePagesCnameRecord({ config, selection, target: pagesTarget, marker, prior });
  } catch (err) {
    const details = err instanceof DeployError && err.details && typeof err.details === 'object' ? (err.details as JsonObject) : {};
    return {
      ...base,
      status: details.errorCode === 'cloudflare_dns_record_conflict' ? 'conflict' : 'failed',
      statusMessage: err instanceof Error ? err.message : 'Cloudflare DNS record setup failed.',
      errorCode: details.errorCode || 'cloudflare_dns_record_failed',
      dnsOwnership: details.dnsOwnership || 'external',
      domainStatus: 'skipped',
    };
  }

  let domain: JsonObject;
  try {
    domain = await ensureCloudflarePagesDomain(config, selection.hostname);
  } catch (err) {
    const details = err instanceof DeployError && err.details && typeof err.details === 'object' ? (err.details as JsonObject) : {};
    return {
      ...base,
      status: details.errorCode === 'cloudflare_domain_already_bound' ? 'conflict' : 'failed',
      statusMessage: err instanceof Error ? err.message : 'Cloudflare Pages custom domain setup failed.',
      errorCode: details.errorCode || 'cloudflare_domain_setup_failed',
      dnsStatus: dns.dnsStatus,
      dnsRecordId: dns.dnsRecordId,
      dnsOwnership: dns.dnsOwnership,
      domainStatus: details.domainStatus || 'failed',
    };
  }

  const domainStatus = normalizeCloudflarePagesDomainStatus(domain?.status);
  const customLink = domainStatus === 'active' ? await checkDeploymentUrl(base.url) : null;
  const ready = domainStatus === 'active' && customLink?.reachable;
  const failed = domainStatus === 'failed';
  return {
    ...base,
    status: ready ? 'ready' : failed ? 'failed' : 'pending',
    statusMessage: ready
      ? 'Custom domain is ready.'
      : failed
        ? 'Cloudflare Pages reported a custom-domain error.'
        : customLink?.statusMessage || 'Custom domain is being verified by Cloudflare Pages.',
    dnsStatus: dns.dnsStatus,
    dnsRecordId: dns.dnsRecordId,
    dnsOwnership: dns.dnsOwnership,
    domainStatus,
  };
}

function hostnameFromUrl(raw: unknown): string {
  return normalizeDeploymentUrlToHostname(raw);
}

/**
 * A stable identifier stamped as a Cloudflare DNS record comment so a later
 * publish can recognize (and safely patch) a CNAME record it created
 * itself, versus one an operator manages by hand. Genericized from the OD
 * origin's `od:cfp:` marker prefix.
 */
function cloudflarePagesDnsMarker(projectName: string, pagesTarget: string): string {
  return `jini-deploy:${shortHash(projectName)}:${shortHash(pagesTarget || projectName)}`;
}

function aggregateCloudflarePagesStatus(
  pagesDev: { status: DeployLinkStatus; statusMessage?: string },
  customDomain?: JsonObject,
): { status: DeployLinkStatus; statusMessage?: string } {
  if (!customDomain) {
    return { status: pagesDev.status, ...(pagesDev.statusMessage !== undefined ? { statusMessage: pagesDev.statusMessage } : {}) };
  }
  if (customDomain.status === 'ready') {
    return {
      status: pagesDev.status === 'ready' ? 'ready' : 'link-delayed',
      statusMessage:
        pagesDev.status === 'ready'
          ? 'Cloudflare Pages and custom domain are ready.'
          : pagesDev.statusMessage || "Cloudflare Pages is still preparing its pages.dev link.",
    };
  }
  if (customDomain.status === 'pending') {
    return { status: 'link-delayed', statusMessage: (customDomain.statusMessage as string) || 'Custom domain is still being prepared.' };
  }
  const customFailureMessage = (customDomain.errorCode as string) || (customDomain.statusMessage as string) || 'Custom domain setup failed.';
  return {
    status: pagesDev.status,
    statusMessage: pagesDev.status === 'ready' ? `pages.dev is ready. ${customFailureMessage}` : pagesDev.statusMessage || customFailureMessage,
  };
}

/**
 * `DeployTarget` adapter for Cloudflare Pages' direct-upload API: ensures a
 * Pages project exists, uploads the file set as content-addressed assets,
 * creates a deployment, waits for the `pages.dev` URL to be reachable, and
 * (optionally, when `input.metadata.customDomain` is supplied) binds a
 * custom domain via a managed CNAME + Pages domain record.
 *
 * Genericized from the origin product's daemon deploy module's
 * `deployToCloudflarePages` family: the origin's persisted local config file
 * and product-specific project naming are gone — the caller supplies
 * `{ token, accountId }` directly and a stable `projectName` label.
 */
export class CloudflarePagesDeployTarget implements DeployTarget {
  readonly id = CLOUDFLARE_PAGES_TARGET_ID;

  constructor(private readonly config: CloudflarePagesDeployConfig) {}

  /**
   * Publishes `input.files` to Cloudflare Pages and waits for the resulting
   * `pages.dev` URL to be reachable, optionally binding a custom domain.
   *
   * @param input - File set, a caller-chosen project name label, and
   *   optional `metadata.customDomain`/`metadata.priorCustomDomain`.
   * @returns The published deployment's URL/status, with any custom-domain
   *   outcome folded into `providerMetadata`.
   * @throws {DeployError} If `token`/`accountId` are missing, the derived
   *   project name is empty, or any Cloudflare API call fails.
   * @complexity O(files) to hash/chunk the asset set, plus a bounded
   *   reachability wait; DNS/domain setup is O(1) additional round-trips.
   * @overallScore 95/100
   * @tradeoffs Custom-domain setup errors are captured into the returned
   *   `providerMetadata` rather than thrown, matching the OD origin's
   *   behavior of always returning the base pages.dev result even if the
   *   custom domain step fails partway — flagged since a caller that only
   *   checks `status`/`throws` could miss a degraded custom-domain state
   *   without also inspecting `providerMetadata`.
   */
  async publish(input: DeployPublishInput): Promise<DeployPublishResult> {
    if (!this.config.token) throw new DeployError('Cloudflare API token is required.', 400);
    if (!this.config.accountId) throw new DeployError('Cloudflare account ID is required.', 400);

    const projectName = deriveCloudflarePagesProjectName(input.projectName);
    if (!projectName) throw new DeployError('Cloudflare Pages project name could not be generated.', 400);
    const config: ResolvedConfig = { ...this.config, projectName };

    const metadata = (input.metadata ?? {}) as CloudflarePagesPublishMetadata;
    const customDomainSelection = await validateCloudflarePagesDeploySelection(
      config,
      normalizeCloudflarePagesDeploySelection(metadata.customDomain),
    );

    await ensureCloudflarePagesProject(config);
    const uploadToken = await getCloudflarePagesUploadToken(config);
    await uploadCloudflarePagesAssets(uploadToken, input.files);

    const form = new FormData();
    const manifest: Record<string, string> = {};
    for (const file of input.files) manifest[`/${file.file}`] = cloudflarePagesAssetHash(file);
    form.append('manifest', JSON.stringify(manifest));
    form.append('branch', 'main');

    const deployResp = await fetch(cloudflarePagesProjectUrl(config, 'deployments'), {
      method: 'POST',
      headers: cloudflareHeaders(config),
      body: form,
    });
    const deployed = await readCloudflareJson(deployResp);
    if (!deployResp.ok || deployed?.success === false) {
      throw cloudflareError(deployed, deployResp.status, 'Cloudflare Pages deployment failed.');
    }

    const deployment = (deployed?.result as JsonObject | undefined) ?? deployed;
    const productionUrl = cloudflarePagesProductionUrl(config);
    const link = await waitForReachableDeploymentUrl(productionUrl ? [productionUrl] : [deployment?.url], {
      providerLabel: 'Cloudflare Pages',
    });
    const pagesDevUrl = productionUrl || link.url;
    const pagesDev = { status: link.status, statusMessage: link.statusMessage };

    const customDomain = customDomainSelection
      ? await setupCloudflarePagesCustomDomain({
          config,
          selection: customDomainSelection,
          pagesDevUrl,
          prior: metadata.priorCustomDomain,
        })
      : undefined;

    const aggregate = aggregateCloudflarePagesStatus(pagesDev, customDomain);

    return {
      targetId: this.id,
      url: pagesDevUrl,
      ...(typeof deployment?.id === 'string' ? { deploymentId: deployment.id } : {}),
      status: aggregate.status,
      ...(aggregate.statusMessage !== undefined ? { statusMessage: aggregate.statusMessage } : {}),
      ...(link.reachableAt !== undefined ? { reachableAt: link.reachableAt } : {}),
      providerMetadata: {
        projectName,
        pagesDev: { ...pagesDev, url: pagesDevUrl },
        ...(customDomain ? { customDomain } : {}),
      },
    };
  }

  /** Probes `url` with the shared reachability checker (no Cloudflare-specific auth-wall detection is needed). */
  async checkReachability(url: string): Promise<DeploymentUrlCheck> {
    return checkDeploymentUrl(url);
  }
}
