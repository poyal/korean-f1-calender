/* Apps Script entry points. Enable the advanced Google Calendar service. */
var F1_TARGET_PROPERTY = 'F1_TARGET_CALENDAR_ID';
var F1_STATE_PROPERTY = 'F1_SYNC_STATE';

function listCalendars() {
  var items = [], pageToken;
  do {
    var page = Calendar.CalendarList.list({ maxResults: 250, showHidden: true, pageToken: pageToken });
    items = items.concat((page.items || []).map(function (c) {
      return { id: c.id, name: c.summary, timeZone: c.timeZone, accessRole: c.accessRole };
    }));
    pageToken = page.nextPageToken;
  } while (pageToken);
  console.log(JSON.stringify(items, null, 2));
  return items;
}

/** Read only: inspect the source and every proposed change before creating a target. */
function previewSync() {
  var context = f1ReadContext_();
  var report = f1Report_(context.plan);
  report.sourceName = context.source.summary;
  report.targetCalendarId = context.targetId || null;
  report.sourceEvents = context.sourceEvents.length;
  report.seasons = {};
  context.snapshot.desired.forEach(function (item) {
    var year = F1Core.tags(item.resource).f1Season;
    report.seasons[year] = (report.seasons[year] || 0) + 1;
  });
  report.changes = context.plan.actions.map(function (a) {
    return a.type === 'delete' ? a : { type: a.type, id: a.id || null, event: a.resource };
  });
  // Do not serialize hundreds of resources into a single truncated log entry.
  var summary = Object.assign({}, report);
  delete summary.changes;
  console.log(JSON.stringify(summary, null, 2));
  context.plan.warnings.filter(function (w) { return ['UNCLASSIFIED', 'DATE_MISSING'].includes(w.code); })
    .forEach(function (w) { console.log('확인 필요: ' + JSON.stringify(w)); });
  var samplesPerSeason = {};
  context.snapshot.desired.forEach(function (item) {
    var p = F1Core.tags(item.resource), count = samplesPerSeason[p.f1Season] || 0;
    if (count >= 2) return;
    samplesPerSeason[p.f1Season] = count + 1;
    console.log('변환 예시: ' + JSON.stringify(f1PreviewEvent_(item.resource)));
  });
  return report;
}

/** Create once, privately. A valid, recognizable source is required first. */
function setupCalendar() {
  return f1WithLock_(function () {
    var context = f1ReadContext_();
    if (context.targetId) {
      console.log('기존 대상 캘린더를 사용합니다: ' + context.targetId);
      return context.targetId;
    }
    if (!context.snapshot.desired.length) throw new Error('등록 가능한 F1 세션이 없습니다. previewSync 결과와 원본 캘린더를 확인하세요.');
    var calendar = Calendar.Calendars.insert({
      summary: F1_CONFIG.calendarName, timeZone: F1_CONFIG.timeZone,
      description: '공식 F1 일정을 한글로 정리한 비공식 캘린더입니다. 매시간 원본을 확인하며 반영 지연이 있을 수 있습니다. ' +
        '구독자는 자신의 시간대와 알림을 설정해 주세요. 출처: ' + F1_CONFIG.officialCalendarUrl
    });
    // Persist immediately so a later failure cannot create a second calendar.
    PropertiesService.getScriptProperties().setProperty(F1_TARGET_PROPERTY, calendar.id);
    console.log('비공개 캘린더 생성: ' + calendar.id + '. syncNow를 실행하세요.');
    return calendar.id;
  });
}

function syncNow() {
  return f1WithLock_(function () {
    var context;
    try {
      context = f1ReadContext_();
      if (!context.targetId) throw new Error('setupCalendar를 먼저 실행하세요.');
      var counts = { create: 0, update: 0, delete: 0 }, applied = 0;
      for (var i = 0; i < context.plan.actions.length; i++) {
        if (applied >= F1_CONFIG.maxWritesPerRun || Date.now() >= context.deadline) break;
        var action = context.plan.actions[i];
        if (action.type === 'create') f1Insert_(context.targetId, action.key, action.resource);
        else if (action.type === 'update') Calendar.Events.update(action.resource, context.targetId, action.id, { sendUpdates: 'none' });
        else Calendar.Events.remove(context.targetId, action.id, { sendUpdates: 'none' });
        counts[action.type]++;
        applied++;
      }
      var remaining = context.plan.actions.length - applied;
      var now = new Date().toISOString();
      var complete = remaining === 0;
      var state = {
        source: context.namespace, emptyReadCount: context.emptyReadCount,
        lastRunAt: now, lastSuccessAt: complete ? now : context.state.lastSuccessAt || null,
        lastError: null, counts: counts, remaining: remaining,
        verifiedRuns: complete && context.snapshot.desired.length > 0 && !context.snapshot.suppressDeletes
          ? (context.state.verifiedRuns || 0) + 1 : 0,
        sourceEvents: context.sourceEvents.length, desiredEvents: context.snapshot.desired.length,
        warnings: f1WarningSummary_(context.snapshot.warnings).examples,
        warningCount: context.snapshot.warnings.length
      };
      f1SaveState_(state);
      var report = f1Report_(context.plan);
      report.applied = counts;
      report.remaining = remaining;
      report.lastSuccessAt = state.lastSuccessAt;
      console.log(JSON.stringify(report, null, 2));
      if (remaining) console.log('실행 한도에 맞춰 중단했습니다. syncNow를 다시 실행하면 남은 작업부터 대조합니다.');
      return report;
    } catch (error) {
      var state = f1State_();
      state.emptyReadCount = 0; // Failed reads do not count toward empty confirmation.
      state.verifiedRuns = 0;
      state.lastError = String(error.message || error).slice(0, 500);
      state.lastRunAt = new Date().toISOString();
      f1SaveState_(state);
      console.error('동기화 실패: ' + state.lastError + '. 다음 실행에서 전체 대조 후 재개합니다.');
      throw error;
    }
  });
}

/** Run after a complete sync. Re-running this leaves exactly one hourly trigger. */
function installHourlyTrigger() {
  return f1WithLock_(function () {
    f1CheckConfig_();
    var state = f1State_();
    if (state.source !== f1Hash_(F1_CONFIG.sourceCalendarId) || !state.verifiedRuns || state.remaining) {
      throw new Error('정상 동기화를 완료한 뒤 트리거를 설치하세요.');
    }
    f1RemoveTriggers_();
    var trigger = ScriptApp.newTrigger('syncNow').timeBased().everyHours(1).create();
    console.log('매시간 동기화 설치: ' + trigger.getUniqueId());
    return trigger.getUniqueId();
  });
}

function uninstallHourlyTrigger() {
  return f1WithLock_(function () {
    f1RemoveTriggers_();
    console.log('자동 실행을 해제했습니다. 캘린더와 기존 일정은 유지됩니다.');
  });
}

/** Publish only this script's calendar, after two completed verification runs. */
function publishCalendar() {
  return f1WithLock_(function () {
    var context = f1ReadContext_();
    if (!context.targetId || (context.state.verifiedRuns || 0) < 2 || !context.snapshot.desired.length ||
        context.snapshot.suppressDeletes || context.plan.actions.length) {
      throw new Error('syncNow를 두 번 이상 정상 완료하고 previewSync에서 변경 없음 상태를 확인한 뒤 공개하세요.');
    }
    if (context.targets.some(function (e) { return e.status !== 'cancelled' && !F1Core.managed(e); })) {
      throw new Error('대상에 스크립트가 만들지 않은 일정이 있습니다. 개인 일정이 공개되지 않도록 먼저 분리하세요.');
    }
    var rules = [], pageToken;
    do {
      var page = Calendar.Acl.list(context.targetId, { pageToken: pageToken });
      rules = rules.concat(page.items || []);
      pageToken = page.nextPageToken;
    } while (pageToken);
    var existing = rules.find(function (r) { return r.scope.type === 'default'; });
    if (existing && existing.role !== 'reader') Calendar.Acl.update({ scope: { type: 'default' }, role: 'reader' }, context.targetId, existing.id, { sendNotifications: false });
    else if (!existing) Calendar.Acl.insert({ scope: { type: 'default' }, role: 'reader' }, context.targetId, { sendNotifications: false });
    return getSubscriptionLinks();
  });
}

function getSubscriptionLinks() {
  var id = PropertiesService.getScriptProperties().getProperty(F1_TARGET_PROPERTY);
  if (!id) throw new Error('setupCalendar를 먼저 실행하세요.');
  var encoded = encodeURIComponent(id);
  var links = {
    google: 'https://calendar.google.com/calendar/u/0?cid=' + encoded,
    web: 'https://calendar.google.com/calendar/embed?src=' + encoded + '&ctz=Asia%2FSeoul',
    ics: 'https://calendar.google.com/calendar/ical/' + encoded + '/public/basic.ics',
    note: '공개 설정 후 사용하세요. 알림은 구독자가 직접 설정하며 표시 시간대는 각자의 설정을 따릅니다.'
  };
  console.log(JSON.stringify(links, null, 2));
  return links;
}

function showStatus() {
  var result = { targetCalendarId: PropertiesService.getScriptProperties().getProperty(F1_TARGET_PROPERTY), state: f1State_(),
    triggers: ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncNow'; }).length };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function f1CheckConfig_() {
  if (!F1_CONFIG.sourceCalendarId || F1_CONFIG.sourceCalendarId === 'primary') throw new Error('Config의 sourceCalendarId에 공식 구독의 Google 캘린더 ID를 설정하세요. 기본 캘린더는 사용하지 않습니다.');
  if (!Number.isInteger(F1_CONFIG.firstSeason) || F1_CONFIG.firstSeason < 2026) throw new Error('firstSeason은 2026 이상이어야 합니다.');
  if (F1_CONFIG.timeZone !== 'Asia/Seoul') throw new Error('한국 시간대 Asia/Seoul을 사용하세요.');
  if (!Number.isInteger(F1_CONFIG.maxWritesPerRun) || F1_CONFIG.maxWritesPerRun < 1 || F1_CONFIG.maxRunMillis < 1000 || F1_CONFIG.maxRunMillis > 270000) throw new Error('실행 한도 설정이 잘못되었습니다.');
}

function f1ReadContext_() {
  f1CheckConfig_();
  var deadline = Date.now() + F1_CONFIG.maxRunMillis;
  var source = Calendar.CalendarList.get(F1_CONFIG.sourceCalendarId);
  if (!source || !['reader', 'writer', 'owner'].includes(source.accessRole) || source.primary) throw new Error('공식 구독 캘린더의 상세 읽기 권한이 필요합니다. 기본 캘린더는 원본으로 사용하지 않습니다.');
  var namespace = f1Hash_(F1_CONFIG.sourceCalendarId);
  var state = f1State_();
  if (state.source !== namespace) state = {}; // An empty result from a different source is never confirmation.
  var sourceEvents = f1ListEvents_(F1_CONFIG.sourceCalendarId, {
    timeMin: F1_CONFIG.firstSeason + '-01-01T00:00:00+09:00',
    singleEvents: false, showDeleted: true, maxResults: 2500, timeZone: F1_CONFIG.timeZone
  }, deadline);
  var snapshot = F1Core.normalize(sourceEvents, { config: F1_CONFIG, races: F1_RACES, venues: F1_VENUES,
    countries: F1_COUNTRIES, venueOverrides: F1_VENUE_OVERRIDES,
    hash: f1Hash_, namespace: namespace, sourceTimeZone: source.timeZone });
  var targetId = PropertiesService.getScriptProperties().getProperty(F1_TARGET_PROPERTY);
  var targets = [];
  if (targetId) {
    var target = Calendar.CalendarList.get(targetId);
    if (!target || target.primary || target.accessRole !== 'owner' || target.id === source.id || targetId === F1_CONFIG.sourceCalendarId) throw new Error('대상은 원본과 다른, 본인 소유의 별도 캘린더여야 합니다.');
    targets = f1ListEvents_(targetId, { singleEvents: false, showDeleted: false, maxResults: 2500 }, deadline);
  }
  var emptyReadCount = snapshot.empty ? (state.emptyReadCount || 0) + 1 : 0;
  var plan = F1Core.reconcile(snapshot, targets, { namespace: namespace, emptyReadCount: emptyReadCount,
    now: new Date(), timeZone: F1_CONFIG.timeZone });
  return { source: source, sourceEvents: sourceEvents, namespace: namespace, state: state, snapshot: snapshot,
    targetId: targetId, targets: targets, emptyReadCount: emptyReadCount, plan: plan, deadline: deadline };
}

function f1ListEvents_(calendarId, options, deadline) {
  var items = [], seenTokens = {}, token;
  for (var pageNumber = 0; pageNumber < F1_CONFIG.maxPages; pageNumber++) {
    if (Date.now() >= deadline) throw new Error('전체 조회 시간 초과. 이번 실행은 일정을 변경하지 않습니다.');
    var params = Object.assign({}, options);
    if (token) params.pageToken = token;
    var page = Calendar.Events.list(calendarId, params);
    if (!page || page.kind !== 'calendar#events' || (page.items !== undefined && !Array.isArray(page.items))) throw new Error('불완전한 캘린더 응답. 이번 실행은 일정을 변경하지 않습니다.');
    if (page.accessRole && !['reader', 'writer', 'owner'].includes(page.accessRole)) throw new Error('일정 상세 읽기 권한이 없습니다.');
    items = items.concat(page.items || []);
    token = page.nextPageToken;
    if (!token) return items;
    if (seenTokens[token]) throw new Error('반복된 페이지 토큰. 이번 실행은 일정을 변경하지 않습니다.');
    seenTokens[token] = true;
  }
  throw new Error('원본 전체 조회가 끝나지 않았습니다. maxPages 설정을 확인하세요.');
}

function f1Insert_(calendarId, key, resource) {
  // Client-assigned IDs make retry after an ambiguous write result idempotent.
  // A cancelled ID is not reusable, so derive a deterministic restoration ID.
  for (var generation = 0; generation < 20; generation++) {
    var id = 'f1ko' + f1Hash_(key + ':' + generation);
    try {
      return Calendar.Events.insert(Object.assign({ id: id }, resource), calendarId, { sendUpdates: 'none' });
    } catch (error) {
      if (!/409|already exists|duplicate/i.test(String(error.message || error))) throw error;
      var existing;
      try { existing = Calendar.Events.get(calendarId, id); }
      catch (readError) {
        if (/410|deleted|gone/i.test(String(readError.message || readError))) continue;
        throw readError;
      }
      if (existing.status === 'cancelled') continue;
      if (!F1Core.managed(existing) || F1Core.tags(existing).f1Key !== key) throw new Error('일정 ID 충돌: 다른 일정을 덮어쓰지 않습니다.');
      if (F1Core.comparable(existing) === F1Core.comparable(resource)) return existing;
      return Calendar.Events.update(resource, calendarId, id, { sendUpdates: 'none' });
    }
  }
  throw new Error('반복 삭제된 일정의 복원을 자동 처리할 수 없습니다. 실행 기록을 확인하세요.');
}

function f1Hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function f1WithLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('다른 동기화가 실행 중입니다. 잠시 후 다시 시도하세요.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function f1State_() {
  var raw = PropertiesService.getScriptProperties().getProperty(F1_STATE_PROPERTY);
  return raw ? JSON.parse(raw) : {};
}
function f1SaveState_(state) { PropertiesService.getScriptProperties().setProperty(F1_STATE_PROPERTY, JSON.stringify(state)); }
function f1RemoveTriggers_() {
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'syncNow'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
function f1Report_(plan) {
  var counts = { create: 0, update: 0, delete: 0 };
  plan.actions.forEach(function (a) { counts[a.type]++; });
  var warnings = f1WarningSummary_(plan.warnings);
  return { proposed: counts, unchanged: plan.unchanged, preserved: plan.preserved, desiredCount: plan.desiredCount,
    emptySource: plan.empty, deletionSuppressed: plan.deletionSuppressed,
    warningCount: plan.warnings.length, warningCounts: warnings.counts, warnings: warnings.examples };
}

function f1WarningSummary_(warnings) {
  var counts = {}, groups = {}, examples = [];
  warnings.forEach(function (w) {
    counts[w.code] = (counts[w.code] || 0) + 1;
    if (!groups[w.code]) groups[w.code] = [];
    if (groups[w.code].length < 2) groups[w.code].push({ code: w.code, title: w.title.slice(0, 160), location: (w.location || '').slice(0, 80) });
  });
  var priority = ['UNCLASSIFIED', 'DATE_MISSING'];
  priority.concat(Object.keys(groups).filter(function (c) { return !priority.includes(c); }).sort())
    .forEach(function (code) { examples = examples.concat(groups[code] || []); });
  return { counts: counts, examples: examples };
}

function f1PreviewEvent_(event) {
  function local(value) {
    if (value.date) return value.date + ' (종일)';
    // Calendar display is fixed to Asia/Seoul; use UTC+09 for a compact log only.
    return new Date(Date.parse(value.dateTime) + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') + ' KST';
  }
  return { title: event.summary, season: F1Core.tags(event).f1Season, start: local(event.start), end: local(event.end),
    location: event.location, description: event.description, reminders: event.reminders.overrides };
}
