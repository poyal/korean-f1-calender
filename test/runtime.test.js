'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { event } = require('./helpers');
const copy = value => JSON.parse(JSON.stringify(value));

function runtime() {
  const properties = new Map();
  const h = { source: [event()], target: [], writes: [], rules: [], triggers: [], locked: false, failWriteAt: null, failAfterInsert: false, lists: [], logs: [] };
  const store = { getProperty: key => properties.get(key) || null, setProperty: (key, value) => properties.set(key, value) };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-01-01T00:00:00Z'])); }
    static now() { return Date.parse('2026-01-01T00:00:00Z'); }
  }
  function write(type, resource) {
    if (h.failWriteAt === h.writes.length) throw new Error('Quota exceeded');
    h.writes.push({ type, resource: copy(resource) });
  }
  const context = vm.createContext({
    console: { log: text => h.logs.push(text), error() {} }, Date: FixedDate,
    PropertiesService: { getScriptProperties: () => store },
    LockService: { getScriptLock: () => ({ tryLock: () => !h.locked, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()] },
    Calendar: {
      CalendarList: {
        get: id => ({ id, summary: id === 'source' ? 'F1 Season' : 'F1 한국어', accessRole: id === 'source' ? 'reader' : 'owner', timeZone: 'Asia/Seoul', primary: h.primary }),
        list: () => ({ items: [] })
      },
      Calendars: { insert: resource => { write('calendar', resource); return { id: 'target' }; } },
      Events: {
        list: (id, params) => {
          h.lists.push({ id, params: copy(params) });
          if (h.listImpl) return h.listImpl(id, params);
          return { kind: 'calendar#events', accessRole: id === 'source' ? 'reader' : 'owner',
            items: copy(id === 'source' ? h.source : h.target.filter(e => e.status !== 'cancelled')) };
        },
        insert: (resource, id) => {
          assert.equal(id, 'target');
          if (h.target.some(e => e.id === resource.id)) throw new Error('409 already exists');
          write('create', resource);
          h.target.push(copy(resource));
          if (h.failAfterInsert) { h.failAfterInsert = false; throw new Error('Network timeout after commit'); }
          return copy(resource);
        },
        update: (resource, id, eventId) => {
          assert.equal(id, 'target');
          write('update', resource);
          const index = h.target.findIndex(e => e.id === eventId);
          assert.ok(index >= 0);
          h.target[index] = { ...copy(resource), id: eventId };
          return h.target[index];
        },
        remove: (id, eventId) => {
          assert.equal(id, 'target');
          write('delete', { id: eventId });
          h.target.find(e => e.id === eventId).status = 'cancelled';
        },
        get: (id, eventId) => copy(h.target.find(e => e.id === eventId))
      },
      Acl: {
        list: () => ({ items: copy(h.rules) }),
        insert: resource => { write('acl', resource); h.rules.push({ id: 'default', ...copy(resource) }); },
        update: resource => { write('acl', resource); h.rules = [{ id: 'default', ...copy(resource) }]; }
      }
    },
    ScriptApp: {
      getProjectTriggers: () => h.triggers,
      deleteTrigger: trigger => { h.triggers = h.triggers.filter(t => t !== trigger); },
      newTrigger: handler => ({ timeBased() { return this; }, everyHours(hours) { assert.equal(hours, 1); return this; },
        create() { const t = { getHandlerFunction: () => handler, getUniqueId: () => 'hourly' }; h.triggers.push(t); return t; } })
    }
  });
  for (const file of ['Config.js', 'Core.js', 'Main.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  context.F1_CONFIG.sourceCalendarId = 'source';
  return { context, h, properties, state: () => JSON.parse(properties.get('F1_SYNC_STATE') || '{}') };
}

test('preflight is read only; private setup is idempotent; sync converges without duplicate events', () => {
  const { context: c, h, properties } = runtime();
  const preview = c.previewSync();
  assert.equal(preview.proposed.create, 1);
  assert.equal(properties.size, 0);
  assert.equal(h.writes.length, 0);
  c.setupCalendar();
  c.setupCalendar();
  assert.equal(h.writes.filter(w => w.type === 'calendar').length, 1);
  assert.equal(h.rules.length, 0);
  c.syncNow();
  const again = c.syncNow();
  assert.equal(again.unchanged, 1);
  assert.equal(h.target.length, 1);
  assert.equal(c.previewSync().changes.length, 0);
});

test('partial writes resume from a new full comparison and eventually finish', () => {
  const { context: c, h, state } = runtime();
  h.source.push(event('quali', { summary: 'Japanese GP - Qualifying' }));
  c.F1_CONFIG.maxWritesPerRun = 1;
  c.setupCalendar();
  assert.equal(c.syncNow().remaining, 1);
  assert.equal(state().verifiedRuns, 0);
  assert.equal(c.syncNow().remaining, 0);
  assert.equal(c.syncNow().unchanged, 2);
  assert.equal(h.target.length, 2);
});

test('pagination is fully consumed before any mutation; a late page error preserves targets', () => {
  const { context: c, h } = runtime();
  c.setupCalendar(); c.syncNow();
  const before = h.writes.length;
  h.listImpl = (id, p) => {
    assert.equal(id, 'source');
    if (!p.pageToken) return { kind: 'calendar#events', items: [], nextPageToken: 'second' };
    throw new Error('503 temporary upstream error');
  };
  assert.throws(() => c.syncNow(), /503/);
  assert.equal(h.writes.length, before);
  assert.equal(h.target[0].status, 'confirmed');
});

test('a valid second source page is not mistaken for a missing race', () => {
  const { context: c, h } = runtime();
  c.setupCalendar(); c.syncNow();
  h.listImpl = (id, p) => id === 'target' ? { kind: 'calendar#events', items: copy(h.target) }
    : p.pageToken ? { kind: 'calendar#events', items: copy(h.source) }
      : { kind: 'calendar#events', items: [], nextPageToken: 'second' };
  assert.equal(c.syncNow().unchanged, 1);
});

test('failed reads reset empty confirmation and preview does not advance it', () => {
  const { context: c, h, state } = runtime();
  c.setupCalendar(); c.syncNow();
  h.source = [];
  c.syncNow();
  assert.equal(state().emptyReadCount, 1);
  c.previewSync();
  assert.equal(state().emptyReadCount, 1);
  h.listImpl = () => { throw new Error('403 forbidden'); };
  assert.throws(() => c.syncNow(), /403/);
  assert.equal(state().emptyReadCount, 0);
  h.listImpl = null;
  c.syncNow();
  assert.equal(h.target[0].status, 'confirmed');
  c.syncNow();
  assert.equal(h.target[0].status, 'cancelled');
});

test('an ambiguous insert timeout does not duplicate the committed event on retry', () => {
  const { context: c, h } = runtime();
  c.setupCalendar();
  h.failAfterInsert = true;
  assert.throws(() => c.syncNow(), /timeout/);
  assert.equal(h.target.length, 1);
  assert.equal(c.syncNow().unchanged, 1);
  assert.equal(h.target.length, 1);
});

test('a reinstated cancelled race gets a new deterministic ID and then converges', () => {
  const { context: c, h } = runtime();
  c.setupCalendar(); c.syncNow();
  const originalId = h.target[0].id;
  h.source = [event(undefined, { summary: 'CALLED OFF: Japanese GP 2026 - Race' })];
  c.syncNow();
  assert.equal(h.target[0].status, 'cancelled');
  h.source = [event()];
  c.syncNow(); c.syncNow();
  const active = h.target.filter(e => e.status !== 'cancelled');
  assert.equal(active.length, 1);
  assert.notEqual(active[0].id, originalId);
});

test('unknown response shapes and duplicate source sessions abort without writes', () => {
  const { context: c, h } = runtime();
  c.setupCalendar(); c.syncNow();
  const before = h.writes.length;
  h.listImpl = () => ({ error: 'unavailable' });
  assert.throws(() => c.syncNow(), /불완전/);
  h.listImpl = null;
  h.source.push(event('duplicate'));
  assert.throws(() => c.syncNow(), /중복/);
  assert.equal(h.writes.length, before);
});

test('publishing requires verification, publishes read only and is idempotent', () => {
  const { context: c, h } = runtime();
  c.setupCalendar();
  assert.throws(() => c.publishCalendar(), /두 번/);
  c.syncNow(); c.syncNow();
  const links = c.publishCalendar();
  assert.equal(h.rules[0].role, 'reader');
  assert.equal(h.rules[0].scope.type, 'default');
  assert.ok(links.google.includes('cid=target'));
  c.publishCalendar();
  assert.equal(h.writes.filter(w => w.type === 'acl').length, 1);
});

test('publishing refuses unrelated personal events in the target', () => {
  const { context: c, h } = runtime();
  c.setupCalendar(); c.syncNow(); c.syncNow();
  h.target.push({ ...event('personal'), extendedProperties: {} });
  assert.throws(() => c.publishCalendar(), /개인 일정/);
  assert.equal(h.rules.length, 0);
});

test('hourly install is idempotent; uninstall preserves calendar and other triggers', () => {
  const { context: c, h } = runtime();
  assert.throws(() => c.installHourlyTrigger(), /정상 동기화/);
  c.setupCalendar(); c.syncNow();
  const other = { getHandlerFunction: () => 'somethingElse' };
  h.triggers.push(other);
  c.installHourlyTrigger(); c.installHourlyTrigger();
  assert.equal(h.triggers.length, 2);
  c.uninstallHourlyTrigger();
  assert.deepEqual(h.triggers, [other]);
  assert.equal(h.target.length, 1);
});

test('a concurrent run or a primary calendar cannot mutate events', () => {
  const { context: c, h } = runtime();
  h.locked = true;
  assert.throws(() => c.setupCalendar(), /다른 동기화/);
  h.locked = false;
  h.primary = true;
  assert.throws(() => c.setupCalendar(), /기본 캘린더/);
  assert.equal(h.writes.length, 0);
});

test('time-unknown placeholders update to timed events through the real adapter', () => {
  const { context: c, h } = runtime();
  h.source = [event(undefined, { start: { date: '2026-03-29' }, end: { date: '2026-03-30' } })];
  c.setupCalendar(); c.syncNow();
  const id = h.target[0].id;
  h.source = [event()];
  c.syncNow();
  assert.equal(h.target[0].id, id);
  assert.ok(h.target[0].start.dateTime);
  assert.equal(h.target[0].start.date, undefined);
  assert.equal(h.target[0].reminders.overrides[0].minutes, 60);
});

test('large previews log compact counts, prioritized blockers, and Korean time samples', () => {
  const { context: c, h, properties } = runtime();
  h.source = Array.from({ length: 160 }, (_, i) => event('sample-' + i, {
    summary: 'New Destination ' + i + ' Grand Prix 2027 - Race', location: 'Unmapped Track'
  }));
  h.source.push(event('unclassified', { summary: 'F1 Calendar update' }));
  const result = c.previewSync();
  const summary = JSON.parse(h.logs[0]);
  assert.equal(result.changes.length, 160);
  assert.equal(summary.changes, undefined);
  assert.equal(summary.seasons['2027'], 160);
  assert.equal(summary.warningCounts.UNCLASSIFIED, 1);
  assert.equal(summary.warningCounts.VENUE_TRANSLATION_MISSING, 160);
  assert.equal(summary.warnings[0].code, 'UNCLASSIFIED');
  assert.ok(h.logs.every(line => line.length < 6000));
  assert.ok(h.logs.some(line => line.startsWith('확인 필요: ') && line.includes('F1 Calendar update')));
  assert.ok(h.logs.some(line => line.startsWith('변환 예시: ') && line.includes('2026-03-29 14:00 KST')));
  assert.equal(properties.size, 0);
  assert.equal(h.writes.length, 0);
});
