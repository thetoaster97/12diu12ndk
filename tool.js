(function() {

if (document.getElementById('_llt')) { document.getElementById('_llt').remove(); return; }

function ga() {
  var t = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('TPR-WDW-LBJS.WEB-PROD.token=');});
  if (!t) return null;
  try {
    var raw = decodeURIComponent(t.split('=').slice(1).join('='));
    var jwt = raw.split('|').pop();
    if (!jwt || !jwt.startsWith('eyJ')) return null;
    var s = document.cookie.split(';').map(function(c){return c.trim();}).find(function(c){return c.startsWith('SWID=');});
    var swid = s ? s.split('=').slice(1).join('=') : '';
    return { j: jwt, w: swid };
  } catch(e) { return null; }
}

function fmt(t) {
  if (!t) return '';
  var p = t.split(':'), h = +p[0], m = p[1];
  return (h % 12 || 12) + ':' + m + (h >= 12 ? 'pm' : 'am');
}

var BASE = 'https://disneyworld.disney.go.com';
var today = new Date().toISOString().split('T')[0];

async function req(method, path, body, params) {
  var a = ga();
  if (!a) return { ok: false, status: 0, data: 'Not logged in' };
  var url = BASE + path;
  if (params) url += '?' + new URLSearchParams(params).toString();
  var headers = { 'Accept-Language': 'en-US', 'Authorization': 'BEARER ' + a.j, 'x-user-id': a.w };
  if (body) headers['Content-Type'] = 'application/json';
  try {
    var r = await fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, referrer: '', credentials: 'omit', cache: 'no-store' });
    var ct = r.headers.get('content-type') || '';
    var d = ct.includes('application/json') ? await r.json() : await r.text();
    return { ok: r.ok, status: r.status, data: d };
  } catch(e) { return { ok: false, status: 0, data: e.message }; }
}

var auth = ga();

var st = document.createElement('style');
st.textContent = [
  '#_llt{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#08080e;font-family:monospace;font-size:13px;color:#ddd;display:flex;flex-direction:column;overflow:hidden}',
  '#_llt *{box-sizing:border-box}',
  '#_hd{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0d0d1a;border-bottom:1px solid #1e1e2e;flex-shrink:0}',
  '#_hd b{color:#00d4ff;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;flex:1}',
  '.bge{font-size:.6rem;padding:1px 8px;border-radius:8px}',
  '.bok{background:rgba(46,213,115,.15);color:#2ed573;border:1px solid #2ed57333}',
  '.bno{background:rgba(255,71,87,.15);color:#ff4757;border:1px solid #ff475733}',
  '#_tabs{display:flex;background:#0d0d1a;border-bottom:1px solid #1e1e2e;flex-shrink:0}',
  '._t{flex:1;padding:9px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#555;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:monospace}',
  '._t.on{color:#00d4ff;border-bottom-color:#00d4ff}',
  '#_bd{flex:1;overflow-y:auto;padding:14px}',
  '._pane{display:none}._pane.on{display:block}',
  '._lbl{display:block;font-size:.6rem;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 3px}',
  '._lbl:first-child{margin-top:0}',
  'select,input{width:100%;background:#0b0b16;border:1px solid #1e1e2e;border-radius:4px;color:#ddd;padding:6px 9px;font-family:monospace;font-size:13px;outline:none;margin-bottom:2px}',
  '._btn{width:100%;margin-top:10px;padding:11px;border-radius:5px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:13px;font-weight:bold}',
  '._res{margin-top:10px;background:#050510;border:1px solid #1e1e2e;border-radius:5px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;line-height:1.6;color:#555}',
  '._ok{color:#2ed573}._err{color:#ff4757}',
  '._row{display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:3px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:4px}',
  '._rn{flex:1;font-size:12px}._rw{font-size:11px;color:#555;white-space:nowrap}._rl{font-size:11px;color:#00d4ff;white-space:nowrap}',
  '._bk{font-size:10px;padding:2px 7px;border-radius:3px;cursor:pointer;background:#00d4ff0d;color:#00d4ff;border:1px solid #00d4ff25;font-family:monospace}',
  '._sec{font-size:.55rem;color:#555;text-transform:uppercase;letter-spacing:.12em;margin:8px 0 3px}',
  '._gi{font-size:10px;color:#555;word-break:break-all}'
].join('');
document.head.appendChild(st);

var ov = document.createElement('div'); ov.id = '_llt';
document.body.appendChild(ov);

// Header
var hd = document.createElement('div'); hd.id = '_hd';
hd.innerHTML = '<b>⚡ LL Tool</b><span class="bge ' + (auth ? 'bok' : 'bno') + '">' + (auth ? '✓ logged in' : '✗ not logged in') + '</span>';
ov.appendChild(hd);

// Tabs
var tabBar = document.createElement('div'); tabBar.id = '_tabs';
var body = document.createElement('div'); body.id = '_bd';
ov.appendChild(tabBar);
ov.appendChild(body);

var panes = {};
[['tb','Tip Board'],['gu','Guests'],['of','Offers']].forEach(function(t, i) {
  var btn = document.createElement('button'); btn.className = '_t' + (i===0?' on':''); btn.textContent = t[1];
  btn.onclick = function() {
    document.querySelectorAll('._t').forEach(function(x){x.classList.remove('on');});
    document.querySelectorAll('._pane').forEach(function(x){x.classList.remove('on');});
    btn.classList.add('on'); panes[t[0]].classList.add('on');
  };
  tabBar.appendChild(btn);
  var p = document.createElement('div'); p.className = '_pane' + (i===0?' on':''); panes[t[0]] = p; body.appendChild(p);
});

function lbl(txt) { var l=document.createElement('label');l.className='_lbl';l.textContent=txt;return l; }
function sel(id) {
  var s=document.createElement('select');s.id=id;
  [['80007944','Magic Kingdom'],['80007838','EPCOT'],['80007998','Hollywood Studios'],['80007823','Animal Kingdom']].forEach(function(o){
    var op=document.createElement('option');op.value=o[0];op.textContent=o[1];s.appendChild(op);
  });
  return s;
}
function inp(id,ph) { var i=document.createElement('input');i.id=id;if(ph)i.placeholder=ph;return i; }
function btn(txt,fn) { var b=document.createElement('button');b.className='_btn';b.textContent=txt;b.onclick=fn;return b; }
function res(id) { var d=document.createElement('div');d.className='_res';d.id=id;d.style.display='none';return d; }
function loading(id) { var e=document.getElementById(id);e.style.display='block';e.className='_res';e.textContent='Loading…'; }
function show(id, r) {
  var e=document.getElementById(id);e.style.display='block';
  e.className='_res '+(r.ok?'_ok':'_err');
  e.textContent='['+r.status+']\n'+(typeof r.data==='string'?r.data:JSON.stringify(r.data,null,2));
}

// ── Tip Board ────────────────────────────────────────────────────────────────
panes.tb.appendChild(lbl('Park')); panes.tb.appendChild(sel('tb-pk'));
panes.tb.appendChild(btn('Load', async function() {
  loading('tb-r');
  var pk = document.getElementById('tb-pk').value;
  var a = ga(); if (!a) { show('tb-r',{ok:false,status:0,data:'Not logged in'}); return; }
  var r = await req('GET', '/tipboard-vas/planning/v1/parks/'+pk+'/experiences/', null, { date: today, userId: encodeURIComponent(a.w) });
  var el = document.getElementById('tb-r');
  if (!r.ok) { show('tb-r', r); return; }
  el.style.display='block'; el.className='_res'; el.textContent='';
  var exps = r.data.availableExperiences || [];
  exps.forEach(function(e) {
    var row = document.createElement('div'); row.className='_row';
    var sb = e.standby || {};
    var wait = sb.waitTime != null ? sb.waitTime+'m' : (!sb.available ? (sb.unavailableReason||'CLOSED').replace(/_/g,' ') : '');
    var ll = '';
    if (e.flex && e.flex.available) ll = '⚡ ' + fmt(e.flex.nextAvailableTime);
    else if (e.flex) ll = '⚡ N/A';
    if (e.individual) ll = (e.individual.available ? '💲 '+fmt(e.individual.nextAvailableTime) : '💲 sold');
    var canBook = (e.flex&&e.flex.available)||(e.individual&&e.individual.available);
    row.innerHTML = '<span class="_rn">'+(e.id)+'</span><span class="_rw">'+wait+'</span>'+(ll?'<span class="_rl">'+ll+'</span>':'')+(canBook?'<button class="_bk" data-id="'+e.id+'" data-pk="'+pk+'">book</button>':'');
    el.appendChild(row);
  });
  if (!exps.length) el.textContent = 'No data.';
  el.querySelectorAll('._bk').forEach(function(b) { b.onclick = function() {
    document.getElementById('of-exp').value = b.dataset.id;
    document.getElementById('of-pk').value = b.dataset.pk;
    document.querySelectorAll('._t')[2].click();
  };});
}));
panes.tb.appendChild(res('tb-r'));

// ── Guests ────────────────────────────────────────────────────────────────────
panes.gu.appendChild(lbl('Park')); panes.gu.appendChild(sel('gu-pk'));
panes.gu.appendChild(btn('Fetch Guests', async function() {
  loading('gu-r');
  var r = await req('POST', '/ea-vas/planning/api/v1/experiences/guest/guests', { date: today, facilityId: null, parkId: document.getElementById('gu-pk').value });
  var el = document.getElementById('gu-r');
  if (!r.ok) { show('gu-r', r); return; }
  var g = r.data.guests||[], ig = r.data.ineligibleGuests||[];
  window._gids = g.map(function(x){return x.id;});
  el.style.display='block'; el.className='_res'; el.textContent='';
  if (g.length) {
    var s=document.createElement('div');s.className='_sec';s.textContent='Eligible ('+g.length+')';el.appendChild(s);
    g.forEach(function(x){
      var d=document.createElement('div');d.className='_row';
      d.innerHTML='<span class="_rn">'+x.firstName+' '+x.lastName+(x.primary?' ★':'')+'</span><span class="_gi">'+x.id.slice(0,16)+'…</span>';
      el.appendChild(d);
    });
  }
  if (ig.length) {
    var s2=document.createElement('div');s2.className='_sec';s2.textContent='Ineligible ('+ig.length+')';el.appendChild(s2);
    ig.forEach(function(x){
      var reason=((x.ineligibleReason&&x.ineligibleReason.ineligibleReason)||x.ineligibleReason||'').replace(/_/g,' ');
      var d=document.createElement('div');d.className='_row';d.style.opacity='.4';
      d.innerHTML='<span class="_rn">'+x.firstName+' '+x.lastName+'</span><span class="_rw">'+reason+'</span>';
      el.appendChild(d);
    });
  }
  if (!el.children.length) el.textContent='No guests found.';
}));
panes.gu.appendChild(res('gu-r'));

// ── Offers ────────────────────────────────────────────────────────────────────
panes.of.appendChild(lbl('Experience ID')); panes.of.appendChild(inp('of-exp','e.g. 80010176'));
panes.of.appendChild(lbl('Park')); panes.of.appendChild(sel('of-pk'));
panes.of.appendChild(btn('Get Offer', async function() {
  loading('of-r');
  var g = window._gids||[];
  if (!g.length) { show('of-r',{ok:false,status:0,data:'Fetch guests first'}); return; }
  var r = await req('POST', '/ea-vas/planning/api/v1/experiences/offerset/generate', {
    date: today, parkId: document.getElementById('of-pk').value,
    experienceIds: [document.getElementById('of-exp').value.trim()],
    guestIds: g, targetedTime: '08:00:00', ignoredBookedExperienceIds: null
  });
  show('of-r', r);
}));
panes.of.appendChild(res('of-r'));

})();