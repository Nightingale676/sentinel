import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToPaise, formatCompactInr, formatInr } from './inr.ts';
import { ClientPortalError, ClientPortalStore } from './client-portal-service.ts';

test('INR formatting uses Indian digit grouping, rupee sign, and Lakh/Crore compact notation', () => {
  assert.equal(formatInr(125_000_000), '₹12,50,000');
  assert.equal(formatInr(45_050), '₹450.50');
  assert.equal(formatCompactInr(45_000_000), '₹4.5 L');
  assert.equal(formatCompactInr(1_200_000_000), '₹1.2 Cr');
});

test('Foreign currency conversion stores integer INR paise and isolates original currency in audit store only', () => {
  const fixedNow = Date.parse('2026-11-24T12:00:00.000Z');
  const store = new ClientPortalStore(fixedNow);

  const conv = convertToPaise(100, 'USD', { INR: 1, USD: 85.25 });
  assert.equal(Number.isInteger(conv.amountPaise), true);
  assert.equal(conv.amountPaise, 852500);

  const created = store.ingestTransaction({
    organization_id: 'org_aarohan_bank',
    appId: 'app_mobile',
    customerRef: 'ABIN-••••-1040',
    action: 'International Card Settlement',
    amount: 100,
    currency: 'USD',
    status: 'Allowed',
    reason: 'Matched voiceprint and device.',
    riskLevel: 'Low',
    whatHappenedNext: 'Cleared in INR.',
    timestamp: '2026-11-24T11:30:00.000Z',
  });

  // Amount stored as integer paise in INR (100 * 84.5 * 100 = 845000)
  assert.equal(Number.isInteger(created.amountPaise), true);
  assert.equal(created.amountPaise, 845000);

  // Public DTO never exposes original currency
  const fetched = store.getTransactionById('org_aarohan_bank', created.id);
  assert.ok(fetched);
  assert.equal('originalCurrency' in fetched, false);
  assert.equal('auditOriginalCurrency' in fetched, false);

  // Audit record preserves original currency privately on server
  const audit = store.getAuditRecordForInternalCheck(created.id);
  assert.equal(audit?.originalCurrency, 'USD');
  assert.equal(audit?.originalAmount, 100);
});

test('Organization isolation blocks cross-organization reads and writes', () => {
  const store = new ClientPortalStore(Date.parse('2026-11-24T12:00:00.000Z'));

  // Aarohan Bank cannot see Dakshin Co-op Bank transactions or voices
  const aarohanTx = store.listTransactions('org_aarohan_bank', { limit: 50 });
  assert.equal(
    aarohanTx.items.some((t) => t.organization_id !== 'org_aarohan_bank'),
    false
  );
  assert.equal(store.getTransactionById('org_aarohan_bank', 'ctx_dakshin_1'), null);

  const dakshinVoices = store.listVoices('org_dakshin_coop');
  assert.equal(dakshinVoices.totalCount, 1);
  assert.equal(dakshinVoices.items[0].id, 'vc_other_1');

  assert.throws(
    () => store.requestVoiceReenroll('org_aarohan_bank', 'client_admin', 'vc_other_1'),
    (err: unknown) => err instanceof ClientPortalError && err.status === 404
  );

  assert.throws(
    () => store.deleteVoice('org_aarohan_bank', 'client_admin', 'vc_other_1'),
    (err: unknown) => err instanceof ClientPortalError && err.status === 404
  );

  assert.throws(
    () => store.rotateAppKey('org_aarohan_bank', 'client_admin', 'app_dakshin_mobile'),
    (err: unknown) => err instanceof ClientPortalError && err.status === 404
  );
});

test('Role-based access denies writes for client_viewer and permits writes for client_admin', () => {
  const store = new ClientPortalStore(Date.parse('2026-11-24T12:00:00.000Z'));

  const voicesBefore = store.listVoices('org_aarohan_bank');
  assert.equal(voicesBefore.totalCount, 40);
  const targetVoiceId = voicesBefore.items[0].id;

  // Viewer cannot mutate voices or rotate keys
  assert.throws(
    () => store.requestVoiceReenroll('org_aarohan_bank', 'client_viewer', targetVoiceId),
    (err: unknown) => err instanceof ClientPortalError && err.status === 403
  );
  assert.throws(
    () => store.deleteVoice('org_aarohan_bank', 'client_viewer', targetVoiceId),
    (err: unknown) => err instanceof ClientPortalError && err.status === 403
  );
  assert.throws(
    () => store.rotateAppKey('org_aarohan_bank', 'client_viewer', 'app_mobile'),
    (err: unknown) => err instanceof ClientPortalError && err.status === 403
  );

  // Admin can mutate voices and rotate keys once without exposing keys in listApps
  const updatedVoice = store.requestVoiceReenroll('org_aarohan_bank', 'client_admin', targetVoiceId);
  assert.equal(updatedVoice.status, 'Needs re-enrollment');

  const rotated = store.rotateAppKey('org_aarohan_bank', 'client_admin', 'app_mobile');
  assert.ok(rotated.apiKeyOnce.startsWith('snt_live_'));

  const apps = store.listApps('org_aarohan_bank');
  assert.equal(apps.length, 3);
  assert.equal('apiKey' in apps[0], false);
  assert.equal('keyHash' in apps[0], false);

  store.deleteVoice('org_aarohan_bank', 'client_admin', targetVoiceId);
  assert.equal(store.listVoices('org_aarohan_bank').totalCount, 39);
});

test('Transaction filtering supports tabs, search query, date window, and pagination', () => {
  const now = Date.parse('2026-11-24T12:00:00.000Z');
  const store = new ClientPortalStore(now);

  const blocked = store.listTransactions('org_aarohan_bank', { tab: 'blocked', limit: 25 });
  assert.ok(blocked.total > 0);
  assert.equal(blocked.items.every((t) => t.status === 'Blocked'), true);

  const suspicious = store.listTransactions('org_aarohan_bank', { tab: 'suspicious', limit: 25 });
  assert.ok(suspicious.total > 0);
  assert.equal(
    suspicious.items.every(
      (t) =>
        t.status === 'Suspicious' &&
        (t.verificationOutcome === 'Verified' || t.verificationOutcome === 'Not verified')
    ),
    true
  );

  const searched = store.listTransactions('org_aarohan_bank', { q: 'Call Desk', limit: 20 });
  assert.ok(searched.total > 0);
  assert.equal(searched.items.every((t) => t.appName.includes('Call Desk')), true);

  const fromDate = new Date(now - 5 * 86_400_000).toISOString().slice(0, 10);
  const toDate = new Date(now).toISOString().slice(0, 10);
  const ranged = store.listTransactions('org_aarohan_bank', { from: fromDate, to: toDate, limit: 50 });
  assert.ok(ranged.items.length > 0);
  assert.equal(
    ranged.items.every(
      (t) =>
        t.timestamp >= `${fromDate}T00:00:00.000Z` && t.timestamp <= `${toDate}T23:59:59.999Z`
    ),
    true
  );

  const summary7 = store.getSummary('org_aarohan_bank', 7, now);
  const summary90 = store.getSummary('org_aarohan_bank', 90, now);
  assert.equal(summary7.dailySeries.length, 7);
  assert.equal(summary90.dailySeries.length, 90);
  assert.ok(summary90.totalTransactions >= summary7.totalTransactions);
  assert.ok(summary7.latestBlocked.length <= 5);
  assert.ok(summary7.latestSuspicious.length <= 5);
});
