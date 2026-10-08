import type { ICredentialDataDecryptedObject, IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Token-free license lookup by CRM address: only the URL is sent, the token goes to the
// CRM alone. The node calls the CRM at that same URL, so its domain is what counts.
export const LICENSE_CHECK_URL = 'https://perfex-mcp.themesic.com/v1/license';
export const LICENSE_BUY_URL =
	'https://themesic.com/product/rest-api-module-for-perfex-crm-connect-your-perfex-crm-with-third-party-applications/';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const VALID_TTL = 6 * HOUR;
const INVALID_TTL = 10 * MINUTE;
const GRACE_PERIOD = 72 * HOUR;
// Pause between new attempts while the service is down, with and without a grace result.
const RETRY_INTERVAL = MINUTE;
const UNAVAILABLE_TTL = 30 * SECOND;
const REQUEST_TIMEOUT = 20 * SECOND;
const MAX_ENTRIES = 500;

// Definite answers. Every other reply (429, 5xx, network error, anything
// unexpected) means "could not check" and falls back to the grace period.
const DEFINITE_REASONS = ['no_license', 'expired', 'revoked', 'unsupported_domain', 'bad_request'];

type Outcome = { kind: 'valid' } | { kind: 'invalid' | 'unavailable'; message: string; buyUrl: string };

interface CacheEntry {
	valid: boolean;
	message: string;
	buyUrl: string;
	expiresAt: number;
	lastValidAt?: number;
}

export interface LicenseContext {
	getNode: IExecuteFunctions['getNode'];
	helpers: { httpRequest: IExecuteFunctions['helpers']['httpRequest'] };
	logger?: Pick<IExecuteFunctions['logger'], 'warn'>;
}

// Per-process state: each n8n main or worker process keeps its own cache and
// grace period, so a worker that never saw a valid answer has no grace to use.
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

/** Clears all cached results. Used by the tests. */
export function resetLicenseCache(): void {
	cache.clear();
	inFlight.clear();
}

function store(key: string, entry: CacheEntry, now: number): void {
	cache.delete(key);
	if (cache.size >= MAX_ENTRIES) {
		for (const [oldKey, old] of cache) {
			const graceOver = old.lastValidAt === undefined || now - old.lastValidAt >= GRACE_PERIOD;
			if (now >= old.expiresAt && graceOver) cache.delete(oldKey);
		}
	}
	if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
	cache.set(key, entry);
}

// Only an https link on themesic.com (no port, no user info) replaces the built-in one.
function buyLinkFrom(value: unknown): string {
	const host = /^https:\/\/([a-z0-9.-]+)(?:[/?#]|$)/i.exec(String(value))?.[1]?.toLowerCase() ?? '';
	return host === 'themesic.com' || host.endsWith('.themesic.com') ? String(value) : LICENSE_BUY_URL;
}

async function check(ctx: LicenseContext, crmUrl: string): Promise<Outcome> {
	let status = 0;
	let body: IDataObject | undefined;
	try {
		const response = await ctx.helpers.httpRequest({
			method: 'POST',
			url: LICENSE_CHECK_URL,
			body: { crm_url: crmUrl },
			json: true,
			timeout: REQUEST_TIMEOUT,
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
		});
		status = response.statusCode as number;
		const payload: unknown = response.body;
		body = typeof payload === 'object' && payload !== null ? (payload as IDataObject) : undefined;
	} catch {
		// The error text is left out: n8n replaces messages that contain network
		// error codes (ENOTFOUND...) with a generic one, which would hide the rest.
	}
	if (status === 200 && body?.valid === true) return { kind: 'valid' };

	const reason = typeof body?.reason === 'string' ? body.reason : '';
	const text = typeof body?.message === 'string' ? body.message.trim() : '';
	if (body?.valid === false && DEFINITE_REASONS.includes(reason)) {
		const message = text !== '' ? text : `The license check failed (reason: ${reason}).`;
		return { kind: 'invalid', message, buyUrl: buyLinkFrom(body.buy_url) };
	}
	const detail = status === 0 ? 'could not be reached' : `answered with HTTP ${status}`;
	const message = `The license service (perfex-mcp.themesic.com) ${detail}, so the license could not be confirmed. Please try again shortly.`;
	return { kind: 'unavailable', message, buyUrl: LICENSE_BUY_URL };
}

async function refresh(ctx: LicenseContext, key: string): Promise<CacheEntry> {
	const outcome = await check(ctx, key);
	const now = Date.now();
	const lastValidAt = cache.get(key)?.lastValidAt;
	let entry: CacheEntry;
	if (outcome.kind === 'valid') {
		entry = { valid: true, message: '', buyUrl: LICENSE_BUY_URL, expiresAt: now + VALID_TTL, lastValidAt: now };
	} else if (outcome.kind === 'invalid') {
		// A definite answer ends any grace period.
		entry = { valid: false, message: outcome.message, buyUrl: outcome.buyUrl, expiresAt: now + INVALID_TTL };
	} else if (lastValidAt !== undefined && now - lastValidAt < GRACE_PERIOD) {
		ctx.logger?.warn('Perfex CRM license check unavailable, using the last valid result', { crmUrl: key });
		const expiresAt = Math.min(now + RETRY_INTERVAL, lastValidAt + GRACE_PERIOD);
		entry = { valid: true, message: '', buyUrl: LICENSE_BUY_URL, expiresAt, lastValidAt };
	} else {
		ctx.logger?.warn('Perfex CRM license check unavailable and no recent valid result', { crmUrl: key });
		entry = { valid: false, message: outcome.message, buyUrl: outcome.buyUrl, expiresAt: now + UNAVAILABLE_TTL };
	}
	store(key, entry, now);
	return entry;
}

// Throws unless the REST API module license for the credential's CRM address is
// valid. Cached in memory per normalized URL; concurrent calls share one request.
export async function ensureLicensed(
	ctx: LicenseContext,
	credentials: ICredentialDataDecryptedObject,
): Promise<void> {
	const key = String(credentials.url ?? '').trim().toLowerCase().replace(/\/+$/, '');
	let entry = cache.get(key);
	if (entry === undefined || Date.now() >= entry.expiresAt) {
		let pending = inFlight.get(key);
		if (pending === undefined) {
			pending = refresh(ctx, key).finally(() => inFlight.delete(key));
			inFlight.set(key, pending);
		}
		entry = await pending;
	}
	if (entry.valid) return;

	const message = /[.!?]$/.test(entry.message) ? entry.message : `${entry.message}.`;
	throw new NodeOperationError(
		ctx.getNode(),
		`${message} This node requires the REST API for Perfex CRM module with a valid license for your CRM's domain. Get it: ${entry.buyUrl}`,
	);
}
