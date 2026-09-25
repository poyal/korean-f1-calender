/* Pure conversion/reconciliation logic. No Google calls or persistent writes. */
var F1Core = (function () {
  'use strict';
  var OWNER = 'korean-f1-calendar-v1';

  function fold(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
      .toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
  }
  function contains(text, phrase) { return (' ' + fold(text) + ' ').indexOf(' ' + fold(phrase) + ' ') !== -1; }
  function tags(event) { return (event.extendedProperties || {}).private || {}; }
  function managed(event) { return tags(event).f1Owner === OWNER; }
  function dateOnly(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
  function addDay(date) { return new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10); }
  function dateInZone(dateTime, timeZone) {
    var parts = new Intl.DateTimeFormat('en', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(dateTime));
    function part(name) { return parts.filter(function (p) { return p.type === name; })[0].value; }
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  function validInstant(value) { return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)); }
  function sessionOf(title) {
    var t = fold(title);
    if (/\b(sprint qualifying|sprint qualification|sprint shootout|sprint quali|sq)\b/.test(t)) return 'SQ';
    if (/\bsprint\b/.test(t) || /^s(?: |$)/.test(t)) return 'S';
    var practice = t.match(/\b(?:free practice|practice|fp|p)\s*([123])\b/);
    if (practice) return 'P' + practice[1];
    if (/\b(qualifying|qualification|quali|q)\b/.test(t)) return 'Q';
    if (/\b(race|grand prix race|g)\b/.test(t)) return 'G';
    return null;
  }
  function isCancellation(title) { return /\b(cancelled|canceled|called off|abandoned)\b|취소/.test(fold(title)); }
  function raceOf(title, location, races) {
    var named = races.find(function (r) { return r.aliases.some(function (a) { return contains(title, a); }); });
    // A new named GP may use an existing venue. Do not rename it to the old GP.
    if (named || /\b(grand prix|gp)\b/.test(fold(title))) return named || null;
    return races.find(function (r) { return r.aliases.some(function (a) { return contains(location, a); }); }) || null;
  }
  function englishRace(title) {
    return title.replace(/<[^>]*>/g, ' ').replace(/\bFORMULA\s*1\b/gi, '')
      .replace(/\b(?:CALLED OFF|CANCELLED|CANCELED|SPRINT QUALIFYING|SPRINT SHOOTOUT|SPRINT QUALI|SPRINT|FREE PRACTICE\s*[123]|PRACTICE\s*[123]|QUALIFYING|QUALIFICATION|RACE|TBC|TBD)\b/gi, '')
      .replace(/\[(?:P[123]|FP[123]|SQ|Q|S|G)\]/gi, '')
      .replace(/\b20\d{2}\b/g, '').replace(/\bGRAND PRIX\b/gi, 'GP')
      .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '').replace(/\s+/g, ' ').trim() || 'F1 GP';
  }
  function locationOf(raw, race, year, options) {
    function label(country, circuit) { return [country, circuit].filter(Boolean).join(' · '); }
    var venue = options.venues.find(function (v) { return contains(raw, v[0]); });
    if (venue) return { name: label(venue[2], venue[1]) };
    if (!raw) {
      var raceCountry = (options.countries || []).find(function (c) { return race && c.races.includes(race.key); });
      return { name: label(raceCountry ? raceCountry.ko : '', race ? race.circuit : '') };
    }
    var country = (options.countries || []).find(function (c) {
      return c.names.some(function (n) { return fold(n) === fold(raw); });
    });
    if (country) {
      var override = (options.venueOverrides || []).find(function (v) {
        return v.season === year && race && v.race === race.key && fold(v.country) === fold(raw);
      });
      if (override) return { name: label(country.ko, override.circuit) };
      if (race && country.races.includes(race.key) && race.circuit) return { name: label(country.ko, race.circuit) };
      // An unknown GP or an unconfirmed relocation does not imply a known circuit.
      return { name: country.ko, warning: 'VENUE_UNCONFIRMED' };
    }
    return { name: raw, warning: /[가-힣]/.test(raw) ? null : 'VENUE_TRANSLATION_MISSING' };
  }
  function officialUrl(event, year) {
    var raw = [event.description, (event.source || {}).url, event.location].filter(Boolean).join(' ');
    var urls = raw.replace(/&amp;/g, '&').match(/https?:\/\/[^\s<>"']+/g) || [];
    var direct = urls.filter(function (u) { return /^https?:\/\/(?:www\.)?formula1\.com\/en\/racing(?:\/|$)/i.test(u); });
    return direct.length ? direct[0].replace(/[),.;]+$/, '') : 'https://www.formula1.com/en/racing/' + year;
  }
  function sourceKey(event, namespace, hash) {
    if (!event.id) throw new Error('원본 일정에 ID가 없습니다. 삭제와 쓰기를 중단합니다.');
    var instance = event.originalStartTime ? JSON.stringify(event.originalStartTime) : '';
    return hash(namespace + '|' + (event.iCalUID || event.id) + '|' + instance);
  }
  function normalize(events, options) {
    var config = options.config, hash = options.hash, namespace = options.namespace;
    var desired = [], present = {}, cancellations = {}, cancelledRaces = {}, warnings = [], suppressed = false;
    var identities = {}, logicals = {};
    events.forEach(function (event) {
      var key = sourceKey(event, namespace, hash), title = String(event.summary || ''), t = fold(title);
      var tombstone = event.status === 'cancelled';
      // Google tombstones can mean upstream history pruning; missing future events
      // are reconciled below, but a tombstone alone must not erase our history.
      if (tombstone && !isCancellation(title)) return;
      present[key] = true;
      // ECAL inserts this subscription confirmation alongside real sessions.
      // Match the whole normalized title so new session formats remain visible.
      if (t === 'formula 1 in your calendar') return;
      if (/\b(formula 2|formula 3|f2|f3|f1 academy|testing|pre season|test day|highlights|replay|tickets|welcome|subscribe)\b/.test(t)) return;
      var session = sessionOf(title);
      var race = raceOf(title, event.location || '', options.races);
      var looksLikeRace = /\b(grand prix|gp|formula 1|f1)\b/.test(t);
      if (!race && !looksLikeRace) return;
      var cancelled = isCancellation(title);
      if (!session && !cancelled) {
        // A changed provider format must not look like mass race removal.
        warnings.push({ code: 'UNCLASSIFIED', title: title, start: event.start || null, end: event.end || null });
        suppressed = true;
        return;
      }
      if (event.recurrence || event.recurringEventId) throw new Error('반복 일정은 지원하지 않습니다: ' + title);
      var start = event.start || {}, end = event.end || {};
      var sourceDate = dateOnly(start.date) ? start.date : validInstant(start.dateTime)
        ? dateInZone(start.dateTime, start.timeZone || options.sourceTimeZone || config.timeZone) : null;
      var yearMatch = title.match(/\b(20\d{2})\b/);
      var year = yearMatch ? Number(yearMatch[1]) : sourceDate ? Number(sourceDate.slice(0, 4)) : null;
      if (year && year < config.firstSeason) return;
      if (cancelled) {
        cancellations[key] = true;
        if (race && year) cancelledRaces[year + '|' + race.key + '|' + (session || '*')] = true;
        return;
      }
      if (!sourceDate || !year) {
        warnings.push({ code: 'DATE_MISSING', title: title });
        // The same source ID is protected by present; protect against ID churn too.
        suppressed = true;
        return;
      }
      var fallback = englishRace(title), raceKey = race ? race.key : 'unknown-' + hash(fold(fallback));
      var logicalKey = race ? year + '|' + race.key + '|' + session : '';
      if (identities[key] || (logicalKey && logicals[logicalKey])) throw new Error('원본에 동일 세션이 중복되어 있습니다: ' + title);
      identities[key] = true;
      if (logicalKey) logicals[logicalKey] = true;
      if (!race) warnings.push({ code: 'RACE_TRANSLATION_MISSING', title: title });
      var venue = locationOf(event.location || '', race, year, options);
      var location = venue.name;
      if (venue.warning) warnings.push({ code: venue.warning, title: title, location: event.location });
      var allDay = !!start.date || /\b(tbc|tbd|time to be confirmed|time tba)\b|시간 미정/.test(t);
      if (!allDay && (!validInstant(start.dateTime) || !validInstant(end.dateTime))) {
        allDay = true;
        warnings.push({ code: 'TIME_MISSING', title: title });
      }
      if (!allDay && Date.parse(end.dateTime) <= Date.parse(start.dateTime)) throw new Error('종료 시각이 잘못된 원본 일정: ' + title);
      var resource = {
        summary: '[' + session + '] ' + (allDay ? '⏳ ' : '') + (race ? race.ko + ' GP' : fallback),
        location: location,
        description: officialUrl(event, year),
        status: 'confirmed', visibility: 'default', transparency: 'transparent',
        start: allDay ? { date: sourceDate } : { dateTime: new Date(start.dateTime).toISOString(), timeZone: config.timeZone },
        end: allDay ? { date: dateOnly(end.date) && end.date > sourceDate ? end.date : addDay(sourceDate) }
          : { dateTime: new Date(end.dateTime).toISOString(), timeZone: config.timeZone },
        reminders: { useDefault: false, overrides: allDay ? [] : [{ method: 'popup', minutes: config.reminderMinutes }] },
        extendedProperties: { private: {
          f1Owner: OWNER, f1Source: namespace, f1Key: key,
          f1Season: String(year), f1Race: raceKey, f1Session: session, f1Logical: logicalKey
        } }
      };
      desired.push({ key: key, logical: logicalKey, resource: resource });
    });
    // A race-wide cancellation wins over leftover session entries in the same snapshot.
    desired = desired.filter(function (item) {
      var p = tags(item.resource);
      return !cancelledRaces[p.f1Season + '|' + p.f1Race + '|*'] && !cancelledRaces[p.f1Season + '|' + p.f1Race + '|' + p.f1Session];
    });
    return { desired: desired, present: present, cancellations: cancellations, cancelledRaces: cancelledRaces,
      warnings: warnings, suppressDeletes: suppressed, empty: !events.some(function (e) { return e.status !== 'cancelled'; }) };
  }

  function comparable(event) {
    function time(value) {
      value = value || {};
      return value.date ? { date: value.date } : { dateTime: validInstant(value.dateTime) ? new Date(value.dateTime).toISOString() : null, timeZone: value.timeZone || '' };
    }
    var p = tags(event), privateTags = {};
    ['f1Owner', 'f1Source', 'f1Key', 'f1Season', 'f1Race', 'f1Session', 'f1Logical'].forEach(function (key) { privateTags[key] = p[key] || ''; });
    var reminders = event.reminders || {};
    return JSON.stringify({ summary: event.summary || '', description: event.description || '', location: event.location || '',
      status: event.status || 'confirmed', visibility: event.visibility || 'default', transparency: event.transparency || 'opaque',
      start: time(event.start), end: time(event.end), tags: privateTags,
      reminders: { useDefault: !!reminders.useDefault, overrides: (reminders.overrides || []).map(function (r) {
        return { method: r.method, minutes: r.minutes };
      }).sort(function (a, b) { return (a.method + a.minutes).localeCompare(b.method + b.minutes); }) }
    });
  }
  function isFuture(event, now, timeZone) {
    if ((event.start || {}).date) return event.start.date >= dateInZone(now.toISOString(), timeZone);
    return validInstant((event.start || {}).dateTime) && Date.parse(event.start.dateTime) >= now.getTime();
  }
  function reconcile(snapshot, targets, options) {
    var actions = [], unchanged = 0, preserved = 0, claimed = {}, byKey = {}, byLogical = {};
    var owned = targets.filter(function (e) { return managed(e) && e.status !== 'cancelled'; });
    owned.forEach(function (e) {
      var p = tags(e);
      if (byKey[p.f1Key]) throw new Error('대상 캘린더에 관리 일정이 중복되어 있습니다. 먼저 확인해 주세요: ' + e.summary);
      byKey[p.f1Key] = e;
      if (p.f1Logical) {
        if (!byLogical[p.f1Logical]) byLogical[p.f1Logical] = [];
        byLogical[p.f1Logical].push(e);
      }
    });
    snapshot.desired.forEach(function (item) {
      var current = byKey[item.key];
      if (!current && item.logical && byLogical[item.logical]) {
        var candidates = byLogical[item.logical];
        if (candidates.length !== 1) throw new Error('원본 교체 시 대응할 일정이 여러 개입니다: ' + item.resource.summary);
        current = candidates[0];
      }
      if (current) {
        if (claimed[current.id]) throw new Error('여러 원본 일정이 하나의 대상 일정에 대응합니다.');
        claimed[current.id] = true;
        if (comparable(current) === comparable(item.resource)) unchanged++;
        else actions.push({ type: 'update', id: current.id, resource: item.resource });
      } else actions.push({ type: 'create', key: item.key, resource: item.resource });
    });
    owned.forEach(function (event) {
      if (claimed[event.id]) return;
      var p = tags(event), sameSource = p.f1Source === options.namespace;
      var cancellation = sameSource && (snapshot.cancellations[p.f1Key] || snapshot.cancelledRaces[p.f1Season + '|' + p.f1Race + '|*'] ||
        snapshot.cancelledRaces[p.f1Season + '|' + p.f1Race + '|' + p.f1Session]);
      var missing = sameSource && !snapshot.present[p.f1Key] && !snapshot.suppressDeletes &&
        (!snapshot.empty || options.emptyReadCount >= 2) && isFuture(event, options.now, options.timeZone);
      if (cancellation || missing) actions.push({ type: 'delete', id: event.id, summary: event.summary, reason: cancellation ? 'cancelled' : 'removed' });
      else preserved++;
    });
    // Apply all insert/update operations before removing missing entries.
    return { actions: actions, unchanged: unchanged, preserved: preserved, warnings: snapshot.warnings,
      desiredCount: snapshot.desired.length, empty: snapshot.empty, deletionSuppressed: snapshot.suppressDeletes || (snapshot.empty && options.emptyReadCount < 2) };
  }
  return { OWNER: OWNER, fold: fold, tags: tags, managed: managed, sessionOf: sessionOf, dateInZone: dateInZone,
    normalize: normalize, reconcile: reconcile, comparable: comparable };
})();

if (typeof module !== 'undefined') module.exports = F1Core;
