/* Set the Google Calendar ID from listCalendars(), not the ECAL schedule ID. */
var F1_CONFIG = {
  sourceCalendarId: '12b91f4217e4a274bd5918a0ac79744ba5bceaa8e458ac07317093b82aee7035@group.calendar.google.com',
  calendarName: 'F1 한국어',
  timeZone: 'Asia/Seoul',
  firstSeason: 2026,
  reminderMinutes: 60,
  maxWritesPerRun: 80,
  maxRunMillis: 240000,
  maxPages: 100,
  officialCalendarUrl: 'https://calendar.formula1.com/'
};

/* Match the most specific race first. Add future races here without changing code. */
var F1_RACES = [
  { key: 'las-vegas', ko: '라스베이거스', aliases: ['las vegas'], circuit: '라스베이거스 스트립 서킷' },
  { key: 'miami', ko: '마이애미', aliases: ['miami'], circuit: '마이애미 인터내셔널 오토드롬' },
  { key: 'emilia-romagna', ko: '에밀리아로마냐', aliases: ['emilia romagna', 'emilia-romagna', 'imola'], circuit: '이몰라 서킷' },
  { key: 'barcelona', ko: '바르셀로나 카탈루냐', aliases: ['barcelona-catalunya', 'barcelona catalunya', 'barcelona'], circuit: '바르셀로나 카탈루냐 서킷' },
  { key: 'australia', ko: '호주', aliases: ['australian', 'australia', 'melbourne'], circuit: '앨버트 파크 서킷' },
  { key: 'china', ko: '중국', aliases: ['chinese', 'china', 'shanghai'], circuit: '상하이 인터내셔널 서킷' },
  { key: 'japan', ko: '일본', aliases: ['japanese', 'japan', 'suzuka'], circuit: '스즈카 서킷' },
  { key: 'bahrain', ko: '바레인', aliases: ['bahrain'], circuit: '바레인 인터내셔널 서킷' },
  { key: 'saudi-arabia', ko: '사우디아라비아', aliases: ['saudi arabian', 'saudi arabia', 'jeddah'], circuit: '제다 코니시 서킷' },
  { key: 'canada', ko: '캐나다', aliases: ['canadian', 'canada', 'grand prix du canada', 'montreal'], circuit: '질 빌뇌브 서킷' },
  { key: 'monaco', ko: '모나코', aliases: ['monaco'], circuit: '모나코 서킷' },
  { key: 'austria', ko: '오스트리아', aliases: ['austrian', 'austria', 'osterreich', 'spielberg'], circuit: '레드불 링' },
  { key: 'britain', ko: '영국', aliases: ['british', 'great britain', 'united kingdom', 'silverstone'], circuit: '실버스톤 서킷' },
  { key: 'belgium', ko: '벨기에', aliases: ['belgian', 'belgium', 'belgique', 'spa-francorchamps'], circuit: '스파 프랑코르샹 서킷' },
  { key: 'hungary', ko: '헝가리', aliases: ['hungarian', 'hungary', 'magyar', 'hungaroring'], circuit: '헝가로링' },
  { key: 'netherlands', ko: '네덜란드', aliases: ['dutch', 'netherlands', 'zandvoort'], circuit: '잔드보르트 서킷' },
  { key: 'italy', ko: '이탈리아', aliases: ['italian', 'italy', 'd italia', 'monza'], circuit: '몬차 서킷' },
  { key: 'spain', ko: '스페인', aliases: ['spanish', 'spain', 'espana', 'madrid', 'madring'], circuit: '마드링' },
  { key: 'azerbaijan', ko: '아제르바이잔', aliases: ['azerbaijan', 'baku'], circuit: '바쿠 시티 서킷' },
  { key: 'singapore', ko: '싱가포르', aliases: ['singapore', 'marina bay'], circuit: '마리나 베이 스트리트 서킷' },
  { key: 'united-states', ko: '미국', aliases: ['united states', 'usa', 'austin'], circuit: '서킷 오브 디 아메리카스' },
  { key: 'mexico', ko: '멕시코', aliases: ['mexican', 'mexico', 'ciudad de mexico'], circuit: '에르마노스 로드리게스 서킷' },
  { key: 'brazil', ko: '브라질', aliases: ['brazilian', 'brazil', 'sao paulo', 'interlagos'], circuit: '인터라고스 서킷' },
  { key: 'qatar', ko: '카타르', aliases: ['qatar', 'lusail', 'losail'], circuit: '루사일 인터내셔널 서킷' },
  { key: 'abu-dhabi', ko: '아부다비', aliases: ['abu dhabi', 'yas marina'], circuit: '야스 마리나 서킷' },
  { key: 'portugal', ko: '포르투갈', aliases: ['portuguese', 'portugal', 'portimao', 'algarve'], circuit: '알가르브 인터내셔널 서킷' },
  { key: 'turkey', ko: '튀르키예', aliases: ['turkish', 'turkey', 'turkiye', 'istanbul'], circuit: '이스탄불 파크' },
  { key: 'malaysia', ko: '말레이시아', aliases: ['malaysian', 'malaysia', 'sepang'], circuit: '세팡 인터내셔널 서킷' },
  { key: 'france', ko: '프랑스', aliases: ['french', 'france'], circuit: '폴 리카르 서킷' },
  { key: 'germany', ko: '독일', aliases: ['german', 'germany', 'deutschland'], circuit: '' }
];

/* [source alias, Korean circuit, actual host country]. Venue wins over GP name. */
var F1_VENUES = [
  ['suzuka', '스즈카 서킷', '일본'], ['albert park', '앨버트 파크 서킷', '호주'],
  ['shanghai', '상하이 인터내셔널 서킷', '중국'], ['bahrain international', '바레인 인터내셔널 서킷', '바레인'],
  ['jeddah', '제다 코니시 서킷', '사우디아라비아'], ['miami international', '마이애미 인터내셔널 오토드롬', '미국'],
  ['gilles villeneuve', '질 빌뇌브 서킷', '캐나다'], ['gilles-villeneuve', '질 빌뇌브 서킷', '캐나다'],
  ['monaco', '모나코 서킷', '모나코'], ['barcelona', '바르셀로나 카탈루냐 서킷', '스페인'],
  ['red bull ring', '레드불 링', '오스트리아'], ['silverstone', '실버스톤 서킷', '영국'],
  ['spa', '스파 프랑코르샹 서킷', '벨기에'], ['hungaroring', '헝가로링', '헝가리'], ['zandvoort', '잔드보르트 서킷', '네덜란드'],
  ['monza', '몬차 서킷', '이탈리아'], ['madring', '마드링', '스페인'], ['madrid', '마드링', '스페인'],
  ['baku', '바쿠 시티 서킷', '아제르바이잔'], ['marina bay', '마리나 베이 스트리트 서킷', '싱가포르'],
  ['circuit of the americas', '서킷 오브 디 아메리카스', '미국'], ['austin', '서킷 오브 디 아메리카스', '미국'],
  ['hermanos rodriguez', '에르마노스 로드리게스 서킷', '멕시코'], ['interlagos', '인터라고스 서킷', '브라질'],
  ['jose carlos pace', '인터라고스 서킷', '브라질'], ['las vegas', '라스베이거스 스트립 서킷', '미국'],
  ['lusail', '루사일 인터내셔널 서킷', '카타르'], ['losail', '루사일 인터내셔널 서킷', '카타르'],
  ['yas marina', '야스 마리나 서킷', '아랍에미리트'], ['algarve', '알가르브 인터내셔널 서킷', '포르투갈'],
  ['portimao', '알가르브 인터내셔널 서킷', '포르투갈'], ['istanbul', '이스탄불 파크', '튀르키예'],
  ['sepang', '세팡 인터내셔널 서킷', '말레이시아'], ['imola', '이몰라 서킷', '이탈리아'],
  ['enzo e dino ferrari', '이몰라 서킷', '이탈리아'], ['paul ricard', '폴 리카르 서킷', '프랑스'],
  ['hockenheim', '호켄하임링', '독일'], ['nurburgring', '뉘르부르크링', '독일']
];

/* ECAL often supplies a country, not a circuit. Disambiguate with the GP name. */
var F1_COUNTRIES = [
  { names: ['United States', 'USA', 'US'], ko: '미국', races: ['united-states', 'miami', 'las-vegas'] },
  { names: ['Spain'], ko: '스페인', races: ['spain', 'barcelona'] },
  { names: ['Italy'], ko: '이탈리아', races: ['italy', 'emilia-romagna'] },
  { names: ['United Arab Emirates', 'UAE', 'Abu Dhabi'], ko: '아랍에미리트', races: ['abu-dhabi'] },
  { names: ['Great Britain', 'United Kingdom', 'UK', 'Britain'], ko: '영국', races: ['britain'] },
  { names: ['Australia'], ko: '호주', races: ['australia'] },
  { names: ['China'], ko: '중국', races: ['china'] },
  { names: ['Japan'], ko: '일본', races: ['japan'] },
  { names: ['Bahrain'], ko: '바레인', races: ['bahrain'] },
  { names: ['Saudi Arabia'], ko: '사우디아라비아', races: ['saudi-arabia'] },
  { names: ['Canada'], ko: '캐나다', races: ['canada'] },
  { names: ['Monaco'], ko: '모나코', races: ['monaco'] },
  { names: ['Austria'], ko: '오스트리아', races: ['austria'] },
  { names: ['Belgium'], ko: '벨기에', races: ['belgium'] },
  { names: ['Hungary'], ko: '헝가리', races: ['hungary'] },
  { names: ['Netherlands', 'The Netherlands'], ko: '네덜란드', races: ['netherlands'] },
  { names: ['Azerbaijan'], ko: '아제르바이잔', races: ['azerbaijan'] },
  { names: ['Singapore'], ko: '싱가포르', races: ['singapore'] },
  { names: ['Mexico'], ko: '멕시코', races: ['mexico'] },
  { names: ['Brazil'], ko: '브라질', races: ['brazil'] },
  { names: ['Qatar'], ko: '카타르', races: ['qatar'] },
  { names: ['Portugal'], ko: '포르투갈', races: ['portugal'] },
  { names: ['Turkey', 'Turkiye', 'Türkiye'], ko: '튀르키예', races: ['turkey'] },
  { names: ['Malaysia'], ko: '말레이시아', races: ['malaysia'] },
  { names: ['France'], ko: '프랑스', races: ['france'] },
  { names: ['Germany'], ko: '독일', races: ['germany'] }
];

/* Confirmed relocation, deliberately limited to the named season and country.
 * https://corp.formula1.com/formula-1-and-fia-confirm-that-malaysia-will-join-the-2026-calendar-as-host-venue-for-the-bahrain-grand-prix/
 */
var F1_VENUE_OVERRIDES = [
  { season: 2026, race: 'bahrain', country: 'Malaysia', circuit: '세팡 인터내셔널 서킷' }
];

if (typeof module !== 'undefined') module.exports = { F1_CONFIG: F1_CONFIG, F1_RACES: F1_RACES, F1_VENUES: F1_VENUES,
  F1_COUNTRIES: F1_COUNTRIES, F1_VENUE_OVERRIDES: F1_VENUE_OVERRIDES };
