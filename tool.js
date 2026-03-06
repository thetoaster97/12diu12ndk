(function() {

// ── Auth ──────────────────────────────────────────────────────────────────────
// Gets the web idtoken + SWID from cookies
function getWebAuth() {
  var t = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('TPR-WDW-LBJS.WEB-PROD.token=');});
  if (!t) return null;
  try {
    var raw = decodeURIComponent(t.split('=').slice(1).join('='));
    var jwt = raw.split('|').pop();
    if (!jwt || !jwt.startsWith('eyJ')) return null;
    var s = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('SWID=');});
    var swid = s ? s.split('=').slice(1).join('=') : '';
    return { idToken: jwt, swid: swid };
  } catch(e) { return null; }
}

// Cache for the exchanged guest JWT
var _guestJwt = null;
var _guestJwtExpiry = 0;

// Exchange the web idtoken for a proper guest JWT (cat:guest, client_id:TPR-WDW-LBSDK.AND-PROD)
// This is the same exchange bg1 does before hitting ea-vas endpoints
async function getGuestJwt() {
  var now = Date.now();
  if (_guestJwt && now < _guestJwtExpiry) return _guestJwt;

  var wa = getWebAuth();
  if (!wa) return null;

  try {
    var r = await fetch('https://disneyworld.disney.go.com/guest/login', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': 'BEARER ' + wa.idToken,
        'x-user-id': wa.swid,
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        loginValue: wa.swid,
        token: wa.idToken
      }),
      credentials: 'include',
      cache: 'no-store'
    });

    if (r.ok) {
      var d = await r.json();
      var jwt = d.token || d.access_token || d.accessToken;
      if (jwt) {
        // Parse expiry from JWT payload
        try {
          var payload = JSON.parse(atob(jwt.split('.')[1]));
          _guestJwtExpiry = (payload.exp || 0) * 1000 - 60000; // 1 min buffer
        } catch(e) {
          _guestJwtExpiry = now + 3600000; // default 1hr
        }
        _guestJwt = jwt;
        console.log('[LL Tool] Guest JWT obtained via /guest/login');
        return _guestJwt;
      }
    }
  } catch(e) {
    console.warn('[LL Tool] /guest/login failed:', e);
  }

  // Fallback: try the oneid token exchange endpoint bg1 uses
  try {
    var r2 = await fetch('https://disneyworld.disney.go.com/login', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: 'access_token=' + encodeURIComponent(wa.idToken) + '&client_id=TPR-WDW-LBSDK.AND-PROD',
      credentials: 'include',
      cache: 'no-store'
    });
    if (r2.ok) {
      var d2 = await r2.json();
      var jwt2 = d2.token || d2.access_token || d2.accessToken;
      if (jwt2) {
        _guestJwt = jwt2;
        _guestJwtExpiry = Date.now() + 3600000;
        console.log('[LL Tool] Guest JWT obtained via /login fallback');
        return _guestJwt;
      }
    }
  } catch(e2) {
    console.warn('[LL Tool] /login fallback failed:', e2);
  }

  // Last resort: return the web idtoken as-is and hope it works
  console.warn('[LL Tool] Could not exchange for guest JWT, using idToken directly');
  _guestJwt = wa.idToken;
  _guestJwtExpiry = Date.now() + 300000; // retry in 5 min
  return _guestJwt;
}

var BASE = 'https://disneyworld.disney.go.com';
var SENSOR_URL = 'https://bg1.joelface.com/sensor-data/random';

async function getSensorData() {
  try {
    var r = await fetch(SENSOR_URL, { cache: 'no-store' });
    if (!r.ok) return '';
    var d = await r.json();
    return d.sensor_data || d['x-acf-sensor-data'] || d.data || '';
  } catch(e) {
    console.warn('sensor-data fetch failed:', e);
    return '';
  }
}

// Main API call — uses guest JWT + sensor data, matching bg1's working request exactly
async function api(path, body) {
  var wa = getWebAuth();
  if (!wa) return { ok: false, status: 0, data: 'Not logged in — no auth cookies found' };

  var [jwt, sensor] = await Promise.all([getGuestJwt(), getSensorData()]);
  if (!jwt) return { ok: false, status: 0, data: 'Could not obtain guest JWT' };

  var headers = {
    'Accept': '*/*',
    'Accept-Language': 'en-US',
    'Authorization': 'BEARER ' + jwt,
    'Content-Type': 'application/json',
    'x-user-id': wa.swid,
    'x-app-id': 'ANDROID',
    'Origin': BASE,
    'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'
  };
  if (sensor) headers['x-acf-sensor-data'] = sensor;

  try {
    var r = await fetch(BASE + path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      referrer: '',
      credentials: 'omit',
      cache: 'no-store'
    });
    var txt = await r.text();
    var d; try { d = JSON.parse(txt); } catch(e) { d = txt; }
    return { ok: r.status === 200, status: r.status, data: d };
  } catch(e) {
    return { ok: false, status: 0, data: e.message };
  }
}

var today = new Date().toISOString().split('T')[0];

var PARKS = [
  ['80007944', 'Magic Kingdom'],
  ['80007838', 'EPCOT'],
  ['80007998', 'Hollywood Studios'],
  ['80007823', 'Animal Kingdom']
];

var NAMES = {
  80010107:'Astro Orbiter',16491297:'Barnstormer',80010110:'Big Thunder Mountain',
  80010114:"Buzz Lightyear",80010208:'Haunted Mansion',80010149:"It's a Small World",
  80010153:'Jungle Cruise',80010176:"Peter Pan's Flight",80010177:'Pirates of the Caribbean',
  16767284:'Seven Dwarfs Mine Train',80010190:'Space Mountain',412021364:"Tiana's Bayou Adventure",
  411504498:'TRON Lightcycle / Run',18375495:'Frozen Ever After',
  411499845:'Guardians: Cosmic Rewind',80010161:'Living with the Land',
  80010173:'Mission: SPACE',19497835:"Remy's Ratatouille",107785:'Seas with Nemo',
  20194:"Soarin'",80010191:'Spaceship Earth',80010199:'Test Track',
  18904172:'Alien Swirling Saucers',19259335:"Mickey & Minnie's Railway",
  19263735:'Millennium Falcon',19263736:'Rise of the Resistance',
  80010182:"Rock 'n' Roller Coaster",18904138:'Slinky Dog Dash',
  80010193:'Star Tours',209857:'Toy Story Mania',80010218:'Tower of Terror',
  18665186:'Avatar Flight of Passage',80010123:'DINOSAUR',26068:'Expedition Everest',
  80010154:'Kali River Rapids',80010157:'Kilimanjaro Safaris',18665185:"Na'vi River Journey"
};

var DYNAMIC_NAMES = {};
var namesLoaded = false;

async function loadAttractionNames() {
  if (namesLoaded) return;
  try {
    var url = BASE + '/finder/api/v1/explorer-service/list-ancestor-entities/wdw/80007798;entityType=destination/' + today + '/attractions';
    var r = await fetch(url, {
      method: 'GET',
      headers: { 'Accept-Language': 'en-US' },
      referrer: '',
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!r.ok) return;
    var d = await r.json();
    (d.results || []).forEach(function(item) {
      var raw = item.id || item.facilityId || '';
      var numId = parseInt(raw.toString().split(';')[0], 10);
      if (numId && item.name) DYNAMIC_NAMES[numId] = item.name;
    });
    namesLoaded = true;
  } catch(e) { console.warn('Could not load attraction names:', e); }
}

function nm(id) {
  var numId = +id;
  return DYNAMIC_NAMES[numId] || NAMES[numId] || String(id);
}

// ── Build page ───────────────────────────────────────────────────────────────

document.open();
document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>LL Tool</title></head><body></body></html>');
document.close();

var st = document.createElement('style');
st.textContent = [
  '*{box-sizing:border-box;margin:0;padding:0}',
  'body{background:#08080e;color:#ddd;font-family:monospace;min-height:100vh}',
  '#hd{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0d0d1a;border-bottom:1px solid #1e1e2e;position:sticky;top:0;z-index:10;flex-wrap:wrap}',
  '#hd h1{color:#00d4ff;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;flex:1;min-width:80px}',
  '.badge{font-size:.6rem;padding:2px 8px;border-radius:8px;white-space:nowrap}',
  '.ok{background:rgba(46,213,115,.15);color:#2ed573;border:1px solid #2ed57333}',
  '.no{background:rgba(255,71,87,.15);color:#ff4757;border:1px solid #ff475733}',
  '.info{background:rgba(0,212,255,.1);color:#00d4ff;border:1px solid #00d4ff33}',
  '.warn{background:rgba(255,209,102,.1);color:#ffd166;border:1px solid #ffd16633}',
  '#tabs{display:flex;background:#0d0d1a;border-bottom:1px solid #1e1e2e;position:sticky;top:45px;z-index:10}',
  '.tab{flex:1;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#555;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:monospace}',
  '.tab.on{color:#00d4ff;border-bottom-color:#00d4ff}',
  '#body{padding:16px 16px 80px}',
  '.pane{display:none}.pane.on{display:block}',
  'label{display:block;font-size:.6rem;color:#555;text-transform:uppercase;letter-spacing:.1em;margin:12px 0 4px}',
  'label:first-child{margin-top:0}',
  'select,input[type=date],input[type=text],input[type=time]{width:100%;background:#0e0e1c;border:1px solid #2a2a3a;border-radius:6px;color:#e8e8f0;padding:11px 12px;font-family:monospace;font-size:14px;outline:none}',
  'button.btn{width:100%;padding:13px;border-radius:6px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:14px;font-weight:bold}',
  '#tb-sticky{position:fixed;bottom:0;left:0;right:0;padding:10px 16px 14px;background:linear-gradient(transparent,#08080e 35%);z-index:20;display:none}',
  '#tb-sticky.vis{display:block}',
  '.res{margin-top:14px;background:#050510;border:1px solid #1e1e2e;border-radius:6px;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.7;min-height:40px}',
  '.row{display:flex;gap:8px}.row>*{flex:1}',
  '.exp{padding:10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:8px}',
  '.exp-name{font-size:13px;margin-bottom:4px}',
  '.exp-meta{display:flex;gap:10px;font-size:11px;color:#555;flex-wrap:wrap}',
  '.ll{color:#00d4ff}.wait{color:#888}.price{color:#ffd166}',
  '.guest{padding:8px 10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:6px;font-size:13px}',
  '.guest-id{font-size:10px;color:#555;word-break:break-all;margin-top:2px}',
  '.sec{font-size:.55rem;color:#555;text-transform:uppercase;letter-spacing:.12em;margin:12px 0 6px}',
  '.inelig{opacity:.45}',
  '.filter-row{display:flex;align-items:center;gap:8px;margin:10px 0 6px;cursor:pointer}',
  '.filter-row input[type=checkbox]{width:15px;height:15px;accent-color:#00d4ff;cursor:pointer;flex-shrink:0}',
  '.filter-row span{font-size:.65rem;color:#888;text-transform:uppercase;letter-spacing:.1em}'
].join('');
document.head.appendChild(st);

var webAuth = getWebAuth();

// ── Header ────────────────────────────────────────────────────────────────────
var hd = document.createElement('div'); hd.id = 'hd';
var h1el = document.createElement('h1'); h1el.textContent = '⚡ LL Tool'; hd.appendChild(h1el);
var authBadge = document.createElement('span');
authBadge.className = 'badge ' + (webAuth ? 'warn' : 'no');
authBadge.textContent = webAuth ? '⟳ authing...' : '✗ not logged in';
hd.appendChild(authBadge);
var namesBadge = document.createElement('span');
namesBadge.className = 'badge info';
namesBadge.textContent = '⟳ names';
hd.appendChild(namesBadge);
document.body.appendChild(hd);

// Kick off JWT exchange and name loading in parallel
if (webAuth) {
  getGuestJwt().then(function(jwt) {
    if (jwt && jwt !== webAuth.idToken) {
      // Successfully exchanged for guest JWT
      try {
        var payload = JSON.parse(atob(jwt.split('.')[1]));
        var cat = payload.cat || payload.client_id || 'guest';
        authBadge.textContent = '✓ ' + cat + ' ' + webAuth.swid.slice(0,8) + '...';
        authBadge.className = 'badge ok';
      } catch(e) {
        authBadge.textContent = '✓ authed ' + webAuth.swid.slice(0,8) + '...';
        authBadge.className = 'badge ok';
      }
    } else {
      // Using idtoken directly — warn user
      authBadge.textContent = '⚠ idtoken (may fail)';
      authBadge.className = 'badge warn';
    }
  });
}

loadAttractionNames().then(function() {
  var count = Object.keys(DYNAMIC_NAMES).length;
  namesBadge.textContent = count > 0 ? '✓ ' + count + ' rides' : '✗ names';
  namesBadge.className = 'badge ' + (count > 0 ? 'ok' : 'no');
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
var tabBar = document.createElement('div'); tabBar.id = 'tabs';
var bodyDiv = document.createElement('div'); bodyDiv.id = 'body';
document.body.appendChild(tabBar);
document.body.appendChild(bodyDiv);

var panes = {};
['tipboard','guests','offers'].forEach(function(id, i) {
  var labels = ['Tip Board','Guests','Offers'];
  var b = document.createElement('button');
  b.className = 'tab' + (i === 0 ? ' on' : '');
  b.textContent = labels[i];
  b.onclick = function() {
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
    document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('on');});
    b.classList.add('on');
    panes[id].classList.add('on');
    stickyBar.className = id === 'tipboard' ? 'vis' : '';
  };
  tabBar.appendChild(b);
  var pane = document.createElement('div');
  pane.className = 'pane' + (i === 0 ? ' on' : '');
  pane.id = 'pane-' + id;
  panes[id] = pane;
  bodyDiv.appendChild(pane);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parkSelect(id, selectedIdx) {
  var s = document.createElement('select'); s.id = id;
  PARKS.forEach(function(p, i) {
    var o = document.createElement('option');
    o.value = p[0]; o.textContent = p[1];
    if (i === (selectedIdx||0)) o.selected = true;
    s.appendChild(o);
  });
  return s;
}
function lbl(txt, forId) {
  var l = document.createElement('label'); l.textContent = txt;
  if (forId) l.htmlFor = forId;
  return l;
}
function inp(id, ph) {
  var i = document.createElement('input'); i.id = id; i.placeholder = ph||''; return i;
}
function mkbtn(txt, fn) {
  var b = document.createElement('button'); b.className = 'btn'; b.textContent = txt; b.onclick = fn; return b;
}
function resDiv(id) {
  var d = document.createElement('div'); d.className = 'res'; d.id = id;
  d.style.display = 'none'; return d;
}
function showRes(id, r) {
  var el = document.getElementById(id);
  el.style.display = 'block';
  el.style.color = r.ok ? '#2ed573' : '#ff4757';
  el.textContent = '[' + r.status + ']\n' + (typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
}
function loading(id) {
  var el = document.getElementById(id);
  el.style.display = 'block';
  el.style.color = '#aaa';
  el.textContent = 'Loading...';
}

async function doLoadTipBoard() {
  loading('tb-res');
  await loadAttractionNames();
  var pk = document.getElementById('tb-park').value;
  var dt = document.getElementById('tb-date').value;
  var llOnly = document.getElementById('tb-ll-only').checked;
  var wa = getWebAuth();
  if (!wa) { showRes('tb-res', {ok:false,status:0,data:'Not logged in'}); return; }
  var jwt = await getGuestJwt();
  var url = BASE + '/tipboard-vas/planning/v1/parks/' + pk + '/experiences/?date=' + dt + '&userId=' + encodeURIComponent(wa.swid);
  try {
    var r = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US',
        'Authorization': 'BEARER ' + jwt,
        'x-user-id': wa.swid,
        'x-app-id': 'ANDROID'
      },
      referrer: '', credentials: 'omit', cache: 'no-store'
    });
    var txt = await r.text(); var d; try { d = JSON.parse(txt); } catch(e) { d = txt; }
    if (r.status !== 200) { showRes('tb-res', {ok:false,status:r.status,data:d}); return; }
    var exps = (d.availableExperiences || []);
    if (llOnly) {
      exps = exps.filter(function(e) {
        return (e.flex && e.flex.available) || (e.individual && e.individual.available);
      });
    }
    var el = document.getElementById('tb-res');
    el.style.display = 'block'; el.style.color = '#ddd'; el.textContent = '';
    if (!exps.length) { el.textContent = llOnly ? 'No LL times available right now.' : 'No experiences found.'; return; }
    exps.forEach(function(e) {
      var div = document.createElement('div'); div.className = 'exp';
      var name = document.createElement('div'); name.className = 'exp-name';
      name.textContent = nm(e.id);
      div.appendChild(name);
      var meta = document.createElement('div'); meta.className = 'exp-meta';
      var sb = e.standby || {};
      if (sb.waitTime != null) { var w = document.createElement('span'); w.className='wait'; w.textContent = sb.waitTime+'m wait'; meta.appendChild(w); }
      if (e.flex && e.flex.available) {
        var ll = document.createElement('span'); ll.className='ll';
        var t = e.flex.nextAvailableTime;
        if (t) { var pts=t.split(':');var h=+pts[0];var ampm=h>=12?'pm':'am';h=h%12||12; ll.textContent='⚡ '+h+':'+pts[1]+ampm; }
        else { ll.textContent='⚡ avail'; }
        meta.appendChild(ll);
      }
      if (e.individual && e.individual.available) {
        var ip = document.createElement('span'); ip.className='price';
        ip.textContent='💲 '+(e.individual.nextAvailableTime||'avail');
        meta.appendChild(ip);
      }
      div.appendChild(meta);
      if ((e.flex && e.flex.available) || (e.individual && e.individual.available)) {
        var bb = document.createElement('button');
        bb.style.cssText = 'margin-top:6px;padding:6px 12px;border-radius:4px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:11px';
        bb.textContent = 'Book →';
        bb.onclick = (function(expId, parkId) {
          return function() {
            document.getElementById('off-exp').value = expId;
            document.getElementById('off-park').value = parkId;
            document.querySelectorAll('.tab')[2].click();
          };
        })(e.id, pk);
        div.appendChild(bb);
      }
      el.appendChild(div);
    });
  } catch(ex) { showRes('tb-res', {ok:false,status:0,data:ex.message}); }
}

// ── Tip Board ─────────────────────────────────────────────────────────────────
var tb = panes.tipboard;
tb.appendChild(lbl('Park'));
tb.appendChild(parkSelect('tb-park'));
var tbRow = document.createElement('div'); tbRow.className = 'row';
var tbDateWrap = document.createElement('div');
tbDateWrap.appendChild(lbl('Date'));
var tbDate = inp('tb-date'); tbDate.type = 'date'; tbDate.value = today;
tbDateWrap.appendChild(tbDate); tbRow.appendChild(tbDateWrap);
tb.appendChild(tbRow);
var filterRow = document.createElement('label'); filterRow.className = 'filter-row';
var filterCb = document.createElement('input'); filterCb.type = 'checkbox'; filterCb.id = 'tb-ll-only';
var filterSpan = document.createElement('span'); filterSpan.textContent = 'Lightning Lane only';
filterRow.appendChild(filterCb); filterRow.appendChild(filterSpan);
tb.appendChild(filterRow);
tb.appendChild(resDiv('tb-res'));

var stickyBar = document.createElement('div'); stickyBar.id = 'tb-sticky'; stickyBar.className = 'vis';
stickyBar.appendChild(mkbtn('Load Tip Board', doLoadTipBoard));
document.body.appendChild(stickyBar);

// ── Guests ────────────────────────────────────────────────────────────────────
var gu = panes.guests;
gu.appendChild(lbl('Park'));
gu.appendChild(parkSelect('gu-park'));
gu.appendChild(lbl('Facility ID (optional)'));
gu.appendChild(inp('gu-fid', 'e.g. 80010176'));
gu.appendChild(mkbtn('Fetch Guests', async function() {
  loading('gu-res');
  var r = await api('/ea-vas/planning/api/v1/experiences/guest/guests', {
    date: today,
    facilityId: document.getElementById('gu-fid').value.trim() || null,
    parkId: document.getElementById('gu-park').value
  });
  var el = document.getElementById('gu-res');
  el.style.display = 'block'; el.style.color = '#ddd'; el.textContent = '';
  if (!r.ok) { showRes('gu-res', r); return; }
  var g = r.data.guests || [], ig = r.data.ineligibleGuests || [];
  window._guestIds = g.map(function(x){return x.id;});
  if (g.length) {
    var s = document.createElement('div'); s.className='sec'; s.textContent='Eligible ('+g.length+')'; el.appendChild(s);
    g.forEach(function(guest) {
      var d = document.createElement('div'); d.className='guest';
      d.textContent = guest.firstName + ' ' + guest.lastName + (guest.primary ? ' ★' : '');
      var gid = document.createElement('div'); gid.className='guest-id'; gid.textContent = guest.id;
      d.appendChild(gid); el.appendChild(d);
    });
  }
  if (ig.length) {
    var s2 = document.createElement('div'); s2.className='sec'; s2.textContent='Ineligible ('+ig.length+')'; el.appendChild(s2);
    ig.forEach(function(guest) {
      var d = document.createElement('div'); d.className='guest inelig';
      var reason = (guest.ineligibleReason && guest.ineligibleReason.ineligibleReason) || guest.ineligibleReason || '';
      d.textContent = guest.firstName + ' ' + guest.lastName + (reason ? ' — ' + reason.replace(/_/g,' ') : '');
      el.appendChild(d);
    });
  }
}));
gu.appendChild(resDiv('gu-res'));

// ── Offers ────────────────────────────────────────────────────────────────────
var of = panes.offers;
of.appendChild(lbl('Experience ID'));
of.appendChild(inp('off-exp', 'e.g. 80010176'));
of.appendChild(lbl('Park'));
of.appendChild(parkSelect('off-park'));
of.appendChild(lbl('Targeted Time'));
var offTime = inp('off-time'); offTime.type = 'time'; offTime.value = '08:00'; of.appendChild(offTime);
of.appendChild(lbl('Guest IDs (auto-filled from Guests tab)'));
of.appendChild(inp('off-guests', 'comma separated, or fetch guests first'));
of.appendChild(mkbtn('Generate Offer', async function() {
  loading('off-res');
  var expId = document.getElementById('off-exp').value.trim();
  var pk = document.getElementById('off-park').value;
  var rawTime = document.getElementById('off-time').value.trim() || '08:00';
  var tt = rawTime.length === 5 ? rawTime + ':00' : rawTime;
  var gids = document.getElementById('off-guests').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  if (!gids.length && window._guestIds && window._guestIds.length) gids = window._guestIds;
  if (!expId) { showRes('off-res', {ok:false,status:0,data:'Enter an experience ID'}); return; }
  if (!gids.length) { showRes('off-res', {ok:false,status:0,data:'Fetch guests first or enter guest IDs'}); return; }
  var r = await api('/ea-vas/planning/api/v1/experiences/offerset/generate', {
    date: today,
    parkId: pk,
    experienceIds: [expId],
    guestIds: gids,
    targetedTime: tt,
    ignoredBookedExperienceIds: null
  });
  showRes('off-res', r);
}));
of.appendChild(resDiv('off-res'));

})();