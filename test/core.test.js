'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, options, event, target, reconcile, core } = require('./helpers');

test('standard and sprint weekends use all seven codes without confusing sprint qualifying', () => {
  const labels = ['Practice 1', 'Free Practice 2', 'FP3', 'Qualifying', 'Sprint', 'Sprint Qualifying', 'Race'];
  assert.deepEqual(labels.map(s => core.sessionOf('Japanese Grand Prix - ' + s)), ['P1', 'P2', 'P3', 'Q', 'S', 'SQ', 'G']);
  assert.equal(core.sessionOf('Japanese GP - Sprint Shootout'), 'SQ');
  const result = core.normalize(labels.map((s, i) => event(String(i), { summary: 'Japanese Grand Prix - ' + s })), options);
  assert.equal(result.desired.length, 7);
});

test('removes sponsor descriptions and uses one official link and a 60-minute alert', () => {
  const input = event('jp', { summary: 'FORMULA 1 ARAMCO JAPANESE GRAND PRIX 2026 - Race',
    description: 'Ads! <a href="https://www.formula1.com/en/racing/2026/japan">Details</a> https://ads.example' });
  const out = core.normalize([input], options).desired[0].resource;
  assert.equal(out.summary, '[G] 일본 GP');
  assert.equal(out.location, '일본 · 스즈카 서킷');
  assert.equal(out.description, 'https://www.formula1.com/en/racing/2026/japan');
  assert.deepEqual(out.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] });
  assert.equal(out.start.timeZone, 'Asia/Seoul');
  assert.equal(Date.parse(out.start.dateTime), Date.parse(input.start.dateTime));
});

test('Korean date rollover and foreign DST offsets preserve the original instant', () => {
  for (const [time, expectedDate] of [
    ['2026-07-05T17:00:00+01:00', '2026-07-06'],
    ['2026-11-21T20:00:00-08:00', '2026-11-22']
  ]) {
    const end = new Date(Date.parse(time) + 7200000).toISOString();
    const out = core.normalize([event('race', { start: { dateTime: time }, end: { dateTime: end } })], options).desired[0].resource;
    assert.equal(core.dateInZone(out.start.dateTime, 'Asia/Seoul'), expectedDate);
    assert.equal(Date.parse(out.start.dateTime), Date.parse(time));
  }
});

test('disambiguates races in the same country and recognizes accented titles', () => {
  const titles = ['Miami', 'United States', 'Las Vegas', 'Barcelona-Catalunya', 'Spanish', 'Gran Premio de México'];
  const expected = ['마이애미', '미국', '라스베이거스', '바르셀로나 카탈루냐', '스페인', '멕시코'];
  titles.forEach((s, i) => assert.equal(core.normalize([event('id', { summary: s + ' Grand Prix - Race' })], options).desired[0].resource.summary, '[G] ' + expected[i] + ' GP'));
});

test('a relocated race uses the actual venue, not the usual country venue', () => {
  const out = core.normalize([event('id', { summary: 'Bahrain Grand Prix - Race', location: 'Sepang International Circuit, Malaysia' })], options).desired[0].resource;
  assert.equal(out.summary, '[G] 바레인 GP');
  assert.equal(out.location, '말레이시아 · 세팡 인터내셔널 서킷');
});

test('country-only locations from the real ECAL preview resolve using the named GP', () => {
  // Titles and locations supplied by the user; timestamps below are synthetic.
  const samples = [
    ['🏎 FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2027 - Practice 2 (TBC)', 'Azerbaijan', '[P2] ⏳ 아제르바이잔 GP', '바쿠 시티 서킷'],
    ['🏎 FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2027 - Practice 3 (TBC)', 'Mexico', '[P3] ⏳ 멕시코 GP', '에르마노스 로드리게스 서킷'],
    ['🏁 FORMULA 1 MSC CRUISES UNITED STATES GRAND PRIX 2026 - Race', 'United States', '[G] 미국 GP', '서킷 오브 디 아메리카스'],
    ['🏁 FORMULA 1 HEINEKEN LAS VEGAS GRAND PRIX 2026 - Race', 'United States', '[G] 라스베이거스 GP', '라스베이거스 스트립 서킷'],
    ['🏎 FORMULA 1 TAG HEUER GRAN PREMIO DE ESPAÑA 2026 - Practice 1', 'Spain', '[P1] 스페인 GP', '마드링'],
    ['🏎 FORMULA 1 MSC CRUISES GRANDE PRÊMIO DE SÃO PAULO 2026 - Practice 1', 'Brazil', '[P1] 브라질 GP', '인터라고스 서킷'],
    ['🏎 FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2026 - Practice 2', 'Qatar', '[P2] 카타르 GP', '루사일 인터내셔널 서킷'],
    ['🏎 FORMULA 1 GULF AIR BAHRAIN GRAND PRIX IN MALAYSIA 2026 - Practice 1', 'Malaysia', '[P1] 바레인 GP', '세팡 인터내셔널 서킷'],
    ['🏎 FORMULA 1 ETIHAD AIRWAYS ABU DHABI GRAND PRIX 2026 - Practice 1', 'United Arab Emirates', '[P1] 아부다비 GP', '야스 마리나 서킷'],
    ['⏱️ FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Sprint Qualification', 'Singapore', '[SQ] 싱가포르 GP', '마리나 베이 스트리트 서킷'],
    ['🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Sprint Race', 'Singapore', '[S] 싱가포르 GP', '마리나 베이 스트리트 서킷']
  ];
  for (const [summary, location, title, circuit] of samples) {
    const result = core.normalize([event('real-title', { summary, location })], options);
    assert.equal(result.desired[0].resource.summary, title);
    const countries = { Azerbaijan: '아제르바이잔', Mexico: '멕시코', 'United States': '미국', Spain: '스페인',
      Brazil: '브라질', Qatar: '카타르', Malaysia: '말레이시아', 'United Arab Emirates': '아랍에미리트', Singapore: '싱가포르' };
    assert.equal(result.desired[0].resource.location, countries[location] + ' · ' + circuit);
    assert.deepEqual(result.warnings, []);
    if (summary.includes('(TBC)')) assert.deepEqual(result.desired[0].resource.reminders.overrides, []);
  }
});

test('a country cannot guess an unknown race venue and relocation overrides are season-bound', () => {
  for (const [summary, country] of [['Pacific Grand Prix 2028 - Race', 'Japan'], ['Bahrain Grand Prix 2028 - Race', 'Malaysia']]) {
    const result = core.normalize([event('unknown-venue', { summary, location: country })], options);
    assert.ok(!result.desired[0].resource.location.includes('서킷'));
    assert.ok(result.warnings.some(w => w.code === 'VENUE_UNCONFIRMED'));
  }
});

test('Hangul cancellation and time-unknown markers survive normalization', () => {
  assert.equal(core.fold('취소'), '취소');
  assert.equal(reconcile([event(undefined, { summary: '취소: Japanese GP 2026 - Race' })], [target()]).actions[0].type, 'delete');
  const result = core.normalize([event('unknown-time', { summary: 'Japanese GP 2026 - Race 시간 미정' })], options);
  assert.ok(result.desired[0].resource.start.date);
  assert.deepEqual(result.desired[0].resource.reminders.overrides, []);
});

test('unknown races and venues appear in English and are reported', () => {
  const out = core.normalize([event('new', { summary: 'FORMULA 1 NEW ZEALAND GRAND PRIX 2028 - Qualifying', location: 'New Track' })], options);
  assert.equal(out.desired[0].resource.summary, '[Q] NEW ZEALAND GP');
  assert.equal(out.desired[0].resource.location, 'New Track');
  assert.deepEqual(out.warnings.map(w => w.code), ['RACE_TRANSLATION_MISSING', 'VENUE_TRANSLATION_MISSING']);
});

test('all-day/TBD entries have no alarm and can become timed without duplication', () => {
  const input = event('tbd', { summary: 'Japanese GP - Race TBC', start: { date: '2027-03-28' }, end: { date: '2027-03-29' } });
  const out = core.normalize([input], options).desired[0].resource;
  assert.equal(out.summary, '[G] ⏳ 일본 GP');
  assert.deepEqual(out.start, { date: '2027-03-28' });
  assert.deepEqual(out.reminders.overrides, []);
  const timed = event('tbd', { summary: 'Japanese GP - Race', start: { dateTime: '2027-03-28T05:00:00Z' }, end: { dateTime: '2027-03-28T07:00:00Z' } });
  const plan = reconcile([timed], [target(input)]);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'update');
  assert.equal(plan.actions[0].id, target(input).id);
  assert.equal(plan.actions[0].resource.summary, '[G] 일본 GP');
  assert.ok(plan.actions[0].resource.start.dateTime);
  assert.equal(plan.actions[0].resource.start.date, undefined);
});

test('a new named GP at an existing circuit keeps its own name', () => {
  const out = core.normalize([event('new', { summary: 'Pacific Grand Prix 2028 - Race', location: 'Suzuka Circuit' })], options);
  assert.equal(out.desired[0].resource.summary, '[G] Pacific GP');
  assert.equal(out.desired[0].resource.location, '일본 · 스즈카 서킷');
});

test('missing date is held; missing end time becomes an all-day placeholder', () => {
  const old = target();
  const missing = reconcile([event(undefined, { start: {}, end: {} })], [old]);
  assert.equal(missing.actions.length, 0);
  assert.equal(missing.warnings[0].code, 'DATE_MISSING');
  const out = core.normalize([event('endless', { end: {} })], options);
  assert.deepEqual(out.desired[0].resource.start, { date: '2026-03-29' });
  assert.deepEqual(out.desired[0].resource.reminders.overrides, []);
});

test('future seasons are processed without changing config, old seasons are excluded', () => {
  const inputs = [2025, 2026, 2027, 2028].map(y => event('japan-' + y, {
    summary: 'Japanese Grand Prix ' + y + ' - Race', start: { date: y + '-03-28' }, end: { date: y + '-03-29' }
  }));
  assert.deepEqual(core.normalize(inputs, options).desired.map(e => core.tags(e.resource).f1Season), ['2026', '2027', '2028']);
});

test('repeated sync is a no-op and schedule changes update the existing event', () => {
  assert.deepEqual(reconcile([event()], [target()]).actions, []);
  const changed = event(undefined, { start: { dateTime: '2026-03-29T06:00:00Z' }, end: { dateTime: '2026-03-29T08:00:00Z' } });
  const plan = reconcile([changed], [target()]);
  assert.equal(plan.actions[0].type, 'update');
  assert.equal(plan.actions[0].id, target().id);
});

test('upstream UID replacement adopts a unique season/race/session match', () => {
  const plan = reconcile([event('new-id')], [target()]);
  assert.deepEqual(plan.actions.map(a => a.type), ['update']);
  assert.equal(plan.actions[0].id, target().id);
});

test('source calendar replacement adopts matching events without deleting unrelated history', () => {
  const next = { ...options, namespace: hash('new-source') };
  const snapshot = core.normalize([event('new-id')], next);
  const plan = core.reconcile(snapshot, [target()], { namespace: next.namespace, now: new Date('2026-01-01'), timeZone: 'Asia/Seoul', emptyReadCount: 0 });
  assert.deepEqual(plan.actions.map(a => a.type), ['update']);
  assert.equal(core.tags(plan.actions[0].resource).f1Source, next.namespace);
});

test('explicit session cancellation deletes even a past event; normal history pruning does not', () => {
  const cancelled = event(undefined, { summary: 'CALLED OFF: Japanese Grand Prix 2026 - Race' });
  const past = { now: new Date('2026-12-31') };
  assert.equal(reconcile([cancelled], [target()], past).actions[0].type, 'delete');
  assert.equal(reconcile([{ ...cancelled, status: 'cancelled' }], [target()], past).actions[0].type, 'delete');
  assert.equal(reconcile([], [target()], { ...past, emptyReadCount: 2 }).actions.length, 0);
  assert.equal(reconcile([{ id: event().id, status: 'cancelled' }], [target()], { ...past, emptyReadCount: 2 }).actions.length, 0);
});

test('a race-wide cancellation removes its sessions and overrides leftover active source entries', () => {
  const inputs = [event('r'), event('q', { summary: 'Japanese GP 2026 - Qualifying' })];
  const plan = reconcile([...inputs, event('cancel', { summary: 'CALLED OFF: Japanese Grand Prix 2026' })], inputs.map(e => target(e)));
  assert.deepEqual(plan.actions.map(a => a.type), ['delete', 'delete']);
});

test('removed future sessions are deleted after a complete nonempty snapshot', () => {
  const q = event('q', { summary: 'Japanese GP - Qualifying' });
  const plan = reconcile([q], [target(), target(q)]);
  assert.deepEqual(plan.actions.map(a => a.type), ['delete']);
});

test('empty snapshots including tombstone-only responses need two successful reads', () => {
  for (const input of [[], [{ id: event().id, status: 'cancelled' }]]) {
    assert.equal(reconcile(input, [target()], { emptyReadCount: 1 }).actions.length, 0);
    assert.equal(reconcile(input, [target()], { emptyReadCount: 2 }).actions[0].type, 'delete');
  }
});

test('provider format changes suppress absence deletion and duplicate sessions abort', () => {
  const plan = reconcile([event('notice', { summary: 'Formula 1 in your calendar!' }),
    event('format', { summary: 'Japanese GP - New Session Name' })], [target()]);
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.deletionSuppressed, true);
  assert.throws(() => reconcile([event('a'), event('b')], []), /중복/);
});

test('testing, other series and marketing entries do not enter the Korean calendar', () => {
  const inputs = ['F1 Pre-Season Testing - Race', 'Formula 2 Japanese GP - Race', 'F1 Academy Japanese GP - Race',
    'Japanese GP - Race Highlights', 'Welcome to F1', 'Formula 1 in your calendar!'].map((summary, i) => event('x' + i, { summary }));
  const result = core.normalize(inputs, options);
  assert.equal(result.desired.length, 0);
  assert.equal(result.suppressDeletes, false);
  assert.deepEqual(result.warnings, []);
  const withRace = reconcile([...inputs, event()], [target()]);
  assert.equal(withRace.desiredCount, 1);
  assert.equal(withRace.deletionSuppressed, false);
  assert.equal(withRace.actions.length, 0);
});

test('manual events and another source namespace are never deleted', () => {
  const own = target();
  const manual = { ...own, id: 'personal', extendedProperties: {} };
  const other = target(event('other'));
  other.extendedProperties.private.f1Source = 'different-source';
  assert.equal(reconcile([], [manual, other], { emptyReadCount: 2 }).actions.length, 0);
});

test('malformed timestamps abort and unsafe links never enter the description', () => {
  assert.throws(() => core.normalize([event('broken', { end: { dateTime: '2026-03-28T00:00:00Z' } })], options), /종료/);
  const out = core.normalize([event('evil', { description: 'https://www.formula1.com.evil.example/en/racing/2026/japan' })], options);
  assert.equal(out.desired[0].resource.description, 'https://www.formula1.com/en/racing/2026');
});
