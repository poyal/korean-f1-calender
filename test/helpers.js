'use strict';
const crypto = require('node:crypto');
const config = require('../src/Config');
const core = require('../src/Core');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const options = { config: config.F1_CONFIG, races: config.F1_RACES, venues: config.F1_VENUES,
  countries: config.F1_COUNTRIES, venueOverrides: config.F1_VENUE_OVERRIDES,
  hash, namespace: hash('source'), sourceTimeZone: 'UTC' };
function event(id = 'japan-race', extra = {}) {
  return { id, iCalUID: id + '@official-example', summary: 'FORMULA 1 JAPANESE GRAND PRIX 2026 - Race',
    start: { dateTime: '2026-03-29T05:00:00Z' }, end: { dateTime: '2026-03-29T07:00:00Z' },
    location: 'Suzuka Circuit', ...extra };
}
function target(source = event(), extra = {}) {
  return { ...core.normalize([source], options).desired[0].resource, id: 'target-' + source.id, ...extra };
}
function reconcile(source, targets, extra = {}) {
  return core.reconcile(core.normalize(source, options), targets, {
    namespace: options.namespace, now: new Date('2026-01-01T00:00:00Z'), timeZone: 'Asia/Seoul', emptyReadCount: 0, ...extra
  });
}
module.exports = { hash, options, event, target, reconcile, core, config };
