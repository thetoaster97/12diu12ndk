(function() {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  var _auth = null;
  var _oneIdClient = null;
  var _oneIdClientId = '';
  var ONEID_SCRIPT_URL = 'https://cdn.registerdisney.go.com/v4/OneID.js';
  var ONEID_SCRIPT_ID = 'oneid-script';
  var ONEID_RESPONDER = 'https://joelface.github.io/bg1/responder.html';

  function authReady() { return !!(_auth && _auth.accessToken && Date.now() < _auth.expires); }
  function getOneIdOs() { return navigator.userAgent.indexOf('Android') !== -1 ? 'AND' : 'IOS'; }
  function getClientId(r) { return 'TPR-' + r + '-LBSDK.' + getOneIdOs(); }

  function setBadgeOk() {
    var b = document.getElementById('auth-badge'); if (!b || !_auth) return;
    b.textContent = '✓ ' + String(_auth.swid || '').replace(/[{}]/g, '').slice(0, 8) + '...';
    b.className = 'badge ok';
  }
  function setBadgeErr(msg) {
    var b = document.getElementById('auth-badge'); if (!b) return;
    b.textContent = '✗ ' + msg; b.className = 'badge no';
  }
  function clearOneIdGuestData() {
    try { if (_oneIdClientId) localStorage.removeItem(_oneIdClientId + '-PROD.guest'); } catch(e) {}
  }
  function setAuthFromToken(token) {
    if (!token || !token.access_token) throw new Error('Login did not return access_token');
    _auth = { accessToken: token.access_token, swid: token.swid, expires: new Date(token.exp).getTime() };
    clearOneIdGuestData(); setBadgeOk(); return _auth;
  }
  function loadOneIdScript() {
    return new Promise(function(resolve, reject) {
      if (window.OneID) { resolve(window.OneID); return; }
      var ex = document.getElementById(ONEID_SCRIPT_ID);
      if (ex) {
        var n=0,t=setInterval(function(){n++;if(window.OneID){clearInterval(t);resolve(window.OneID);}else if(n>150){clearInterval(t);reject(new Error('Timed out'));}},100); return;
      }
      var s=document.createElement('script');s.id=ONEID_SCRIPT_ID;s.src=ONEID_SCRIPT_URL;
      s.onload=function(){var n=0,t=setInterval(function(){n++;if(window.OneID){clearInterval(t);resolve(window.OneID);}else if(n>150){clearInterval(t);reject(new Error('Timed out'));}},100);};
      s.onerror=function(){reject(new Error('Failed to load OneID.js'));};
      document.head.appendChild(s);
    });
  }
  function oneIdShape(o){if(!o)return'missing';if(typeof o.get==='function')return'client';if(typeof o.launchLogin==='function')return'direct';return'unknown';}
  async function getOneIdClient(resortId) {
    if (_oneIdClient) return _oneIdClient;
    var oneid=await loadOneIdScript(); _oneIdClientId=getClientId(resortId);
    if(typeof oneid.get!=='function') throw new Error('OneID.get unavailable');
    var client=oneid.get({clientId:_oneIdClientId,responderPage:ONEID_RESPONDER});
    if(!client||typeof client.init!=='function') throw new Error('Invalid OneID client');
    await client.init(); _oneIdClient=client; clearOneIdGuestData(); return client;
  }
  function doLogin() {
    return new Promise(async function(resolve, reject) {
      try {
        var resortId='WDW',oneid=await loadOneIdScript(),shape=oneIdShape(oneid);
        _oneIdClientId=getClientId(resortId);
        if (shape==='client') {
          var client=await getOneIdClient(resortId),settled=false;
          function doneOk(v){if(settled)return;settled=true;resolve(v);}
          function doneErr(e){if(settled)return;settled=true;reject(e);}
          function onLogin(d){try{doneOk(setAuthFromToken(d&&d.token));}catch(e){doneErr(e);}}
          function onError(e){doneErr(new Error((e&&e.message)||'Login failed'));}
          try{if(typeof client.off==='function'){try{client.off('login',onLogin);}catch(e){}try{client.off('error',onError);}catch(e){}}}catch(e){}
          if(typeof client.on==='function'){client.on('login',onLogin);client.on('error',onError);}
          client.launchLogin(); return;
        }
        if (shape==='direct') {
          oneid.launchLogin(resortId,function(res){
            try{var t=(res&&res.token)?res.token:res;resolve(setAuthFromToken(t));}catch(e){reject(e);}
          },{clientId:_oneIdClientId,responderPage:ONEID_RESPONDER}); return;
        }
        reject(new Error('Unsupported OneID runtime'));
      } catch(e){reject(e);}
    });
  }
  function ga(){return authReady()?_auth:null;}

  // ── API ──────────────────────────────────────────────────────────────────────
  var BASE='https://disneyworld.disney.go.com';
  var today=new Date().toISOString().split('T')[0];

  async function getSensor(){
    try{
      var r=await fetch('https://bg1.joelface.com/sensor-data/random',{cache:'no-store'});
      var t=await r.text();
      try{var sd=JSON.parse(t);t=Object.values(sd)[0]||t;}catch(e){}
      return String(t||'').trim();
    }catch(e){return '';}
  }

  async function api(path,body){
    var a=ga();
    if(!a) return{ok:false,status:0,data:'Not logged in — press Login first'};
    var sensor=await getSensor();
    var headers={'Accept':'*/*','Accept-Language':'en-US','Authorization':'BEARER '+a.accessToken,
      'Content-Type':'application/json','x-user-id':a.swid,'x-app-id':'ANDROID','x-acf-sensor-data':sensor};
    try{
      var r=await fetch(BASE+path,{method:'POST',headers:headers,body:JSON.stringify(body),referrer:'',credentials:'omit',cache:'no-store'});
      var txt=await r.text(),d;try{d=JSON.parse(txt);}catch(e){d=txt;}
      return{ok:r.status===200,status:r.status,data:d};
    }catch(e){return{ok:false,status:0,data:e.message};}
  }

  async function apiGet(path){
    var a=ga();
    if(!a) return{ok:false,status:0,data:'Not logged in'};
    var headers={'Accept':'*/*','Accept-Language':'en-US','Authorization':'BEARER '+a.accessToken,'x-user-id':a.swid};
    try{
      var r=await fetch(BASE+path,{method:'GET',headers:headers,referrer:'',credentials:'omit',cache:'no-store'});
      var txt=await r.text(),d;try{d=JSON.parse(txt);}catch(e){d=txt;}
      return{ok:r.status===200,status:r.status,data:d};
    }catch(e){return{ok:false,status:0,data:e.message};}
  }

  var PARKS=[['80007944','Magic Kingdom'],['80007838','EPCOT'],['80007998','Hollywood Studios'],['80007823','Animal Kingdom']];
  var NAMES={
    80010107:'Astro Orbiter',16491297:'Barnstormer',80010110:'Big Thunder Mountain',
    80010114:'Buzz Lightyear',80010208:'Haunted Mansion',80010149:"It's a Small World",
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
  var DYNAMIC_NAMES={},namesLoaded=false;
  async function loadAttractionNames(){
    if(namesLoaded)return;
    try{
      var r=await fetch(BASE+'/finder/api/v1/explorer-service/list-ancestor-entities/wdw/80007798;entityType=destination/'+today+'/attractions',
        {method:'GET',headers:{'Accept-Language':'en-US'},referrer:'',credentials:'omit',cache:'no-store'});
      if(!r.ok)return;
      var d=await r.json();
      (d.results||[]).forEach(function(item){
        var numId=parseInt(String(item.id||item.facilityId||'').split(';')[0],10);
        if(numId&&item.name)DYNAMIC_NAMES[numId]=item.name;
      });namesLoaded=true;
    }catch(e){}
  }
  function nm(id){var n=+id;return DYNAMIC_NAMES[n]||NAMES[n]||String(id);}

  function fmtTime(t){
    // handles "HH:MM:SS", "HH:MM", or ISO
    try{
      var s=t.includes('T')?t.split('T')[1]:t;
      var parts=s.split(':');var h=+parts[0],m=parts[1];
      var ap=h>=12?'pm':'am';h=h%12||12;return h+':'+m+ap;
    }catch(e){return t;}
  }

  // ── Build page ───────────────────────────────────────────────────────────────
  document.open();
  document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>LL Tool</title></head><body></body></html>');
  document.close();

  var st=document.createElement('style');
  st.textContent=[
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
    'button.btn:disabled{opacity:.5;cursor:not-allowed}',
    'button.btn-warn{width:100%;padding:13px;border-radius:6px;border:1px solid #ffd16633;background:rgba(255,209,102,.1);color:#ffd166;cursor:pointer;font-family:monospace;font-size:14px;font-weight:bold}',
    'button.btn-warn:disabled{opacity:.5;cursor:not-allowed}',
    '#tb-sticky{position:fixed;bottom:0;left:0;right:0;padding:10px 16px 14px;background:linear-gradient(transparent,#08080e 35%);z-index:20;display:none}',
    '#tb-sticky.vis{display:block}',
    '.res{margin-top:14px;background:#050510;border:1px solid #1e1e2e;border-radius:6px;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-all;line-height:1.7;min-height:40px}',
    '.row{display:flex;gap:8px}.row>*{flex:1}',
    '.exp{padding:10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:8px}',
    '.exp-name{font-size:13px;margin-bottom:4px}',
    '.exp-meta{display:flex;gap:10px;font-size:11px;color:#555;flex-wrap:wrap}',
    '.ll{color:#00d4ff}.wait{color:#888}.price{color:#ffd166}',
    '.sec{font-size:.55rem;color:#555;text-transform:uppercase;letter-spacing:.12em;margin:12px 0 6px}',
    '.filter-row{display:flex;align-items:center;gap:8px;margin:10px 0 6px;cursor:pointer}',
    '.filter-row input[type=checkbox]{width:15px;height:15px;accent-color:#00d4ff;cursor:pointer;flex-shrink:0}',
    '.filter-row span{font-size:.65rem;color:#888;text-transform:uppercase;letter-spacing:.1em}',
    // Book pane
    '#bk-back{background:none;border:none;color:#00d4ff;font-family:monospace;font-size:.65rem;cursor:pointer;padding:0 0 10px 0;display:block}',
    '#bk-ride-name{font-size:16px;color:#e8e8f0;font-weight:bold;margin-bottom:6px}',
    '#bk-status{font-size:24px;font-weight:bold;margin:10px 0 4px}',
    '.bk-avail{color:#00d4ff}.bk-unavail{color:#555}.bk-multi{color:#ffd166}.bk-err{color:#ff4757}',
    '.bk-section{margin-top:18px;padding-top:14px;border-top:1px solid #1e1e2e}',
    '.bk-section-title{font-size:.55rem;color:#555;text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px}',
    '.guest-row{display:flex;align-items:center;gap:10px;padding:8px 10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:6px}',
    '.guest-row input[type=checkbox]{width:15px;height:15px;accent-color:#00d4ff;cursor:pointer;flex-shrink:0}',
    '.guest-name{font-size:13px;flex:1}',
    '.guest-reason{font-size:10px;color:#ffd166;margin-top:2px}',
    '.guest-inelig{opacity:.5}',
    '.time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}',
    '.time-btn{padding:10px 4px;border-radius:6px;border:1px solid #2a2a3a;background:#0e0e1c;color:#ddd;cursor:pointer;font-family:monospace;font-size:12px;text-align:center}',
    '.time-btn.sel{border-color:#00d4ff;background:rgba(0,212,255,.15);color:#00d4ff;font-weight:bold}',
    '.time-btn:disabled{opacity:.35;cursor:not-allowed}',
    '.bk-raw{display:none;margin-top:10px;background:#050510;border:1px solid #1e1e2e;border-radius:6px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;line-height:1.6}',
    '.btn-row{display:flex;gap:8px;margin-top:12px}.btn-row>*{flex:1}',
    // Plan
    '.plan-item{padding:10px;background:#0d0d1a;border:1px solid #1e1e2e;border-radius:6px;margin-bottom:8px}',
    '.plan-item-name{font-size:13px;margin-bottom:3px}',
    '.plan-item-meta{font-size:11px;color:#555;display:flex;gap:10px;flex-wrap:wrap}',
    '.plan-date{color:#00d4ff}.plan-guests{color:#2ed573;font-size:10px;margin-top:3px}'
  ].join('');
  document.head.appendChild(st);

  // ── Header ───────────────────────────────────────────────────────────────────
  var hd=document.createElement('div');hd.id='hd';
  var h1el=document.createElement('h1');h1el.textContent='⚡ LL Tool';hd.appendChild(h1el);
  var authBadge=document.createElement('span');authBadge.id='auth-badge';authBadge.className='badge no';authBadge.textContent='✗ not logged in';hd.appendChild(authBadge);
  var loginBtn=document.createElement('button');
  loginBtn.style.cssText='padding:4px 10px;border-radius:6px;border:1px solid #00d4ff44;background:rgba(0,212,255,.12);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:.6rem;font-weight:bold';
  loginBtn.textContent='Login';
  loginBtn.onclick=function(){
    loginBtn.textContent='...';loginBtn.disabled=true;
    doLogin().then(function(){loginBtn.textContent='Re-login';loginBtn.disabled=false;})
      .catch(function(e){setBadgeErr((e&&e.message)||'failed');loginBtn.textContent='Login';loginBtn.disabled=false;});
  };
  hd.appendChild(loginBtn);
  var namesBadge=document.createElement('span');namesBadge.className='badge info';namesBadge.textContent='⟳ names';hd.appendChild(namesBadge);
  document.body.appendChild(hd);
  loadAttractionNames().then(function(){
    var c=Object.keys(DYNAMIC_NAMES).length;
    namesBadge.textContent=c>0?'✓ '+c+' rides':'✗ names';
    namesBadge.className='badge '+(c>0?'ok':'no');
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  var tabBar=document.createElement('div');tabBar.id='tabs';
  var bodyDiv=document.createElement('div');bodyDiv.id='body';
  document.body.appendChild(tabBar);document.body.appendChild(bodyDiv);
  var panes={},stickyBar;
  ['tipboard','book','plan'].forEach(function(id,i){
    var labels=['Tip Board','Book','Plan'];
    var b=document.createElement('button');
    b.className='tab'+(i===0?' on':'');b.textContent=labels[i];
    b.onclick=function(){
      document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
      document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('on');});
      b.classList.add('on');panes[id].classList.add('on');
      if(stickyBar)stickyBar.className=id==='tipboard'?'vis':'';
    };
    tabBar.appendChild(b);
    var pane=document.createElement('div');pane.className='pane'+(i===0?' on':'');pane.id='pane-'+id;
    panes[id]=pane;bodyDiv.appendChild(pane);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function parkSelect(id,sel){
    var s=document.createElement('select');s.id=id;
    PARKS.forEach(function(p,i){var o=document.createElement('option');o.value=p[0];o.textContent=p[1];if(i===(sel||0))o.selected=true;s.appendChild(o);});
    return s;
  }
  function lbl(txt,forId){var l=document.createElement('label');l.textContent=txt;if(forId)l.htmlFor=forId;return l;}
  function inp(id,ph){var i=document.createElement('input');i.id=id;i.placeholder=ph||'';return i;}
  function mkbtn(txt,cls,fn){var b=document.createElement('button');b.className=cls;b.textContent=txt;b.onclick=fn;return b;}
  function resDiv(id){var d=document.createElement('div');d.className='res';d.id=id;d.style.display='none';return d;}
  function showRes(id,r){
    var el=document.getElementById(id);el.style.display='block';
    el.style.color=r.ok?'#2ed573':'#ff4757';
    el.textContent='['+r.status+']\n'+(typeof r.data==='string'?r.data:JSON.stringify(r.data,null,2));
  }
  function loading(id){var el=document.getElementById(id);el.style.display='block';el.style.color='#aaa';el.textContent='Loading...';}

  // ── Book Pane State ───────────────────────────────────────────────────────────
  var _bk={expId:null,parkId:null,rideName:'',eligGuests:[],ineligGuests:[],selGuests:{},offerSetId:null,offers:[],selOffer:null};

  function switchToBook(expId,parkId,rideName){
    _bk.expId=expId;_bk.parkId=parkId;_bk.rideName=rideName;
    _bk.eligGuests=[];_bk.ineligGuests=[];_bk.selGuests={};
    _bk.offerSetId=null;_bk.offers=[];_bk.selOffer=null;
    document.querySelectorAll('.tab')[1].click();
    buildBookPane();
    fetchAndRenderGuests();
  }

  function buildBookPane(){
    var pane=panes.book; pane.innerHTML='';

    // Back button
    var back=document.createElement('button');back.id='bk-back';back.textContent='← Tip Board';
    back.onclick=function(){document.querySelectorAll('.tab')[0].click();};
    pane.appendChild(back);

    // Ride name
    var rname=document.createElement('div');rname.id='bk-ride-name';rname.textContent=_bk.rideName||nm(_bk.expId);
    pane.appendChild(rname);

    // Status line (earliest time / unavailable / multipass)
    var status=document.createElement('div');status.id='bk-status';status.textContent='Checking...';
    pane.appendChild(status);

    // Raw response box (hidden initially)
    var raw=document.createElement('div');raw.className='bk-raw';raw.id='bk-raw';
    pane.appendChild(raw);

    // Party section
    var partySec=document.createElement('div');partySec.className='bk-section';
    var partyTitle=document.createElement('div');partyTitle.className='bk-section-title';partyTitle.textContent='Your Party';
    partySec.appendChild(partyTitle);
    var partyList=document.createElement('div');partyList.id='bk-party';partyList.textContent='Loading...';
    partySec.appendChild(partyList);
    pane.appendChild(partySec);

    // Time section
    var timeSec=document.createElement('div');timeSec.className='bk-section';
    var timeTitle=document.createElement('div');timeTitle.className='bk-section-title';timeTitle.textContent='Return Time';
    timeSec.appendChild(timeTitle);
    var timeGrid=document.createElement('div');timeGrid.className='time-grid';timeGrid.id='bk-times';
    timeGrid.textContent='—';
    timeSec.appendChild(timeGrid);
    pane.appendChild(timeSec);

    // Buttons
    var btnRow=document.createElement('div');btnRow.className='btn-row';

    var bookBtn=mkbtn('Book LL','btn',async function(){
      if(!_bk.selOffer){showRaw('Select a return time first','#ff4757');return;}
      bookBtn.textContent='Booking...';bookBtn.disabled=true;
      var selIds=getSelIds();
      var r=await api('/ea-vas/planning/api/v1/experiences/offerset/times/fulfill',{
        date:today,parkId:_bk.parkId,
        offerSetId:_bk.offerSetId,
        offerId:_bk.selOffer.id||_bk.selOffer.offerId,
        guestIds:selIds
      });
      bookBtn.textContent='Book LL';bookBtn.disabled=false;
      showRaw(JSON.stringify(r.data,null,2),r.ok?'#2ed573':'#ff4757');
    });
    btnRow.appendChild(bookBtn);

    var modBtn=mkbtn('Modify Existing','btn-warn',async function(){
      modBtn.textContent='Loading...';modBtn.disabled=true;
      var selIds=getSelIds();
      var r=await api('/ea-vas/planning/api/v1/experiences/mod/offerset/generate',{
        date:today,parkId:_bk.parkId,
        experienceIds:[_bk.expId],
        guestIds:selIds,
        targetedTime:'08:00:00'
      });
      modBtn.textContent='Modify Existing';modBtn.disabled=false;
      if(!r.ok){showRaw(JSON.stringify(r.data,null,2),'#ff4757');return;}
      _bk.offerSetId=r.data.offerSetId;
      _bk.offers=r.data.offers||[];
      _bk.selOffer=null;
      renderTimes();
      if(_bk.offers.length){
        setStatus('Mod times loaded — pick one','bk-avail');
      }else{
        setStatus('No mod times available','bk-unavail');
      }
      showRaw(JSON.stringify(r.data,null,2),'#2ed573');
    });
    btnRow.appendChild(modBtn);
    pane.appendChild(btnRow);
  }

  function getSelIds(){
    return Object.keys(_bk.selGuests).filter(function(k){return _bk.selGuests[k];});
  }

  function setStatus(txt,cls){
    var el=document.getElementById('bk-status');if(!el)return;
    el.textContent=txt;el.className=cls||'';
  }

  function showRaw(txt,color){
    var el=document.getElementById('bk-raw');if(!el)return;
    el.style.display='block';el.style.color=color||'#ddd';el.textContent=txt;
  }

  async function fetchAndRenderGuests(){
    var r=await api('/ea-vas/planning/api/v1/experiences/guest/guests',{
      date:today,facilityId:String(_bk.expId),parkId:String(_bk.parkId)
    });
    if(!r.ok){
      setStatus('Error fetching guests','bk-err');
      showRaw(JSON.stringify(r.data,null,2),'#ff4757');
      return;
    }

    _bk.eligGuests=r.data.guests||[];
    _bk.ineligGuests=r.data.ineligibleGuests||[];

    // Default all eligible guests selected
    _bk.selGuests={};
    _bk.eligGuests.forEach(function(g){_bk.selGuests[g.id]=true;});

    renderParty();

    // Determine status
    if(_bk.eligGuests.length===0){
      var reasons=(_bk.ineligGuests).map(function(g){
        return (g.ineligibleReason&&g.ineligibleReason.ineligibleReason)||'';
      });
      var allMulti=reasons.length>0&&reasons.every(function(r){return r==='MULTI_PASS_NEEDED';});
      if(allMulti){
        setStatus('⚠ Multipass Needed','bk-multi');
      }else{
        setStatus('Unavailable','bk-unavail');
      }
      // Show full guests response
      showRaw(JSON.stringify(r.data,null,2),'#ffd166');
    }else{
      await doGenerateOffer();
    }
  }

  function renderParty(){
    var list=document.getElementById('bk-party');if(!list)return;
    list.innerHTML='';
    var all=_bk.eligGuests.concat(_bk.ineligGuests);
    if(!all.length){list.textContent='No guests found.';return;}
    all.forEach(function(g){
      var isElig=_bk.eligGuests.indexOf(g)!==-1;
      var row=document.createElement('div');row.className='guest-row'+(isElig?'':' guest-inelig');
      var cb=document.createElement('input');cb.type='checkbox';
      cb.checked=isElig&&!!_bk.selGuests[g.id];cb.disabled=!isElig;
      cb.onchange=function(){
        _bk.selGuests[g.id]=cb.checked;
        doGenerateOffer();
      };
      row.appendChild(cb);
      var wrap=document.createElement('div');wrap.style.flex='1';
      var nameEl=document.createElement('div');nameEl.className='guest-name';
      nameEl.textContent=(g.firstName||'')+' '+(g.lastName||'')+(g.primary?' ★':'');
      wrap.appendChild(nameEl);
      if(!isElig&&g.ineligibleReason){
        var reason=document.createElement('div');reason.className='guest-reason';
        reason.textContent=String(g.ineligibleReason.ineligibleReason||g.ineligibleReason||'').replace(/_/g,' ');
        wrap.appendChild(reason);
      }
      row.appendChild(wrap);
      list.appendChild(row);
    });
  }

  async function doGenerateOffer(){
    var selIds=getSelIds();
    if(!selIds.length){setStatus('No guests selected','bk-unavail');renderTimes();return;}
    setStatus('Checking times...','');
    var r=await api('/ea-vas/planning/api/v1/experiences/offerset/generate',{
      date:today,parkId:_bk.parkId,
      experienceIds:[_bk.expId],
      guestIds:selIds,
      targetedTime:'08:00:00',
      ignoredBookedExperienceIds:null
    });
    if(!r.ok){
      setStatus('No times available','bk-unavail');
      showRaw(JSON.stringify(r.data,null,2),'#ff4757');
      return;
    }
    document.getElementById('bk-raw').style.display='none';
    _bk.offerSetId=r.data.offerSetId;
    _bk.offers=r.data.offers||(r.data.offer?[r.data.offer]:[]);
    _bk.selOffer=null;

    // Find earliest time across all offers
    var earliest=null;
    _bk.offers.forEach(function(o){
      var t=o.startDateTime||o.startTime||(o.flex&&o.flex.nextAvailableTime);
      if(t&&(!earliest||t<earliest))earliest=t;
    });

    if(_bk.offers.length===0){
      setStatus('Unavailable','bk-unavail');
    }else if(earliest){
      setStatus('⚡ Next: '+fmtTime(earliest),'bk-avail');
    }else{
      setStatus('⚡ Available','bk-avail');
    }
    renderTimes();
  }

  function renderTimes(){
    var grid=document.getElementById('bk-times');if(!grid)return;
    grid.innerHTML='';
    if(!_bk.offers.length){grid.textContent='No times available';return;}
    _bk.offers.forEach(function(offer){
      var t=offer.startDateTime||offer.startTime||(offer.flex&&offer.flex.nextAvailableTime)||'?';
      var btn=document.createElement('button');
      btn.className='time-btn'+(_bk.selOffer===offer?' sel':'');
      btn.textContent=fmtTime(t);
      btn.onclick=function(){_bk.selOffer=offer;renderTimes();};
      grid.appendChild(btn);
    });
  }

  // ── Tip Board ────────────────────────────────────────────────────────────────
  var tb=panes.tipboard;
  tb.appendChild(lbl('Park'));tb.appendChild(parkSelect('tb-park'));
  var tbRow=document.createElement('div');tbRow.className='row';
  var tbDW=document.createElement('div');tbDW.appendChild(lbl('Date'));
  var tbDate=inp('tb-date');tbDate.type='date';tbDate.value=today;
  tbDW.appendChild(tbDate);tbRow.appendChild(tbDW);tb.appendChild(tbRow);
  var fRow=document.createElement('label');fRow.className='filter-row';
  var fCb=document.createElement('input');fCb.type='checkbox';fCb.id='tb-ll-only';
  var fSp=document.createElement('span');fSp.textContent='Lightning Lane only';
  fRow.appendChild(fCb);fRow.appendChild(fSp);tb.appendChild(fRow);
  tb.appendChild(resDiv('tb-res'));

  async function doLoadTipBoard(){
    var scrollY=window.scrollY;
    await loadAttractionNames();
    var pk=document.getElementById('tb-park').value,dt=document.getElementById('tb-date').value;
    var llOnly=document.getElementById('tb-ll-only').checked,a=ga();
    var el=document.getElementById('tb-res');
    el.style.display='block';el.style.color='#aaa';el.textContent='Loading...';
    if(!a){showRes('tb-res',{ok:false,status:0,data:'Not logged in — press Login first'});return;}
    try{
      var r=await fetch(BASE+'/tipboard-vas/planning/v1/parks/'+pk+'/experiences/?date='+dt+'&userId='+encodeURIComponent(a.swid),{
        method:'GET',
        headers:{'Accept':'*/*','Accept-Language':'en-US','Authorization':'BEARER '+a.accessToken,'x-user-id':a.swid,'x-app-id':'ANDROID'},
        referrer:'',credentials:'omit',cache:'no-store'
      });
      var txt=await r.text(),d;try{d=JSON.parse(txt);}catch(e){d=txt;}
      if(r.status!==200){showRes('tb-res',{ok:false,status:r.status,data:d});return;}
      var exps=d.availableExperiences||[];
      if(llOnly)exps=exps.filter(function(e){return(e.flex&&e.flex.available)||(e.individual&&e.individual.available);});
      el.style.color='#ddd';el.textContent='';
      if(!exps.length){el.textContent=llOnly?'No LL times available right now.':'No experiences found.';return;}
      exps.forEach(function(e){
        var div=document.createElement('div');div.className='exp';
        var name=document.createElement('div');name.className='exp-name';name.textContent=nm(e.id);div.appendChild(name);
        var meta=document.createElement('div');meta.className='exp-meta';
        var sb=e.standby||{};
        if(sb.waitTime!=null){var w=document.createElement('span');w.className='wait';w.textContent=sb.waitTime+'m wait';meta.appendChild(w);}
        if(e.flex&&e.flex.available){
          var ll=document.createElement('span');ll.className='ll';
          var t=e.flex.nextAvailableTime;
          if(t){var pts=t.split(':');var h=+pts[0];var ap=h>=12?'pm':'am';h=h%12||12;ll.textContent='⚡ '+h+':'+pts[1]+ap;}
          else{ll.textContent='⚡ avail';}
          meta.appendChild(ll);
        }
        if(e.individual&&e.individual.available){
          var ip=document.createElement('span');ip.className='price';
          ip.textContent='💲 '+(e.individual.nextAvailableTime||'avail');meta.appendChild(ip);
        }
        div.appendChild(meta);
        if((e.flex&&e.flex.available)||(e.individual&&e.individual.available)){
          var bb=document.createElement('button');
          bb.style.cssText='margin-top:6px;padding:6px 12px;border-radius:4px;border:1px solid #00d4ff33;background:rgba(0,212,255,.1);color:#00d4ff;cursor:pointer;font-family:monospace;font-size:11px';
          bb.textContent='Book →';
          bb.onclick=(function(expId,parkId,rideName){return function(){switchToBook(expId,parkId,rideName);};})(e.id,pk,nm(e.id));
          div.appendChild(bb);
        }
        el.appendChild(div);
      });
      window.scrollTo(0,scrollY);
    }catch(ex){showRes('tb-res',{ok:false,status:0,data:ex.message});}
  }

  stickyBar=document.createElement('div');stickyBar.id='tb-sticky';stickyBar.className='vis';
  stickyBar.appendChild(mkbtn('Load Tip Board','btn',doLoadTipBoard));
  document.body.appendChild(stickyBar);

  // ── Plan ─────────────────────────────────────────────────────────────────────
  var pl=panes.plan;
  pl.appendChild(lbl('Date'));
  var plDate=inp('pl-date');plDate.type='date';plDate.value=today;pl.appendChild(plDate);
  pl.appendChild(mkbtn('Load Plan','btn',async function(){
    loading('pl-res');var a=ga();
    if(!a){showRes('pl-res',{ok:false,status:0,data:'Not logged in'});return;}
    var dt=document.getElementById('pl-date').value,swidEnc=encodeURIComponent(a.swid);
    var path='/plan/wdw-itinerary-api/api/v1/itinerary-items/'+swidEnc+
      '?item-types=FASTPASS&item-types=DINING&item-types=ACTIVITY&item-types=VIRTUAL_QUEUE_POSITION'+
      '&destination=WDW&fields=items%2Cprofiles%2Cassets%2CloggedInGuestId'+
      '&guest-locators='+swidEnc+'%3Btype%3Dswid'+
      '&guest-locator-groups=MY_FAMILY&start-date='+dt+'&show-friends=false';
    var r=await apiGet(path);
    var el=document.getElementById('pl-res');el.style.display='block';el.style.color='#ddd';el.textContent='';
    if(!r.ok){showRes('pl-res',r);return;}
    var items=r.data.items||[],profiles=r.data.profiles||{},assets=r.data.assets||{};
    if(!items.length){el.textContent='No items found for this date.';return;}
    var ll=items.filter(function(i){return i.kind==='LIGHTNING_LANE'||(i.type==='FASTPASS'&&i.kind!=='PARK_PASS');});
    var passes=items.filter(function(i){return i.kind==='PARK_PASS';});
    var dining=items.filter(function(i){return i.type==='DINING';});
    var other=items.filter(function(i){return ll.indexOf(i)===-1&&passes.indexOf(i)===-1&&dining.indexOf(i)===-1;});
    function renderSection(label,arr){
      if(!arr.length)return;
      var sec=document.createElement('div');sec.className='sec';sec.textContent=label+' ('+arr.length+')';el.appendChild(sec);
      arr.forEach(function(item){
        var div=document.createElement('div');div.className='plan-item';
        var assetId=item.facility||(item.assets&&item.assets[0]&&item.assets[0].content)||'';
        var assetName=(assets[assetId]&&assets[assetId].name)||nm(assetId.split(';')[0])||assetId;
        var nameEl=document.createElement('div');nameEl.className='plan-item-name';nameEl.textContent=assetName;div.appendChild(nameEl);
        var meta=document.createElement('div');meta.className='plan-item-meta';
        var start=item.startDateTime||item.displayStartDate||'';
        if(start){
          var ds=document.createElement('span');ds.className='plan-date';
          if(item.allDay){ds.textContent=item.displayStartDate||start.split('T')[0];}
          else{try{var dd=new Date(start);var hh=dd.getHours();var mm=String(dd.getMinutes()).padStart(2,'0');var ap=hh>=12?'pm':'am';hh=hh%12||12;ds.textContent=hh+':'+mm+ap;}catch(e){ds.textContent=start;}}
          meta.appendChild(ds);
        }
        if(item.status){var ss=document.createElement('span');ss.style.color='#555';ss.textContent=item.status.toLowerCase().replace(/_/g,' ');meta.appendChild(ss);}
        div.appendChild(meta);
        if(item.guests&&item.guests.length){
          var gnames=item.guests.map(function(g){var p=profiles[g.id];return p?p.name.firstName:g.id.split(';')[0].slice(0,8);}).join(', ');
          var gEl=document.createElement('div');gEl.className='plan-guests';gEl.textContent='👥 '+gnames;div.appendChild(gEl);
        }
        el.appendChild(div);
      });
    }
    renderSection('Park Passes',passes);
    renderSection('Lightning Lane',ll);
    renderSection('Dining',dining);
    renderSection('Other',other);
  }));
  pl.appendChild(resDiv('pl-res'));

})();