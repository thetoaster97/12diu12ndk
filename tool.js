(function() {

function ga() {
  var t = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('TPR-WDW-LBJS.WEB-PROD.token=');});
  if (!t) return null;
  try {
    var raw = decodeURIComponent(t.split('=').slice(1).join('='));
    var jwt = raw.split('|').pop();
    if (!jwt || !jwt.startsWith('eyJ')) return null;
    var s = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('SWID=');});
    var swid = s ? s.split('=').slice(1).join('=').replace(/[{}]/g, '') : '';
    return { j: jwt, w: swid };
  } catch(e) { return null; }
}

var BASE = 'https://disneyworld.disney.go.com';
var isAndroid = navigator.userAgent.toLowerCase().includes('android');

async function api(path, body) {
  var a = ga();
  if (!a) return { ok: false, status: 0, data: 'Not logged in' };
  var headers = {
    'Accept': '*/*',
    'Accept-Language': 'en-US',
    'Authorization': 'BEARER ' + a.j,
    'Content-Type': 'application/json',
    'x-user-id': a.w,
    'x-app-id': isAndroid ? 'ANDROID' : 'IOS'
  };
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
function nm(id) { return NAMES[+id] || id; }

// ── Build page ──────────────────────────────────────────────────────────────

document.open();
document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>LL Tool</title></head><body></body></html>');
document.close();

var st = document.createElement('style');
st.textContent = [
  '*{box-sizing:border-box;margin:0;padding:0}',
  'body{background:#08080e;color:#ddd;font-family:monospace;min-height:100vh}',
  '#hd{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#0d0d1a;border-bottom:1px solid #1e1e2e;position:sticky;top:0;z-index:10}',
  '#hd h1{color:#00d4ff;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;flex:1}',
  '.badge{font-size:.6rem;padding:2px 8px;border-radius:8px}',
  '.ok{background:rgba(46,213,115,.15);color:#2ed573;border:1px solid #2ed57333}',
  '.no{background:rgba(255,71,87,.15);color:#ff4757;border:1px solid #ff475733}',
  '#tabs{display:flex;background:#0d0d1a;border-bottom:1px solid #1e1e2e;position:sticky;top:45px;z-index:10}',
  '.tab{flex:1;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#555;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:monospace}',
  '.tab.on{color:#00d4ff;border-bottom-color:#00d4ff}',
  '#body{padding:16px}',
  '.pane{display:none}.pane.on{display:block}',
  'label{display:block;font-size:.6rem;color:#555;text-transform:uppercase;letter-spacing:.1em;margin:12px 0 4px}',
  'label:first-child{margin-top:0}',
  'select,input{width:100%;background:#0e0e1c;border:1px solid #2a2a3a;border-radius:6px;color:#e8e8f0;padding:11px 12px;font-family:monospace;font-size:14px;outline:none}',
  'button.btn{width:100%;margin-top:14px;padding:13px;border-radius:6px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:14px;font-weight:bold}',
  '.res{margin-top:14px;background:#050510;border:1px solid #1e1e2e;border-radius:6px;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.7;min-height:40px}',
  '.row{display:flex;gap:8px}.row>*{flex:1}',
  '.exp{padding:10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:8px}',
  '.exp-name{font-size:13px;margin-bottom:4px}',
  '.exp-meta{display:flex;gap:10px;font-size:11px;color:#555}',
  '.ll{color:#00d4ff}.wait{color:#888}.price{color:#ffd166}',
  '.guest{padding:8px 10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:6px;font-size:13px}',
  '.guest-id{font-size:10px;color:#555;word-break:break-all;margin-top:2px}',
  '.sec{font-size:.55rem;color:#555;text-transform:uppercase;letter-spacing:.12em;margin:12px 0 6px}',
  '.inelig{opacity:.45}'
].join('');
document.head.appendChild(st);

var auth = ga();

// Header
var hd = document.createElement('div'); hd.id = 'hd';
var h1 = document.createElement('h1'); h1.textContent = '⚡ LL Tool'; hd.appendChild(h1);
var badge = document.createElement('span');
badge.className = 'badge ' + (auth ? 'ok' : 'no');
badge.textContent = auth ? '✓ ' + auth.w.slice(0,8) + '...' : '✗ not logged in';
hd.appendChild(badge);
document.body.appendChild(hd);

// Tabs
var tabBar = document.createElement('div'); tabBar.id = 'tabs';
var bodyDiv = document.createElement('div'); bodyDiv.id = 'body';
document.body.appendChild(tabBar);
document.body.appendChild(bodyDiv);

var panes = {};
['tipboard','guests','offers'].forEach(function(id, i) {
  var labels = ['Tip Board','Guests','Offers'];
  var btn = document.createElement('button');
  btn.className = 'tab' + (i === 0 ? ' on' : '');
  btn.textContent = labels[i];
  btn.onclick = function() {
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
    document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('on');});
    btn.classList.add('on');
    panes[id].classList.add('on');
  };
  tabBar.appendChild(btn);
  var pane = document.createElement('div');
  pane.className = 'pane' + (i === 0 ? ' on' : '');
  pane.id = 'pane-' + id;
  panes[id] = pane;
  bodyDiv.appendChild(pane);
});

// ── Helper to build park select ─────────────────────────────────────────────
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
function lbl(txt) {
  var l = document.createElement('label'); l.textContent = txt; return l;
}
function inp(id, ph) {
  var i = document.createElement('input'); i.id = id; i.placeholder = ph||''; return i;
}
function btn(txt, fn) {
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

// ── Tip Board ───────────────────────────────────────────────────────────────
var tb = panes.tipboard;
tb.appendChild(lbl('Park'));
tb.appendChild(parkSelect('tb-park'));
var tbRow = document.createElement('div'); tbRow.className = 'row';
var tbDateWrap = document.createElement('div');
tbDateWrap.appendChild(lbl('Date'));
var tbDate = inp('tb-date'); tbDate.type = 'date'; tbDate.value = today;
tbDateWrap.appendChild(tbDate); tbRow.appendChild(tbDateWrap);
tb.appendChild(tbRow);
tb.appendChild(btn('Load Tip Board', async function() {
  loading('tb-res');
  var pk = document.getElementById('tb-park').value;
  var dt = document.getElementById('tb-date').value;
  var a = ga();
  if (!a) { showRes('tb-res', {ok:false,status:0,data:'Not logged in'}); return; }
  // Tip board is GET with params
  var url = BASE + '/tipboard-vas/planning/v1/parks/' + pk + '/experiences/?date=' + dt + '&userId=' + a.w;
  try {
    var r = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': '*/*', 'Accept-Language': 'en-US', 'Authorization': 'BEARER ' + a.j, 'x-user-id': a.w, 'x-app-id': isAndroid ? 'ANDROID' : 'IOS' },
      referrer: '', credentials: 'omit', cache: 'no-store'
    });
    var txt = await r.text(); var d; try { d = JSON.parse(txt); } catch(e) { d = txt; }
    if (r.status !== 200) { showRes('tb-res', {ok:false,status:r.status,data:d}); return; }
    var exps = (d.availableExperiences || []);
    var el = document.getElementById('tb-res');
    el.style.display = 'block'; el.style.color = '#ddd'; el.textContent = '';
    if (!exps.length) { el.textContent = 'No experiences found.'; return; }
    exps.forEach(function(e) {
      var div = document.createElement('div'); div.className = 'exp';
      var name = document.createElement('div'); name.className = 'exp-name'; name.textContent = nm(e.id); div.appendChild(name);
      var meta = document.createElement('div'); meta.className = 'exp-meta';
      var sb = e.standby || {};
      if (sb.waitTime != null) { var w = document.createElement('span'); w.className='wait'; w.textContent = sb.waitTime+'m wait'; meta.appendChild(w); }
      if (e.flex && e.flex.available) { var ll = document.createElement('span'); ll.className='ll'; ll.textContent='⚡ '+(e.flex.nextAvailableTime||'avail'); meta.appendChild(ll); }
      if (e.individual && e.individual.available) { var ip = document.createElement('span'); ip.className='price'; ip.textContent='💲 '+(e.individual.nextAvailableTime||'avail'); meta.appendChild(ip); }
      div.appendChild(meta);
      // Book button prefills offers tab
      if ((e.flex && e.flex.available) || (e.individual && e.individual.available)) {
        var bb = document.createElement('button');
        bb.style.cssText = 'margin-top:6px;padding:6px 12px;border-radius:4px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:11px';
        bb.textContent = 'Book →';
        bb.onclick = function() {
          document.getElementById('off-exp').value = e.id;
          document.getElementById('off-park').value = pk;
          document.querySelectorAll('.tab')[2].click();
        };
        div.appendChild(bb);
      }
      el.appendChild(div);
    });
  } catch(ex) { showRes('tb-res', {ok:false,status:0,data:ex.message}); }
}));
tb.appendChild(resDiv('tb-res'));

// ── Guests ───────────────────────────────────────────────────────────────────
var gu = panes.guests;
gu.appendChild(lbl('Park'));
gu.appendChild(parkSelect('gu-park'));
gu.appendChild(lbl('Facility ID (optional)'));
gu.appendChild(inp('gu-fid', 'e.g. 80010176'));
gu.appendChild(btn('Fetch Guests', async function() {
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
  // store guest ids for offers tab
  window._guestIds = g.map(function(x){return x.id;});
  if (g.length) {
    var s = document.createElement('div'); s.className='sec'; s.textContent='Eligible ('+g.length+')'; el.appendChild(s);
    g.forEach(function(guest) {
      var d = document.createElement('div'); d.className='guest';
      d.textContent = guest.firstName + ' ' + guest.lastName + (guest.primary ? ' ★' : '');
      var id = document.createElement('div'); id.className='guest-id'; id.textContent = guest.id;
      d.appendChild(id); el.appendChild(d);
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

// ── Offers ───────────────────────────────────────────────────────────────────
var of = panes.offers;
of.appendChild(lbl('Experience ID'));
of.appendChild(inp('off-exp', 'e.g. 80010176'));
of.appendChild(lbl('Park'));
of.appendChild(parkSelect('off-park'));
of.appendChild(lbl('Targeted Time'));
var offTime = inp('off-time'); offTime.value = '08:00:00'; of.appendChild(offTime);
of.appendChild(lbl('Guest IDs (auto-filled from Guests tab)'));
of.appendChild(inp('off-guests', 'comma separated, or fetch guests first'));
of.appendChild(btn('Generate Offer', async function() {
  loading('off-res');
  var expId = document.getElementById('off-exp').value.trim();
  var pk = document.getElementById('off-park').value;
  var tt = document.getElementById('off-time').value.trim() || '08:00:00';
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
