// Unit tests for the license gate. They run on Node's built-in test runner
// against the compiled output, so they need no extra dependencies: `npm test`
// builds first, then runs this file.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
	ensureLicensed,
	resetLicenseCache,
	LICENSE_CHECK_URL,
	LICENSE_BUY_URL,
} = require('../dist/nodes/PerfexCrm/license.js');
const { PerfexCrmApi } = require('../dist/credentials/PerfexCrmApi.credentials.js');

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const TOKEN = 'secret-token-abc123456';
const CREDENTIALS = { url: 'https://CRM.example.com/', apiToken: TOKEN };
const NODE = {
	id: '1',
	name: 'Perfex CRM',
	type: 'perfexCrm',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const VALID = { statusCode: 200, body: { valid: true } };
const invalid = (reason, extra = {}, statusCode = 200) => ({
	statusCode,
	body: { valid: false, reason, message: `License problem: ${reason}.`, ...extra },
});
const NO_LICENSE = invalid('no_license', { buy_url: 'https://themesic.com/buy' });
const UNAVAILABLE = { statusCode: 503, body: { valid: false, reason: 'unavailable', message: 'Down.' } };

let now;
const realDateNow = Date.now;

// A fake execution context whose httpRequest answers from a queue of replies
// (the last one repeats). An Error in the queue is thrown, like a network failure.
function fakeContext(...replies) {
	const calls = [];
	const warnings = [];
	const ctx = {
		getNode: () => NODE,
		logger: { warn: (...args) => warnings.push(args) },
		helpers: {
			httpRequest: async (options) => {
				calls.push(options);
				const reply = replies.length > 1 ? replies.shift() : replies[0];
				if (reply instanceof Error) throw reply;
				return reply;
			},
		},
	};
	return { ctx, calls, warnings, setReplies: (...next) => replies.splice(0, replies.length, ...next) };
}

beforeEach(() => {
	resetLicenseCache();
	now = Date.UTC(2026, 0, 1);
	Date.now = () => now;
});

afterEach(() => {
	Date.now = realDateNow;
});

test('sends only the normalized CRM URL to the license endpoint, never the token', async () => {
	const { ctx, calls } = fakeContext(VALID);
	await ensureLicensed(ctx, CREDENTIALS);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].method, 'POST');
	assert.equal(calls[0].url, LICENSE_CHECK_URL);
	assert.deepEqual(calls[0].body, { crm_url: 'https://crm.example.com' });
	assert.equal(calls[0].timeout, 20 * SECOND);
	assert.ok(!JSON.stringify(calls[0]).includes(TOKEN));
});

test('caches a valid result for 6 hours, keyed by URL only', async () => {
	const { ctx, calls } = fakeContext(VALID);
	await ensureLicensed(ctx, CREDENTIALS);
	now += 6 * HOUR - 1;
	await ensureLicensed(ctx, { url: 'https://crm.example.com', apiToken: 'another-token' });
	assert.equal(calls.length, 1);
	now += 1;
	await ensureLicensed(ctx, CREDENTIALS);
	assert.equal(calls.length, 2);
});

for (const [reason, reply] of [
	['no_license', NO_LICENSE],
	['expired', invalid('expired')],
	['revoked', invalid('revoked')],
	['unsupported_domain', invalid('unsupported_domain')],
	['bad_request', invalid('bad_request', {}, 400)],
]) {
	test(`${reason} is a definite verdict: throws with the requirement and is cached for 10 minutes`, async () => {
		const { ctx, calls, setReplies } = fakeContext(reply);
		await assert.rejects(ensureLicensed(ctx, CREDENTIALS), (error) => {
			assert.equal(error.name, 'NodeOperationError');
			assert.ok(error.message.startsWith(`License problem: ${reason}. This node requires the REST API`));
			assert.match(error.message, /Get it: https:\/\/themesic\.com\//);
			return true;
		});
		now += 10 * MINUTE - 1;
		await assert.rejects(ensureLicensed(ctx, CREDENTIALS));
		assert.equal(calls.length, 1);
		now += 1;
		setReplies(VALID);
		await ensureLicensed(ctx, CREDENTIALS);
		assert.equal(calls.length, 2);
	});
}

test('uses the buy link from the reply only on https themesic.com hosts', async () => {
	const cases = [
		['https://themesic.com/buy', 'https://themesic.com/buy'],
		['https://shop.themesic.com/x', 'https://shop.themesic.com/x'],
		['https://evil.example/themesic.com', LICENSE_BUY_URL],
		['https://themesic.com.evil.example/', LICENSE_BUY_URL],
		['https://themesic.com@evil.example/', LICENSE_BUY_URL],
		['https://themesic.com:8443/buy', LICENSE_BUY_URL],
		['http://themesic.com/buy', LICENSE_BUY_URL],
		['not a url', LICENSE_BUY_URL],
	];
	for (const [given, expected] of cases) {
		resetLicenseCache();
		const { ctx } = fakeContext(invalid('no_license', { buy_url: given }));
		await assert.rejects(ensureLicensed(ctx, CREDENTIALS), (error) => error.message.endsWith(`Get it: ${expected}`));
	}
});

test('falls back to the reason when the message is missing', async () => {
	const { ctx } = fakeContext({ statusCode: 200, body: { valid: false, reason: 'expired' } });
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS), (error) => {
		assert.match(error.message, /^The license check failed \(reason: expired\)\. This node requires/);
		assert.ok(error.message.endsWith(`Get it: ${LICENSE_BUY_URL}`));
		return true;
	});
});

test('without a previous valid result an outage throws and is retried after 30 seconds', async () => {
	const { ctx, calls, warnings } = fakeContext(UNAVAILABLE);
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS), (error) => {
		assert.match(error.message, /^The license service \(perfex-mcp\.themesic\.com\) answered with HTTP 503/);
		assert.match(error.message, /This node requires .* Get it: /);
		return true;
	});
	now += 30 * SECOND - 1;
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS));
	assert.equal(calls.length, 1);
	now += 1;
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS));
	assert.equal(calls.length, 2);
	assert.ok(warnings.length > 0);
	assert.ok(!JSON.stringify(warnings).includes(TOKEN));
});

test('a network error keeps the full explanation', async () => {
	const { ctx } = fakeContext(new Error('getaddrinfo ENOTFOUND perfex-mcp.themesic.com'));
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS), (error) => {
		assert.match(error.message, /^The license service \(perfex-mcp\.themesic\.com\) could not be reached.* Get it: /);
		return true;
	});
});

for (const [label, failure] of [
	['HTTP 503', UNAVAILABLE],
	['HTTP 429', { statusCode: 429, body: { valid: false, reason: 'rate_limited', message: 'Slow down.' } }],
	['a network error', new Error('ECONNRESET')],
	['a non-JSON reply', { statusCode: 502, body: '<html>Bad gateway</html>' }],
	['an unknown reason', { statusCode: 200, body: { valid: false, reason: 'something_new' } }],
	['a 404 from an older gateway', { statusCode: 404, body: 'Not found' }],
]) {
	test(`uses the last valid result for up to 72 hours on ${label}`, async () => {
		const { ctx, calls, setReplies, warnings } = fakeContext(VALID);
		await ensureLicensed(ctx, CREDENTIALS);
		setReplies(failure);
		now += 71 * HOUR;
		await ensureLicensed(ctx, CREDENTIALS);
		assert.equal(calls.length, 2);
		assert.equal(warnings.length, 1);
		// The grace result is reused for a minute before the service is asked again.
		now += 30 * SECOND;
		await ensureLicensed(ctx, CREDENTIALS);
		assert.equal(calls.length, 2);
		now += 1 * HOUR;
		await assert.rejects(ensureLicensed(ctx, CREDENTIALS), /This node requires/);
	});
}

test('a definite invalid answer ends the grace period', async () => {
	const { ctx, setReplies } = fakeContext(VALID);
	await ensureLicensed(ctx, CREDENTIALS);
	now += 7 * HOUR;
	setReplies(NO_LICENSE);
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS));
	now += 11 * MINUTE;
	setReplies(UNAVAILABLE);
	await assert.rejects(ensureLicensed(ctx, CREDENTIALS), /answered with HTTP 503/);
});

test('concurrent calls share one request', async () => {
	let release;
	const gate = new Promise((resolve) => (release = resolve));
	const calls = [];
	const ctx = {
		getNode: () => NODE,
		helpers: {
			httpRequest: async (options) => {
				calls.push(options);
				await gate;
				return VALID;
			},
		},
	};
	const pending = [1, 2, 3, 4, 5].map(() => ensureLicensed(ctx, CREDENTIALS));
	release();
	await Promise.all(pending);
	assert.equal(calls.length, 1);
});

test('keeps separate results per CRM URL and caps the cache at 500 entries', async () => {
	const { ctx, calls } = fakeContext(VALID);
	for (let i = 0; i <= 500; i++) {
		await ensureLicensed(ctx, { url: `https://crm${i}.example.com`, apiToken: TOKEN });
	}
	assert.equal(calls.length, 501);
	// The newest entry is still cached; the oldest was evicted to stay under the cap.
	await ensureLicensed(ctx, { url: 'https://crm500.example.com', apiToken: TOKEN });
	assert.equal(calls.length, 501);
	await ensureLicensed(ctx, { url: 'https://crm0.example.com', apiToken: TOKEN });
	assert.equal(calls.length, 502);
});

test('expired entries are pruned before live ones are evicted', async () => {
	const { ctx, calls, setReplies } = fakeContext(invalid('no_license'));
	await assert.rejects(ensureLicensed(ctx, { url: 'https://stale.example.com' }));
	setReplies(VALID);
	for (let i = 0; i < 499; i++) {
		await ensureLicensed(ctx, { url: `https://crm${i}.example.com` });
	}
	now += 11 * MINUTE; // the invalid entry expires; valid ones stay fresh
	await ensureLicensed(ctx, { url: 'https://new.example.com' });
	const before = calls.length;
	await ensureLicensed(ctx, { url: 'https://crm0.example.com' });
	assert.equal(calls.length, before);
});

test('the credential test still checks the token against the CRM itself', () => {
	const { request, rules } = new PerfexCrmApi().test;
	assert.equal(request.url, '/api/zapier/poll/customers');
	assert.match(request.baseURL, /\$credentials\.url/);
	assert.equal(rules, undefined);
});
