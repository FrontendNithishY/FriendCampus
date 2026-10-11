/* FriendCampus – app logic (Supabase backend) */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DOM='@friendcampus.app';
const ready=!/YOUR/.test(CONFIG.SUPABASE_URL+CONFIG.SUPABASE_ANON_KEY);
const sb=ready?supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY):null;

/* extra icons */
Object.assign(I,{
 heart:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 21s-8-5.200-8-11a4.500 4.500 0 018-2.800A4.500 4.500 0 0120 10c0 5.800-8 11-8 11z"/></svg>',
 cmt:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 4h16v12H9l-5 4z"/></svg>',
 share2:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M14 4l8 7-8 7v-4c-6 0-9 2-11 6 0-7 3-12 11-12z"/></svg>',
 pin:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/></svg>',
 photo:'<svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
 user2:'<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-6 8-6s7 1 8 6"/></svg>',
 lock:'<svg width="22" height="22" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
 trash:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
 logout:'<svg width="32" height="32" viewBox="0 0 24 24"><path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"/></svg>',
 people:'<svg width="40" height="38" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.500"/><path d="M2 20c.5-4 3.500-6 7-6s6.500 2 7 6"/><circle cx="17" cy="9" r="2.800"/><path d="M17 14c3 0 5 1.800 5.500 5"/></svg>',
 polls:'<svg width="32" height="32" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
 edit:'<svg width="32" height="32" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>',
 key:'<svg width="32" height="32" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>',
 info:'<svg width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.1"/></svg>',
 megaphone:'<svg width="32" height="32" viewBox="0 0 24 24"><path d="M3 10v4h4l8 5V5L7 10zM18 9a4 4 0 010 6"/></svg>',
 logo:'<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#F44336" stroke-width="1.6"><circle cx="8.500" cy="8" r="3"/><circle cx="16" cy="9" r="2.500"/><path d="M2.500 19c.5-3.500 3-5 6-5s5.500 1.500 6 5M15 14c3 0 5 1.300 5.500 4.500"/></svg>'
});

const state={notices:[],reminders:[],requests:[],notifs:[],members:[],polls:[],votes:[],likes:[],comments:[]};
let me=null,tab='feed',commSeg='members',helpFilter='all',q='',chan=null;
const isAdmin=()=>me&&me.role==='admin';

/* local storage (per user) */
const store={
 get(k,d){try{const v=localStorage.getItem('fc_'+(me?me.id:'x')+'_'+k);return v?JSON.parse(v):d}catch(e){return d}},
 set(k,v){try{localStorage.setItem('fc_'+(me?me.id:'x')+'_'+k,JSON.stringify(v))}catch(e){}}
};
/* helpers */
let tt;function toast(m,ms=2200){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(tt);tt=setTimeout(()=>t.style.display='none',ms)}
function vib(){try{navigator.vibrate&&navigator.vibrate(250)}catch(e){}}
function modal(h){$('#modal .box').innerHTML=h;$('#modal').classList.add('on')}
function closeModal(){$('#modal').classList.remove('on')}
const pad=n=>String(n).padStart(2,'0');
function t12(d){let h=d.getHours(),m=d.getMinutes(),ap=h>=12?'pm':'am';h=h%12||12;return h+':'+pad(m)+' '+ap}
function fmt(ts){const d=new Date(ts),n=new Date(),y=new Date(Date.now()-864e5);
 if(d.toDateString()===n.toDateString())return 'Today at '+t12(d);
 if(d.toDateString()===y.toDateString())return 'Yesterday at '+t12(d);
 return d.toLocaleString('en',{month:'long'})+' '+d.getDate()+' at '+t12(d)}
function dshort(ts){const d=new Date(ts);return d.getDate()+' '+d.toLocaleString('en',{month:'short'})}
function dfull(ts){return new Date(ts).toLocaleString('en',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}

/* ================= LOGIN ================= */
let signup=false,pendingEmail='',coolTimer=null;
const IC_MAIL='<svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const IC_KEY='<svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';
function loginTop(){return `<div class="lg-top"><div class="lg-logo">${I.logo}</div><h1>FriendCampus</h1><p>Notices, reminders &amp; your friends in one place</p></div>`}
function showLogin(msg=''){
 $('#login').classList.add('on');
 $('#login').innerHTML=loginTop()+`<div class="lg-card"><h2>${signup?'Create account':'Login'}</h2>
 <div class="lg-warn" style="display:${ready?'none':'block'}">Supabase is not set up yet. Put your project URL and anon key in <b>www/config.js</b> and rebuild.</div>
 ${signup?`<div class="fld">${I.user2}<input id="l_name" placeholder="Full name" autocomplete="name"></div>
 <div class="fld">${I.user2}<input id="l_user" placeholder="Choose a username" autocapitalize="none" autocomplete="username"></div>
 <div class="fld">${IC_MAIL}<input id="l_email" type="email" placeholder="Email address" autocapitalize="none" autocomplete="email"></div>`
 :`<div class="fld">${I.user2}<input id="l_user" placeholder="Username or email" autocapitalize="none" autocomplete="username"></div>`}
 <div class="fld">${I.lock}<input id="l_pass" type="password" placeholder="Password${signup?' (min 6)':''}" autocomplete="${signup?'new-password':'current-password'}"></div>
 <div class="lg-err" id="l_err">${esc(msg)}</div>
 <button class="btn" id="l_go">${signup?'Create account':'Login'}</button>
 <div class="lg-sw">${signup?'Already have an account?':'New here?'} <a id="l_sw">${signup?'Login':'Create account'}</a></div></div>`;
 $('#l_sw').onclick=()=>{signup=!signup;showLogin()};
 $('#l_go').onclick=doAuth;
 $('#l_pass').onkeydown=e=>{if(e.key==='Enter')doAuth()};
}
function showVerify(email,msg=''){
 pendingEmail=email;$('#login').classList.add('on');
 $('#login').innerHTML=loginTop()+`<div class="lg-card"><h2>Check your email</h2>
 <p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.5">We sent a confirmation link to <b>${esc(email)}</b>.<br>Tap the link in that email, then come back here and login.</p>
 <div class="lg-err" id="v_err">${esc(msg)}</div>
 <button class="btn" id="v_go">I've confirmed - Login</button>
 <div class="lg-sw"><a id="v_re">Resend email</a><span id="v_cd"></span><br><br><span style="font-size:13px">Can't find it? Check your spam folder.</span></div></div>`;
 $('#v_go').onclick=()=>{signup=false;showLogin()};
 $('#v_re').onclick=resend;
 cooldown(30);
}
function cooldown(n){clearInterval(coolTimer);const a=$('#v_re');if(!a)return;let s=n;
 a.style.pointerEvents='none';a.style.opacity='.5';
 coolTimer=setInterval(()=>{s--;if(!$('#v_cd')){clearInterval(coolTimer);return}
  if(s<=0){clearInterval(coolTimer);$('#v_cd').textContent='';a.style.pointerEvents='';a.style.opacity=''}else $('#v_cd').textContent=' ('+s+'s)'},1000)}
async function resend(){
 const {error}=await sb.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:CONFIG.REDIRECT_URL}});
 const e=$('#v_err');if(error){e.style.color='';e.textContent=error.message;return}
 e.style.color='#2E7D32';e.textContent='Email sent again.';cooldown(30);
}
async function doAuth(){
 const err=m=>{$('#l_err').textContent=m};
 if(!ready)return err('Add your Supabase keys in config.js first.');
 const p=$('#l_pass').value;let u=$('#l_user').value.trim().toLowerCase();
 if(!u)return err(signup?'Choose a username.':'Enter your username or email.');
 if(p.length<6)return err('Password must be at least 6 characters.');
 const b=$('#l_go');b.disabled=true;err('');
 try{
  if(signup){
   const name=$('#l_name').value.trim()||u,email=$('#l_email').value.trim().toLowerCase();
   if(!/^[a-z0-9_.]{3,20}$/.test(u))throw new Error('Username: 3-20 letters, numbers, _ or .');
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('Enter a valid email address.');
   const {data:taken}=await sb.rpc('username_taken',{u});
   if(taken)throw new Error('That username is already taken.');
   const {data,error}=await sb.auth.signUp({email,password:p,options:{data:{name,username:u},emailRedirectTo:CONFIG.REDIRECT_URL}});
   if(error)throw error;
   if(data.user&&data.user.identities&&data.user.identities.length===0)throw new Error('This email is already registered. Please login.');
   if(data.session)return;               /* confirmation disabled: already signed in */
   showVerify(email);return;
  }
  let email=u;
  if(!u.includes('@')){const {data}=await sb.rpc('email_for_username',{u});email=data||'';}
  if(!email)throw new Error('Wrong username or password.');
  const {error}=await sb.auth.signInWithPassword({email,password:p});
  if(error){
   if(/not confirmed/i.test(error.message)){await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:CONFIG.REDIRECT_URL}});showVerify(email,'Please confirm your email first. We sent the link again.');return}
   throw new Error(/Invalid login/i.test(error.message)?'Wrong username or password.':error.message);
  }
 }catch(e){err(e.message);b.disabled=false}
}
async function logout(){closeDrawer();if(chan)sb.removeChannel(chan);chan=null;await sb.auth.signOut();me=null}

/* ================= DATA ================= */
const Q={
 notices:()=>sb.from('notices').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}),
 reminders:()=>sb.from('reminders').select('*').order('remind_at',{ascending:true}),
 requests:()=>sb.from('requests').select('*').order('created_at',{ascending:false}),
 notifs:()=>sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(60),
 members:()=>sb.from('profiles').select('*').order('name'),
 polls:()=>sb.from('polls').select('*').order('created_at',{ascending:false}),
 votes:()=>sb.from('votes').select('*'),
 likes:()=>sb.from('notice_likes').select('*'),
 comments:()=>sb.from('notice_comments').select('*').order('created_at',{ascending:true})
};
async function ld(k){const {data,error}=await Q[k]();if(!error){state[k]=data||[];if(k==='members'){const m=state.members.find(x=>x.id===me.id);if(m)me=m}refresh(k)}}
function refresh(k){
 const map={notices:'feed',reminders:'rem',requests:'help',members:'comm',polls:'comm',votes:'comm',likes:'feed',comments:'feed'};
 if(k==='comments')drawComments();
 if(k==='notifs'){bar();if($('#notif').classList.contains('on'))openNotif();return}
 if(map[k]===tab)render();
}
const unseen=()=>{const s=store.get('seen',0);return state.notifs.filter(n=>n.id>s).length};
function subscribe(){
 chan=sb.channel('fc');
 ['notices','reminders','requests','notifications','polls','votes','profiles','notice_likes','notice_comments'].forEach(t=>{
  chan.on('postgres_changes',{event:'*',schema:'public',table:t},p=>{
   const key={notifications:'notifs',profiles:'members',notice_likes:'likes',notice_comments:'comments'}[t]||t;
   ld(key);
   if(t==='notifications'&&p.eventType==='INSERT'&&p.new.actor_id!==me.id){toast('🔔 '+p.new.title,3500);vib()}
  });
 });
 chan.subscribe();
}
async function start(){
 $('#login').classList.remove('on');
 const {data:{user}}=await sb.auth.getUser();
 const {data:p}=await sb.from('profiles').select('*').eq('id',user.id).single();
 me=p||{id:user.id,username:(user.email||'').split('@')[0],name:'Friend',role:'user',bio:''};
 tab='feed';await Promise.all(Object.keys(Q).map(ld));
 subscribe();go('feed');
}

/* ================= SHELL ================= */
function bar(){
 const n=unseen();
 $('#bar').innerHTML=`<button class="ib" id="mn">${I.menu}</button><div class="ttl">FriendCampus</div>`+
 (tab==='feed'?`<button class="ib" id="sr">${I.search}</button><button class="ib" id="qr">${I.qr}</button>`:'')+
 `<button class="ib" id="bl">${I.bell}${n?`<span class="badge">${n>99?'99+':n}</span>`:''}</button>`;
 $('#mn').onclick=openDrawer;$('#bl').onclick=openNotif;
 if(tab==='feed'){$('#sr').onclick=()=>{$('#srow').classList.toggle('on');if($('#srow').classList.contains('on'))$('#sq').focus();else{q='';$('#sq').value='';renderFeed()}};
  $('#qr').onclick=idCard}
 else $('#srow').classList.remove('on');
}
function nav(){
 const t=[['feed','Feed',I.feed],['comm','Community',I.people],['help','Help Center',I.help],['rem','Reminders',I.rem]];
 $('#nav').innerHTML=t.map(([k,l,ic])=>`<button data-k="${k}" class="${tab===k?'on':''}">${ic}<span>${l}</span></button>`).join('');
 document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.k));
}
function fabShow(){
 const on=tab==='feed'||(tab==='comm'&&isAdmin()&&commSeg==='polls')||(tab==='help'&&!isAdmin())||tab==='rem';
 $('#fab').classList.toggle('on',on);
}
function go(k){
 tab=k;document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
 $('#p-'+k).classList.add('on');bar();nav();render();
}
function render(){({feed:renderFeed,comm:renderComm,help:renderHelp,rem:renderRem})[tab]();fabShow()}

/* ---------- Feed ---------- */
function renderFeed(){
 const L=state.notices.filter(n=>(n.title+n.body).toLowerCase().includes(q.toLowerCase()));
 $('#p-feed').innerHTML=L.length?L.map(n=>{
  const long=n.body.length>200,lk=state.likes.filter(x=>x.notice_id===n.id),liked=lk.some(x=>x.user_id===me.id),cc=state.comments.filter(x=>x.notice_id===n.id).length,mine=n.author_id===me.id;
  return `<div class="post"><div class="ph"><div class="pic">${I.clip}</div>
  <div class="who"><div class="src">${esc(n.author_name||'Admin')}${n.author_role==='admin'?'<span class="tag admin">ADMIN</span>':''}${n.pinned?'<span class="tag glob">PINNED</span>':''}</div><div class="dt">${dshort(n.created_at)}</div></div>
  ${isAdmin()?`<button class="xbtn" data-act="pin" data-id="${n.id}">${I.pin}</button>`:''}
  ${(isAdmin()||mine)?`<button class="xbtn" data-act="delnotice" data-id="${n.id}">${I.trash}</button>`:(isAdmin()?'':I.chev)}</div>
  <h3>${esc(n.title)}</h3>
  ${n.image_url?`<div class="nimg"><img src="${esc(n.image_url)}" loading="lazy" data-act="img" data-id="${n.id}"></div>`:''}
  <div class="body">${esc(long?n.body.slice(0,200)+'....':n.body)}</div>
  ${long?`<a class="vm" data-act="viewnotice" data-id="${n.id}">View more</a>`:'<div style="height:16px"></div>'}
  <div class="by">Posted by <span>${esc(n.author_name||'Admin')}</span></div>
  <div class="acts"><button data-act="like" data-id="${n.id}" class="${liked?'liked':''}">${I.heart}<span>${lk.length||''} Like</span></button>
  <button data-act="comments" data-id="${n.id}">${I.cmt}<span>${cc||''} Comment</span></button>
  <button data-act="share" data-id="${n.id}">${I.share2}<span>Share</span></button></div></div>`}).join(''):
  `<div class="empty">${q?'No notices match your search.':'No notices yet. Tap + to post one.'}</div>`;
}
$('#sq').oninput=e=>{q=e.target.value;renderFeed()};

/* ---------- Community (members + polls) ---------- */
function renderComm(){
 const seg=`<div class="seg"><button data-act="seg" data-id="members" class="${commSeg==='members'?'on':''}">Members (${state.members.length})</button><button data-act="seg" data-id="polls" class="${commSeg==='polls'?'on':''}">Polls</button></div>`;
 let body='';
 if(commSeg==='members'){
  body=`<div class="search" style="margin-top:10px">${I.search.replace(/#fff/g,'#555').replace('width="30" height="30"','width="26" height="26"')}<input id="ms" placeholder="Search friends…" value="${esc(window._mq||'')}"></div>`+
  state.members.filter(m=>(m.name+m.username).toLowerCase().includes((window._mq||'').toLowerCase())).map(m=>
  `<div class="mem"><div class="ini">${esc((m.name||'?')[0].toUpperCase())}</div><div><b>${esc(m.name)}${m.role==='admin'?'<span class="tag admin">ADMIN</span>':''}</b><small>@${esc(m.username)}${m.bio?' · '+esc(m.bio):''}</small></div></div>`).join('');
 }else{
  body=state.polls.length?state.polls.map(p=>{
   const vs=state.votes.filter(v=>v.poll_id===p.id),mine=vs.find(v=>v.user_id===me.id),tot=vs.length;
   return `<div class="poll"><h4><span>${esc(p.question)}</span>${isAdmin()?`<button class="xbtn" data-act="delpoll" data-id="${p.id}">${I.trash}</button>`:''}</h4>`+
   p.options.map((o,i)=>{const c=vs.filter(v=>v.option_idx===i).length,pc=tot?Math.round(c*100/tot):0;
    return `<div class="opt ${mine&&mine.option_idx===i?'mine':''}" ${mine?'':`data-act="vote" data-id="${p.id}:${i}"`}>${mine?`<i style="width:${pc}%"></i>`:''}<span>${esc(o)}</span>${mine?`<span>${pc}%</span>`:''}</div>`}).join('')+
   `<small>${tot} vote${tot===1?'':'s'}${mine?'':' · tap an option to vote'}</small></div>`}).join(''):
   `<div class="empty">No polls yet.${isAdmin()?' Tap + to create one.':''}</div>`;
 }
 $('#p-comm').innerHTML=seg+body;
 const i=$('#ms');if(i)i.oninput=()=>{const v=i.value;window._mq=v;renderComm();const j=$('#ms');j.focus();j.setSelectionRange(v.length,v.length)};
}

/* ---------- Help Center ---------- */
function renderHelp(){
 let L=state.requests;if(helpFilter==='pending')L=L.filter(r=>r.status==='pending');
 const head=`<div class="fbar"><button class="ib" data-act="hfilter">${I.filt}${helpFilter!=='all'?'<span class="dot"></span>':''}</button></div>`;
 $('#p-help').innerHTML=head+(L.length?L.map(r=>`<div class="req"><b>${esc(r.subject)}</b><span class="tag ${r.status==='pending'?'pend':'done'}">${r.status.toUpperCase()}</span>
  ${isAdmin()?`<small>From ${esc(r.name||r.username)} (@${esc(r.username)})</small>`:''}
  <div style="margin-top:8px;font-size:14.5px;line-height:1.35;color:#333;white-space:pre-wrap">${esc(r.message)}</div>
  ${r.reply?`<div class="reply"><b>Admin reply:</b> ${esc(r.reply)}</div>`:''}
  <small>${fmt(r.created_at)}</small>
  ${isAdmin()?`<button class="btn" style="height:40px;margin-top:10px;font-size:14px" data-act="reply" data-id="${r.id}">${r.reply?'Edit reply':'Reply / resolve'}</button>`:''}</div>`).join(''):
  `<div style="height:calc(100vh - 330px);min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">${I.headset}<div class="hc">All submitted and pending requests will be shown here.</div></div>`);
}

/* ---------- Reminders ---------- */
function renderRem(){
 const now=Date.now(),up=state.reminders.filter(r=>new Date(r.remind_at)>=now),past=state.reminders.filter(r=>new Date(r.remind_at)<now).reverse();
 const card=r=>{const del=isAdmin()||r.scope==='personal';const soon=new Date(r.remind_at)-now<864e5&&new Date(r.remind_at)>=now;
  return `<div class="rem ${soon?'due':''}"><div style="flex:1"><h4>${esc(r.title)}${r.scope==='global'?'<span class="tag glob">EVERYONE</span>':''}</h4>
  ${r.note?`<p>${esc(r.note)}</p>`:''}<div class="meta">⏰ ${dfull(r.remind_at)}</div></div>
  ${del?`<button class="xbtn" data-act="delrem" data-id="${r.id}">${I.trash}</button>`:''}</div>`};
 $('#p-rem').innerHTML=(state.reminders.length?'':`<div class="rem"><div><h4>More Reminders soon!</h4><p>Classes schedule, meetings and other important events.</p></div><div style="margin-left:auto">${I.bubble}</div></div>`)+
  (up.length?`<div class="remh">Upcoming</div>`+up.map(card).join(''):'')+(past.length?`<div class="remh">Past</div>`+past.map(card).join(''):'');
}
function checkDue(){
 if(!me)return;const seen=store.get('alerted',[]),now=Date.now();let ch=false;
 state.reminders.forEach(r=>{const t=new Date(r.remind_at).getTime();
  if(t<=now&&now-t<6*3600e3&&!seen.includes(r.id)){seen.push(r.id);ch=true;toast('⏰ '+r.title,5000);vib()}});
 if(ch)store.set('alerted',seen);
}
setInterval(checkDue,20000);

/* ---------- Notifications ---------- */
function openNotif(){
 const n=$('#notif');n.classList.add('on');const seen=store.get('seen',0),un=state.notifs.filter(x=>x.id>seen).length;
 const ic={notice:'chat',reminder:'rem',poll:'quiz',request:'help'};
 n.innerHTML=`<div class="bar"><button class="ib" id="nb">${I.back}</button><div class="ttl">Notifications</div></div>
 <button class="mark" id="ma">MARK ALL AS READ (${un})</button>
 <div class="list">${state.notifs.length?state.notifs.map(x=>`<div class="n ${x.id>seen?'unread':''}">${I[ic[x.kind]||'chat']}<div style="flex:1"><div class="t">${esc(x.title)}</div>${x.body?`<div style="font-size:14px;color:#666;margin-top:4px">${esc(x.body)}</div>`:''}<div class="tm">${fmt(x.created_at)}</div></div></div>`).join(''):'<div class="empty">No notifications yet.</div>'}</div>`;
 $('#nb').onclick=()=>{n.classList.remove('on');bar()};
 $('#ma').onclick=()=>{store.set('seen',Math.max(0,...state.notifs.map(x=>x.id)));openNotif();bar()};
}

/* ---------- Drawer ---------- */
function openDrawer(){
 const it=(ic,l,id)=>`<div class="item" data-act="drawer" data-id="${id}">${I[ic]}<span>${l}</span></div>`;
 const sec=(h,s)=>`<div class="sec"><div class="h">${h}</div>${s}</div>`;
 $('#drawer').innerHTML=`<div class="prof" data-act="drawer" data-id="edit"><div class="av">${I.user}</div><div style="flex:1;padding-right:34px">
  <div class="nm">${esc(me.name)}</div><div class="sm">@${esc(me.username)} | ${isAdmin()?'Admin':'Member'}</div>${me.bio?`<div class="sm">${esc(me.bio)}</div>`:''}<div class="sm" style="font-size:15px">FriendCampus</div></div><div class="idb">${I.id}</div></div>
  <div class="sec" style="margin-top:14px">${it('swap','Switch Account','logout')}</div>`+
  sec('Community',it('megaphone','Notices','feed')+it('people','Friends','members')+it('polls','Polls','polls')+it('help','Help Center','help'))+
  sec('My Space',it('rem','Reminders','rem')+it('edit','Edit Profile','edit')+it('key','Change Password','pass')+it('info','About','about'))+
  (isAdmin()?sec('Admin',it('megaphone','Post Notice','anotice')+it('rem','Post Reminder','arem')+it('polls','Create Poll','apoll')):'');
 $('#scrim').classList.add('on');$('#drawer').classList.add('on');
}
function closeDrawer(){$('#scrim').classList.remove('on');$('#drawer').classList.remove('on')}
$('#scrim').onclick=closeDrawer;

/* ================= ACTIONS ================= */
const mrow=(c,s)=>`<div class="row"><button id="mc">CANCEL</button><button id="ms">${s}</button></div>`;
function pickErr(error){if(error)toast('Error: '+error.message,3500);return !!error}
let picked=null;
function compress(file,max=1280){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);
 img.onload=()=>{const r=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*r),h=Math.round(img.height*r),c=document.createElement('canvas');
  c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>b?res(b):rej(new Error('Could not read image')),'image/jpeg',.8);URL.revokeObjectURL(u)};
 img.onerror=()=>rej(new Error('Could not read image'));img.src=u})}
function newNotice(){picked=null;
 modal(`<h3>Post a notice</h3><input id="a1" placeholder="Title"><textarea id="a2" rows="5" placeholder="Write something…"></textarea>
 <div id="pv" style="display:none;margin-bottom:12px;position:relative"><img id="pvi" style="width:100%;border-radius:8px"><button id="pvx" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:32px;height:32px;padding:0">✕</button></div>
 <input id="a3" type="file" accept="image/*" style="display:none">
 <button id="ap" style="width:100%;border:1.5px solid var(--red);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px"><span style="display:flex;stroke:var(--red);fill:none;stroke-width:1.6">${I.photo}</span>Add photo</button>${mrow(0,'POST')}`);
 $('#ap').onclick=()=>$('#a3').click();
 $('#a3').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{picked=await compress(f);$('#pvi').src=URL.createObjectURL(picked);$('#pv').style.display='block'}catch(x){toast(x.message)}};
 $('#pvx').onclick=()=>{picked=null;$('#pv').style.display='none';$('#a3').value=''};
 $('#mc').onclick=closeModal;
 $('#ms').onclick=async()=>{const t=$('#a1').value.trim();if(!t)return toast('Add a title');
  const b=$('#ms');b.disabled=true;b.textContent='POSTING…';let url=null;
  if(picked){const path=`${me.id}/${Date.now()}.jpg`;
   const {error:ue}=await sb.storage.from('notice-images').upload(path,picked,{contentType:'image/jpeg'});
   if(ue){b.disabled=false;b.textContent='POST';return toast('Photo upload failed: '+ue.message,3500)}
   url=sb.storage.from('notice-images').getPublicUrl(path).data.publicUrl}
  const {error}=await sb.from('notices').insert({title:t,body:$('#a2').value.trim(),image_url:url,author_id:me.id,author_name:me.name});
  if(error){b.disabled=false;b.textContent='POST';return pickErr(error)}
  closeModal();toast('Notice posted');ld('notices')}}
let cmNotice=null;
function openComments(id){cmNotice=id;
 modal(`<h3>Comments</h3><div id="cml" style="max-height:45vh;overflow-y:auto"></div><div style="display:flex;gap:8px;margin-top:12px"><input id="cmi" placeholder="Write a comment…" style="margin:0;flex:1"><button id="cms" style="background:var(--red);color:#fff;border-radius:6px">Send</button></div><div class="row" style="margin-top:8px"><button id="mc">CLOSE</button></div>`);
 $('#mc').onclick=()=>{cmNotice=null;closeModal()};$('#cms').onclick=sendComment;$('#cmi').onkeydown=e=>{if(e.key==='Enter')sendComment()};drawComments()}
function drawComments(){const el=$('#cml');if(!el||cmNotice==null)return;const L=state.comments.filter(c=>c.notice_id===cmNotice);
 el.innerHTML=L.length?L.map(c=>`<div style="padding:8px 0;border-bottom:1px solid #eee"><b style="font-size:14px">${esc(c.author_name)}</b> <span style="color:#999;font-size:12px">${fmt(c.created_at)}</span>${(isAdmin()||c.user_id===me.id)?`<button class="xbtn" data-act="delcm" data-id="${c.id}" style="float:right;padding:0">${I.trash}</button>`:''}<div style="font-size:15px;margin-top:2px;white-space:pre-wrap">${esc(c.body)}</div></div>`).join(''):'<div style="color:#888;padding:10px 0">No comments yet. Be the first!</div>';el.scrollTop=el.scrollHeight}
async function sendComment(){const v=$('#cmi').value.trim();if(!v)return;
 const {error}=await sb.from('notice_comments').insert({notice_id:cmNotice,user_id:me.id,author_name:me.name,body:v});
 if(!pickErr(error)){$('#cmi').value='';ld('comments')}}
function newReminder(forceGlobal){
 modal(`<h3>New reminder</h3><input id="a1" placeholder="What to remember?"><input id="a3" placeholder="Note (optional)"><input id="a2" type="datetime-local">
 ${isAdmin()?`<select id="a4"><option value="global" ${forceGlobal?'selected':''}>Send to everyone</option><option value="personal" ${forceGlobal?'':'selected'}>Only me</option></select>`:''}${mrow(0,'SAVE')}`);
 $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const t=$('#a1').value.trim(),w=$('#a2').value;if(!t||!w)return toast('Add a title and date/time');
  const scope=isAdmin()?$('#a4').value:'personal';
  const {error}=await sb.from('reminders').insert({title:t,note:$('#a3').value.trim(),remind_at:new Date(w).toISOString(),scope,user_id:scope==='personal'?me.id:null,created_by:me.id});
  if(!pickErr(error)){closeModal();toast('Reminder added');ld('reminders')}}}
function newRequest(){modal(`<h3>New request</h3><input id="a1" placeholder="Subject"><textarea id="a2" rows="5" placeholder="Describe your request…"></textarea>${mrow(0,'SUBMIT')}`);
 $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const t=$('#a1').value.trim();if(!t)return;
  const {error}=await sb.from('requests').insert({user_id:me.id,name:me.name,username:me.username,subject:t,message:$('#a2').value.trim()});
  if(!pickErr(error)){closeModal();toast('Request submitted');ld('requests')}}}
function newPoll(){modal(`<h3>Create poll</h3><input id="a1" placeholder="Question"><textarea id="a2" rows="5" placeholder="One option per line (2 to 6)"></textarea>${mrow(0,'CREATE')}`);
 $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const t=$('#a1').value.trim(),o=$('#a2').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6);
  if(!t||o.length<2)return toast('Add a question and at least 2 options');
  const {error}=await sb.from('polls').insert({question:t,options:o,created_by:me.id});
  if(!pickErr(error)){closeModal();toast('Poll created');ld('polls')}}}
function editProfile(){modal(`<h3>Edit profile</h3><input id="a1" placeholder="Name" value="${esc(me.name)}"><input id="a2" placeholder="Short bio (e.g. 2nd year, IT)" value="${esc(me.bio||'')}">${mrow(0,'SAVE')}`);
 $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const n=$('#a1').value.trim();if(!n)return;
  const {error}=await sb.from('profiles').update({name:n,bio:$('#a2').value.trim()}).eq('id',me.id);
  if(!pickErr(error)){closeModal();toast('Profile saved');ld('members')}}}
function changePass(){modal(`<h3>Change password</h3><input id="a1" type="password" placeholder="New password (min 6)">${mrow(0,'UPDATE')}`);
 $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const p=$('#a1').value;if(p.length<6)return toast('Minimum 6 characters');
  const {error}=await sb.auth.updateUser({password:p});if(!pickErr(error)){closeModal();toast('Password updated')}}}
function idCard(){modal(`<h3>My ID</h3><div style="text-align:center;padding:10px 0 16px"><div class="av" style="width:84px;height:84px;margin:0 auto 12px">${I.user}</div><div style="font-weight:700;font-size:20px">${esc(me.name)}</div><div style="color:#777;margin-top:4px">@${esc(me.username)} · ${isAdmin()?'Admin':'Member'}</div></div><div class="row"><button id="mc">CLOSE</button></div>`);$('#mc').onclick=closeModal}

document.addEventListener('click',async e=>{
 const t=e.target.closest('[data-act]');if(!t)return;const id=t.dataset.id,a=t.dataset.act;
 if(a==='delnotice'){if(confirm('Delete this notice?')){const n=state.notices.find(x=>x.id==id);const {error}=await sb.from('notices').delete().eq('id',id);
  if(!pickErr(error)&&n&&n.image_url){const m=n.image_url.split('/notice-images/')[1];if(m)sb.storage.from('notice-images').remove([decodeURIComponent(m)])}ld('notices')}}
 else if(a==='pin'){const n=state.notices.find(x=>x.id==id);const {error}=await sb.from('notices').update({pinned:!n.pinned}).eq('id',id);pickErr(error);ld('notices')}
 else if(a==='like'){const liked=state.likes.some(x=>x.notice_id==id&&x.user_id===me.id);
  const r=liked?await sb.from('notice_likes').delete().eq('notice_id',id).eq('user_id',me.id):await sb.from('notice_likes').insert({notice_id:+id,user_id:me.id});pickErr(r.error);ld('likes')}
 else if(a==='comments'){openComments(+id)}
 else if(a==='delcm'){const {error}=await sb.from('notice_comments').delete().eq('id',id);pickErr(error);ld('comments')}
 else if(a==='img'){const n=state.notices.find(x=>x.id==id);modal(`<img src="${esc(n.image_url)}" style="width:100%;border-radius:6px"><div class="row" style="margin-top:10px"><button id="mc">CLOSE</button></div>`);$('#mc').onclick=closeModal}
 else if(a==='viewnotice'){const n=state.notices.find(x=>x.id==id);modal(`<h3>${esc(n.title)}</h3><div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:12px">${esc(n.body)}</div><div style="color:#888;font-size:13px">Posted by ${esc(n.author_name||'Admin')} · ${fmt(n.created_at)}</div><div class="row"><button id="mc">CLOSE</button></div>`);$('#mc').onclick=closeModal}
 else if(a==='share'){const n=state.notices.find(x=>x.id==id);if(navigator.share)navigator.share({title:n.title,text:n.title+'\n\n'+n.body}).catch(()=>{});else toast('Sharing not available')}
 else if(a==='seg'){commSeg=id;render()}
 else if(a==='vote'){const [p,i]=id.split(':');const {error}=await sb.from('votes').insert({poll_id:+p,user_id:me.id,option_idx:+i});pickErr(error);ld('votes')}
 else if(a==='delpoll'){if(confirm('Delete this poll?')){const {error}=await sb.from('polls').delete().eq('id',id);pickErr(error);ld('polls')}}
 else if(a==='delrem'){const {error}=await sb.from('reminders').delete().eq('id',id);pickErr(error);ld('reminders')}
 else if(a==='hfilter'){helpFilter=helpFilter==='all'?'pending':'all';toast(helpFilter==='all'?'Showing all requests':'Showing pending only');renderHelp()}
 else if(a==='reply'){const r=state.requests.find(x=>x.id==id);modal(`<h3>Reply to ${esc(r.name||r.username)}</h3><textarea id="a1" rows="5" placeholder="Your reply…">${esc(r.reply||'')}</textarea>${mrow(0,'SEND &amp; RESOLVE')}`);
  $('#mc').onclick=closeModal;$('#ms').onclick=async()=>{const {error}=await sb.from('requests').update({reply:$('#a1').value.trim(),status:'resolved'}).eq('id',id);if(!pickErr(error)){closeModal();ld('requests')}}}
 else if(a==='drawer'){closeDrawer();
  ({logout,feed:()=>go('feed'),members:()=>{commSeg='members';go('comm')},polls:()=>{commSeg='polls';go('comm')},help:()=>go('help'),rem:()=>go('rem'),edit:editProfile,pass:changePass,
   about:()=>modal(`<h3>FriendCampus</h3><p style="line-height:1.5;color:#444">Notices, reminders, polls and help requests for your friend circle. Updates arrive live.</p><div class="row"><button id="mc">CLOSE</button></div>`)||($('#mc').onclick=closeModal),
   anotice:newNotice,arem:()=>newReminder(true),apoll:newPoll})[id]();}
});
$('#fab').onclick=()=>{if(tab==='feed')newNotice();else if(tab==='comm')newPoll();else if(tab==='help')newRequest();else newReminder(false)};

/* ================= BOOT ================= */
if(!ready){showLogin()}
else{
 sb.auth.onAuthStateChange((ev,session)=>{
  if(ev==='SIGNED_OUT'){me=null;signup=false;showLogin()}
  else if((ev==='SIGNED_IN'||ev==='INITIAL_SESSION')&&session&&!me){me={id:session.user.id};setTimeout(start,0)}
 });
 sb.auth.getSession().then(({data})=>{if(!data.session)showLogin()});
}
