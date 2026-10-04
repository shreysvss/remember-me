/* ---------------- toasts ---------------- */
function showToast(msg, type){
  type = type || 'success';
  const stack = document.getElementById('toast-stack');
  if(!stack) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon = type==='error' ? '⚠️' : type==='info' ? 'ℹ️' : '✅';
  t.innerHTML = '<span>'+icon+'</span><span>'+msg+'</span>';
  stack.appendChild(t);
  setTimeout(()=>{
    t.style.animation = 'toast-out .25s ease forwards';
    setTimeout(()=>t.remove(), 260);
  }, 2600);
}

/* ---------------- api helpers ---------------- */
async function apiGet(url){ const r = await fetch(url); if(!r.ok) throw new Error('GET '+url+' failed'); return await r.json(); }
async function apiPost(url, body){ const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); if(!r.ok) throw new Error('POST '+url+' failed'); try{ return await r.json(); }catch(e){ return null; } }
async function apiPut(url, body){ const r = await fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); return r.ok; }
async function apiDelete(url){ const r = await fetch(url, {method:'DELETE'}); return r.ok; }

/* ---------------- state ---------------- */
let occasionsCache = [];
let calView = new Date();
let calMode = 'month';
let editingId = null;
let carouselIndex = 0;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_SHORT = ["S","M","T","W","T","F","S"];
const AVATAR_COLORS = ["#ff6fb0","#5ac8ff","#7ce8c0","#ffb84f","#c58fff","#ff8f8f"];

function todayParts(){
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), dateObj: new Date(d.getFullYear(), d.getMonth(), d.getDate()) };
}
function nextOccurrence(month, day){
  const t = todayParts();
  let year = t.y;
  const candidate = new Date(year, month, day);
  if (candidate < t.dateObj) year += 1;
  return new Date(year, month, day);
}
function daysBetween(a, b){ return Math.round((b - a) / (1000*60*60*24)); }
function ordinal(n){ const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); }
function fmtDate(month, day){ return MONTH_NAMES[month] + " " + ordinal(day); }
function initials(name){ return name.trim().split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase(); }
function avatarColor(id){ let sum = 0; for(const ch of String(id)) sum += ch.charCodeAt(0); return AVATAR_COLORS[sum % AVATAR_COLORS.length]; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function trackingCutoffYear(b){
  if(!b.trackYears) return null;
  const baseYear = b.year ? b.year : new Date(b.createdAt).getFullYear();
  return baseYear + b.trackYears;
}
function isTrackingEnded(b){
  const cutoff = trackingCutoffYear(b);
  if(cutoff === null) return false;
  return nextOccurrence(b.month, b.day).getFullYear() > cutoff;
}

/* ---------------- installment math ---------------- */
function computePeriods(target){
  const t = todayParts();
  const days = Math.max(daysBetween(t.dateObj, target), 1);
  return { daily: days, monthly: Math.max(Math.round(days/30), 1), yearly: Math.max(Math.round(days/365), 1) };
}
function perInstallment(bday){
  const target = nextOccurrence(bday.month, bday.day);
  const periods = computePeriods(target);
  const remaining = Math.max(bday.amount - (bday.savedSoFar||0), 0);
  const count = periods[bday.frequency] || 1;
  return remaining / count;
}

/* ---------------- data refresh ---------------- */
async function refreshOccasions(){
  try{
    occasionsCache = await apiGet('/api/occasions');
  }catch(e){
    showToast('Could not load your occasions, please refresh the page', 'error');
    occasionsCache = [];
  }
  if(document.getElementById('people-list')) renderDashboard();
  if(document.getElementById('cal-body')) renderCalendar();
}

/* ---------------- dashboard ---------------- */
function renderDashboard(){
  const active = occasionsCache.filter(b=>!isTrackingEnded(b));
  const list = active.slice();

  if(list.length === 0){
    document.getElementById('next-name').textContent = '—';
    document.getElementById('next-date').textContent = 'Add your first occasion to get started';
    document.getElementById('next-countdown').innerHTML = '';
  } else {
    list.sort((a,b)=> daysBetween(todayParts().dateObj, nextOccurrence(a.month,a.day)) - daysBetween(todayParts().dateObj, nextOccurrence(b.month,b.day)));
    const soonest = list[0];
    const target = nextOccurrence(soonest.month, soonest.day);
    const d = daysBetween(todayParts().dateObj, target);
    let ageStr = '';
    if(soonest.year){ ageStr = ' · ' + (target.getFullYear() - soonest.year) + ' years'; }
    document.getElementById('next-name').textContent = soonest.name;
    document.getElementById('next-date').textContent = fmtDate(soonest.month, soonest.day) + ageStr;
    document.getElementById('next-countdown').innerHTML =
      '<span class="countdown-pill">' + (d===0 ? "It's today! 🎉" : d===1 ? "Tomorrow!" : d + " days to go") + '</span>';
  }

  const totals = { daily:0, monthly:0, yearly:0 };
  let anyPresent = false;
  active.forEach(b=>{
    if(b.presentPlanned && (b.amount - (b.savedSoFar||0)) > 0){ anyPresent = true; totals[b.frequency] += perInstallment(b); }
  });
  const sumEl = document.getElementById('installments-summary');
  if(!anyPresent){ sumEl.innerHTML = '<div class="empty-note">No presents being saved for yet</div>'; }
  else {
    let html = '';
    if(totals.daily>0) html += rowHtml('Per day', totals.daily);
    if(totals.monthly>0) html += rowHtml('Per month', totals.monthly);
    if(totals.yearly>0) html += rowHtml('Per year', totals.yearly);
    sumEl.innerHTML = html;
  }
  renderInstallmentCarousel(active);

  const peopleEl = document.getElementById('people-list');
  if(occasionsCache.length === 0){
    peopleEl.innerHTML = '<div class="empty-note">Tap the pink + button to add your first one ✨</div>';
  } else {
    const all = occasionsCache.slice().sort((a,b)=> daysBetween(todayParts().dateObj, nextOccurrence(a.month,a.day)) - daysBetween(todayParts().dateObj, nextOccurrence(b.month,b.day)));
    peopleEl.innerHTML = all.map(b=>{
      const ended = isTrackingEnded(b);
      const d = daysBetween(todayParts().dateObj, nextOccurrence(b.month,b.day));
      return `<div class="mini-list-item">
        <div class="mini-avatar" style="background:${avatarColor(b.id)}" onclick="openPersonModal(${b.id})">${initials(b.name)}</div>
        <div class="mini-info" onclick="openPersonModal(${b.id})">
          <div class="mini-name">${escapeHtml(b.name)}${b.presentPlanned?' 🎁':''}</div>
          <div class="mini-sub">${fmtDate(b.month,b.day)} · ${ended ? 'tracking ended' : (d===0?'today!':d+'d away')}</div>
        </div>
        <div class="mini-actions">
          <button class="btn-icon btn-ghost" title="Edit" onclick="openEditModal(${b.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="#ff4f9a" stroke-width="2" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="#ff4f9a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn-icon btn-danger" title="Delete" onclick="confirmDelete(${b.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="#d6336c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }
}
function rowHtml(label, amt){ return `<div class="install-row"><div class="install-freq">${label}</div><div class="install-amt">R${amt.toFixed(2)}</div></div>`; }

/* ---------------- per-person installment carousel ---------------- */
function renderInstallmentCarousel(active){
  const el = document.getElementById('installments-carousel');
  if(!el) return;
  const withPresents = active.filter(b=>b.presentPlanned && (b.amount - (b.savedSoFar||0)) > 0);

  if(withPresents.length === 0){
    el.innerHTML = '<div class="empty-note">No individual installments to show yet</div>';
    return;
  }
  if(carouselIndex >= withPresents.length) carouselIndex = 0;
  if(carouselIndex < 0) carouselIndex = withPresents.length - 1;

  const b = withPresents[carouselIndex];
  const per = perInstallment(b);
  const pct = b.amount>0 ? Math.min(100, ((b.savedSoFar||0)/b.amount)*100) : 0;
  const d = daysBetween(todayParts().dateObj, nextOccurrence(b.month,b.day));

  el.innerHTML = `
    <button class="carousel-arrow" onclick="shiftCarousel(-1, ${withPresents.length})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#ff4f9a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="carousel-card">
      <div class="carousel-card-top">
        <div class="mini-avatar" style="width:32px;height:32px;font-size:12px;background:${avatarColor(b.id)}">${initials(b.name)}</div>
        <div class="carousel-card-name">${escapeHtml(b.name)}</div>
        <div class="carousel-card-freq">${b.frequency}</div>
      </div>
      <div class="detail-row"><span>${d===0?'today!':d+'d away'}</span><b>R${per.toFixed(2)} / ${b.frequency==='daily'?'day':b.frequency==='monthly'?'month':'year'}</b></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
      <div class="carousel-dots">${withPresents.map((_,i)=>`<span class="${i===carouselIndex?'on':''}"></span>`).join('')}</div>
    </div>
    <button class="carousel-arrow" onclick="shiftCarousel(1, ${withPresents.length})">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#ff4f9a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  `;
}
function shiftCarousel(dir, count){
  carouselIndex = (carouselIndex + dir + count) % count;
  renderDashboard();
}

/* ---------------- calendar ---------------- */
function shiftCal(dir){
  if(calMode==='week') calView.setDate(calView.getDate() + 7*dir);
  else if(calMode==='month') calView.setMonth(calView.getMonth() + dir);
  else calView.setFullYear(calView.getFullYear() + dir);
  renderCalendar();
}

function renderCalendar(){
  document.querySelectorAll('.cal-toggle button').forEach(b=>b.classList.toggle('selected', b.dataset.mode===calMode));
  const body = document.getElementById('cal-body');
  if(!body) return;
  if(calMode==='month'){ renderMonthView(body); }
  else if(calMode==='week'){ renderWeekView(body); }
  else { renderYearView(body); }
}

function renderMonthView(body){
  const y = calView.getFullYear(), m = calView.getMonth();
  document.getElementById('cal-month-label').textContent = MONTH_NAMES[m] + ' ' + y;
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const t = todayParts();
  const byDay = {};
  occasionsCache.forEach(b=>{ if(b.month === m){ byDay[b.day] = byDay[b.day] || []; byDay[b.day].push(b); } });

  let html = '<div class="cal-grid">' + DOW_SHORT.map(d=>`<div class="cal-dow">${d}</div>`).join('') + '</div>';
  html += '<div class="cal-grid" style="margin-top:8px;">';
  for(let i=0;i<firstDow;i++) html += '<div class="cal-cell empty"></div>';
  for(let day=1; day<=daysInMonth; day++){
    const isToday = (t.y===y && t.m===m && t.day===day);
    const has = byDay[day];
    html += `<div class="cal-cell ${isToday?'today':''}" onclick="openDayModal(${m},${day})">
      ${day}${has ? '<div class="dots">'+has.map(()=>'<span></span>').join('')+'</div>' : ''}
    </div>`;
  }
  html += '</div>';
  body.innerHTML = html;
}

function renderWeekView(body){
  const start = new Date(calView);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start); end.setDate(end.getDate()+6);
  document.getElementById('cal-month-label').textContent = MONTH_NAMES[start.getMonth()].slice(0,3)+' '+start.getDate()+' – '+MONTH_NAMES[end.getMonth()].slice(0,3)+' '+end.getDate();
  const t = todayParts();
  let html = '<div class="week-list">';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const m = d.getMonth(), day = d.getDate();
    const isToday = (t.y===d.getFullYear() && t.m===m && t.day===day);
    const people = occasionsCache.filter(b=>b.month===m && b.day===day);
    html += `<div class="week-day-card ${isToday?'today':''}" onclick="openDayModal(${m},${day})">
      <div class="week-day-top"><span>${DOW[i]}, ${fmtDate(m,day)}</span>${people.length?'<span style="color:var(--pink-deep);">🎉 '+people.length+'</span>':''}</div>
      ${people.length ? `<div class="week-day-names">${people.map(p=>escapeHtml(p.name)).join(', ')}</div>` : ''}
    </div>`;
  }
  html += '</div>';
  body.innerHTML = html;
}

function renderYearView(body){
  const y = calView.getFullYear();
  document.getElementById('cal-month-label').textContent = String(y);
  const counts = new Array(12).fill(0);
  occasionsCache.forEach(b=>{ counts[b.month]++; });
  let html = '<div class="year-grid">';
  for(let m=0;m<12;m++){
    html += `<div class="year-month-card" onclick="jumpToMonth(${m})">
      <div class="mname">${MONTH_NAMES[m]}</div>
      <div class="year-month-badge">${counts[m]} ${counts[m]===1?'occasion':'occasions'}</div>
    </div>`;
  }
  html += '</div>';
  body.innerHTML = html;
}
function jumpToMonth(m){ calView.setMonth(m); calMode = 'month'; renderCalendar(); }

/* ---------------- modal plumbing ---------------- */
function openModal(){ document.getElementById('overlay').classList.add('active'); }
function closeModal(){ document.getElementById('overlay').classList.remove('active'); editingId = null; }

function openDayModal(month, day){
  const people = occasionsCache.filter(b=>b.month===month && b.day===day);
  document.getElementById('modal').innerHTML = `
    <button class="close-x" onclick="closeModal()">✕</button>
    <div class="sheet-title">${fmtDate(month,day)}</div>
    <div id="day-people-list">
      ${people.length===0 ? '<div class="empty-note">Nothing planned for this day yet</div>' :
        people.map(b=>`<div class="person-row" onclick="openPersonModal(${b.id})">
          <div class="mini-avatar" style="background:${avatarColor(b.id)}">${initials(b.name)}</div>
          <div style="flex:1;"><div class="mini-name">${escapeHtml(b.name)}</div>
          <div class="mini-sub">${b.presentPlanned?'🎁 present planned':'no present planned'}</div></div>
        </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="openAddModal(${month},${day})">+ Add occasion for this day</button>
  `;
  openModal();
}

function formHtml(prefill){
  const b = prefill || {};
  const presentPlanned = b.presentPlanned || false;
  return `
    <button class="close-x" onclick="closeModal()">✕</button>
    <div class="sheet-title">${prefill ? 'Edit occasion' : 'New occasion 🎉'}</div>
    <div class="field"><label>What's the occasion?</label><input type="text" id="f-name" maxlength="150" placeholder="e.g. Mom's Birthday, Anniversary, Date Night" value="${escapeHtml(b.name||'')}"></div>
    <div class="field-row">
      <div class="field" style="flex:1;"><label>Month</label>
        <select id="f-month">${MONTH_NAMES.map((mn,i)=>`<option value="${i}" ${i===(b.month??0)?'selected':''}>${mn}</option>`).join('')}</select>
      </div>
      <div class="field" style="width:80px;"><label>Day</label><input type="number" id="f-day" min="1" max="31" value="${b.day||1}"></div>
      <div class="field" style="width:100px;"><label>Year</label><input type="number" id="f-year" placeholder="optional" max="${new Date().getFullYear()}" value="${b.year||''}"></div>
    </div>
    <div class="field"><label>Notes</label><textarea id="f-notes" maxlength="2000" placeholder="Anything to remember...">${escapeHtml(b.notes||'')}</textarea></div>
    <div class="field"><label>Keep reminding me for how many years?</label><input type="number" id="f-trackyears" min="1" value="${b.trackYears||100}"></div>

    <div class="field">
      <label>Specific present in mind?</label>
      <div class="toggle-row">
        <div class="toggle-opt ${!presentPlanned?'selected':''}" id="present-no" onclick="setPresentToggle(false)">No</div>
        <div class="toggle-opt ${presentPlanned?'selected':''}" id="present-yes" onclick="setPresentToggle(true)">Yes</div>
      </div>
    </div>
    <div id="present-fields" data-on="${presentPlanned?'1':'0'}" style="display:${presentPlanned?'block':'none'};">
      <div class="field"><label>Amount needed (R)</label><input type="number" id="f-amount" min="0" step="0.01" placeholder="0.00" value="${b.amount||''}"></div>
      <div class="field"><label>Save towards it</label>
        <select id="f-frequency">
          <option value="daily" ${b.frequency==='daily'?'selected':''}>Daily</option>
          <option value="monthly" ${(!b.frequency||b.frequency==='monthly')?'selected':''}>Monthly</option>
          <option value="yearly" ${b.frequency==='yearly'?'selected':''}>Yearly</option>
        </select>
      </div>
      <div class="field"><label>${prefill ? 'Amount already saved (R)' : 'Already made a deposit? Amount (R)'}</label>
        <input type="number" id="f-deposit" min="0" step="0.01" placeholder="0.00" value="${b.savedSoFar||''}">
      </div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="saveOccasion()">${prefill?'Save changes':'Save occasion'}</button>
  `;
}

function openAddModal(month, day){
  editingId = null;
  document.getElementById('modal').innerHTML = formHtml({ month: month!==undefined?month:calView.getMonth(), day: day!==undefined?day:1 });
  openModal();
}
function openEditModal(id){
  const b = occasionsCache.find(x=>x.id===id);
  if(!b){ showToast('Could not find that occasion', 'error'); return; }
  editingId = id;
  document.getElementById('modal').innerHTML = formHtml(b);
  openModal();
}
function setPresentToggle(val){
  document.getElementById('present-yes').classList.toggle('selected', val);
  document.getElementById('present-no').classList.toggle('selected', !val);
  document.getElementById('present-fields').style.display = val ? 'block' : 'none';
  document.getElementById('present-fields').dataset.on = val ? '1':'0';
}
function shake(id){
  const el = document.getElementById(id);
  el.style.borderColor = '#e0356b';
  setTimeout(()=>{ el.style.borderColor=''; }, 900);
}

async function saveOccasion(){
  const name = document.getElementById('f-name').value.trim();
  if(!name){ shake('f-name'); showToast('Please enter a name before saving', 'error'); return; }
  const month = parseInt(document.getElementById('f-month').value,10);
  let day = parseInt(document.getElementById('f-day').value,10);
  if(!day || day<1) day = 1;
  if(day>31) day = 31;
  const yearRaw = document.getElementById('f-year').value;
  const year = yearRaw ? parseInt(yearRaw,10) : null;
  if(year !== null && year > new Date().getFullYear()){
    shake('f-year');
    showToast("Year can't be in the future", 'error');
    return;
  }
  const notes = document.getElementById('f-notes').value.trim();
  const trackYears = parseInt(document.getElementById('f-trackyears').value,10) || 100;
  const presentPlanned = document.getElementById('present-fields').dataset.on === '1';
  let amount = 0, frequency = 'monthly', savedSoFar = 0;
  if(presentPlanned){
    amount = parseFloat(document.getElementById('f-amount').value) || 0;
    frequency = document.getElementById('f-frequency').value;
    savedSoFar = Math.min(parseFloat(document.getElementById('f-deposit').value) || 0, amount || 0);
  }
  const dto = { name, month, day, year, notes, trackYears, presentPlanned, amount, frequency, savedSoFar };

  try{
    if(editingId){
      const ok = await apiPut('/api/occasions/'+editingId, dto);
      if(!ok) throw new Error('update failed');
      closeModal();
      showToast(name+" was updated", 'success');
    } else {
      await apiPost('/api/occasions', dto);
      closeModal();
      burstConfetti();
      showToast(name+" was saved", 'success');
    }
    await refreshOccasions();
  }catch(e){
    showToast('Could not save that, please try again', 'error');
  }
}

function openPersonModal(id){
  const b = occasionsCache.find(x=>x.id===id);
  if(!b){ showToast('Could not find that occasion', 'error'); return; }
  const target = nextOccurrence(b.month, b.day);
  const d = daysBetween(todayParts().dateObj, target);
  const per = b.presentPlanned ? perInstallment(b) : 0;
  const progressPct = b.presentPlanned && b.amount>0 ? Math.min(100, ((b.savedSoFar||0)/b.amount)*100) : 0;
  const ended = isTrackingEnded(b);
  const cutoff = trackingCutoffYear(b);

  document.getElementById('modal').innerHTML = `
    <button class="close-x" onclick="closeModal()">✕</button>
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
      <div class="mini-avatar" style="width:52px;height:52px;font-size:19px;background:${avatarColor(b.id)}">${initials(b.name)}</div>
      <div>
        <div class="sheet-title" style="text-align:left; margin:0;">${escapeHtml(b.name)}</div>
        <div class="mini-sub">${fmtDate(b.month,b.day)}${b.year?' · '+b.year:''} · ${ended ? 'tracking ended in '+cutoff : (d===0?'today! 🎉':d+' days away')}</div>
      </div>
    </div>
    <div class="field"><label>Notes</label>
      <div style="background:#fff; border-radius:14px; padding:12px 14px; font-weight:600; font-size:13.5px; color:${b.notes?'var(--plum)':'var(--plum-soft)'}; border:2px solid #ffd9ec;">
        ${b.notes ? escapeHtml(b.notes) : 'No notes added'}
      </div>
    </div>
    ${b.presentPlanned ? `
      <div class="card" style="box-shadow:none; border:2px solid #ffe1ee; padding:16px;">
        <div class="card-eyebrow">🎁 Present goal</div>
        <div class="detail-row"><span>Goal amount</span><b>R${b.amount.toFixed(2)}</b></div>
        <div class="detail-row"><span>Saved so far</span><b>R${(b.savedSoFar||0).toFixed(2)}</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%;"></div></div>
        <div class="detail-row" style="margin-top:6px;"><span>${b.frequency} installment</span><b>R${per.toFixed(2)}</b></div>
        <button class="btn btn-secondary btn-block btn-sm" style="margin-top:12px;" onclick="addInstallment(${b.id})">Add ${b.frequency} installment</button>
      </div>
    ` : `<div class="empty-note">No gift goal set for this one</div>`}
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <button class="btn btn-secondary btn-block btn-sm" onclick="shareOccasion(${b.id})">Share</button>
      <button class="btn btn-ghost btn-block btn-sm" onclick="openEditModal(${b.id})">Edit</button>
      <button class="btn btn-danger btn-block btn-sm" onclick="confirmDelete(${b.id})">Delete</button>
    </div>
  `;
  openModal();
}

async function addInstallment(id){
  const b = occasionsCache.find(x=>x.id===id);
  if(!b){ showToast('Could not find that occasion', 'error'); return; }
  const per = perInstallment(b);
  const dto = { name:b.name, month:b.month, day:b.day, year:b.year, notes:b.notes, trackYears:b.trackYears,
    presentPlanned:b.presentPlanned, amount:b.amount, frequency:b.frequency, savedSoFar: Math.min((b.savedSoFar||0)+per, b.amount) };
  const ok = await apiPut('/api/occasions/'+id, dto);
  if(ok){ showToast(`R${per.toFixed(2)} installment added for ${b.name}`, 'success'); await refreshOccasions(); openPersonModal(id); }
  else { showToast('Could not save that installment, please try again', 'error'); }
}

function confirmDelete(id){
  const b = occasionsCache.find(x=>x.id===id);
  if(!b) return;
  document.getElementById('modal').innerHTML = `
    <button class="close-x" onclick="closeModal()">✕</button>
    <div class="sheet-title">Delete ${escapeHtml(b.name)}?</div>
    <div class="empty-note" style="margin-bottom:16px;">This removes this occasion and any gift tracking. This can't be undone.</div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-ghost btn-block btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger btn-block btn-sm" onclick="deleteOccasion(${id})">Yes, delete</button>
    </div>
  `;
  openModal();
}
async function deleteOccasion(id){
  const b = occasionsCache.find(x=>x.id===id);
  const name = b ? b.name : 'Occasion';
  const ok = await apiDelete('/api/occasions/'+id);
  closeModal();
  if(ok){ showToast(`${name} was deleted`, 'success'); }
  else { showToast('Could not delete, please try again', 'error'); }
  await refreshOccasions();
}

/* ---------------- sharing (group presents / letting someone else get reminded) ---------------- */
async function shareOccasion(id){
  const b = occasionsCache.find(x=>x.id===id);
  try{
    const res = await apiPost('/api/occasions/'+id+'/share', {});
    if(!res || !res.url) throw new Error('no url returned');
    let copied = false;
    try{ await navigator.clipboard.writeText(res.url); copied = true; }catch(e){ /* clipboard blocked, that's fine */ }
    showShareLinkModal(res.url, b ? b.name : '', copied);
  }catch(e){
    showToast('Could not create a share link, please try again', 'error');
  }
}
function showShareLinkModal(url, name, copied){
  document.getElementById('modal').innerHTML = `
    <button class="close-x" onclick="closeModal()">✕</button>
    <div class="sheet-title">Share ${name ? escapeHtml(name) : 'this occasion'}</div>
    <div class="empty-note" style="margin-bottom:10px;">Send this link to anyone, they can see the date and the present goal, and add it to their own Remember Me to get reminded too.</div>
    <div class="field"><input type="text" readonly value="${escapeHtml(url)}" onclick="this.select()"></div>
    ${copied ? '<div class="empty-note" style="color:#3aa876;">Link copied to your clipboard</div>' : ''}
    <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="closeModal()">Done</button>
  `;
  openModal();
}

async function initSharePage(){
  const token = window.SHARE_TOKEN;
  const contentEl = document.getElementById('share-content');
  let data;
  try{
    data = await apiGet('/api/share/'+token);
  }catch(e){
    contentEl.innerHTML = '<div class="empty-note">This share link is invalid or has been removed.</div>';
    return;
  }

  const pct = data.presentPlanned && data.amount>0 ? Math.min(100, (data.savedSoFar/data.amount)*100) : 0;
  let me = { loggedIn:false };
  try{ me = await apiGet('/api/me'); }catch(e){ /* treat as logged out */ }

  contentEl.innerHTML = `
    <div class="next-name" style="text-align:center;">${escapeHtml(data.name)}</div>
    <div class="next-date" style="text-align:center; margin-bottom:12px;">${fmtDate(data.month, data.day)}${data.sharedBy?' · shared by '+escapeHtml(data.sharedBy):''}</div>
    ${data.notes ? `<div class="empty-note" style="text-align:left;">${escapeHtml(data.notes)}</div>` : ''}
    ${data.presentPlanned ? `
      <div class="card" style="box-shadow:none; border:2px solid #ffe1ee; padding:16px; text-align:left;">
        <div class="card-eyebrow">🎁 Group gift</div>
        <div class="detail-row"><span>Goal amount</span><b>R${data.amount.toFixed(2)}</b></div>
        <div class="detail-row"><span>Saved by ${data.sharedBy?escapeHtml(data.sharedBy):'them'} so far</span><b>R${data.savedSoFar.toFixed(2)}</b></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
      </div>
    ` : ''}
    <div id="share-action" style="margin-top:16px;"></div>
  `;

  const actionEl = document.getElementById('share-action');
  const returnUrl = encodeURIComponent('/Share/'+token);
  if(me.loggedIn){
    actionEl.innerHTML = `<button class="btn btn-primary btn-block" onclick="claimShare('${token}')">Add to my Remember Me</button>`;
  } else {
    actionEl.innerHTML = `
      <a class="btn btn-primary btn-block" href="/Account/Login?returnUrl=${returnUrl}" style="margin-bottom:10px;">Log in to add this</a>
      <a class="btn btn-ghost btn-block" href="/Account/Register?returnUrl=${returnUrl}">Create an account to add this</a>
    `;
  }
}
async function claimShare(token){
  try{
    const res = await apiPost('/api/share/'+token+'/claim', {});
    const actionEl = document.getElementById('share-action');
    if(res && res.alreadyAdded){
      showToast("You've already added this one", 'info');
    } else {
      showToast('Added to your Remember Me!', 'success');
    }
    actionEl.innerHTML = `<a class="btn btn-secondary btn-block" href="/Index">Go to my dashboard</a>`;
  }catch(e){
    showToast('Could not add that, please try again', 'error');
  }
}

/* ---------------- redeem a pasted code/link from the dashboard box ---------------- */
function extractShareToken(raw){
  const match = raw.match(/Share\/([a-zA-Z0-9]+)/i);
  if(match) return match[1];
  return raw.replace(/[^a-zA-Z0-9]/g, '');
}
async function redeemShareCode(){
  const input = document.getElementById('redeem-code-input');
  const raw = (input.value || '').trim();
  if(!raw){ showToast('Paste a link or code first', 'error'); return; }
  const token = extractShareToken(raw);
  if(!token){ showToast("That doesn't look like a valid code", 'error'); return; }

  try{
    const res = await apiPost('/api/share/'+token+'/claim', {});
    if(res && res.alreadyAdded){
      showToast("You've already added this one", 'info');
    } else {
      showToast('Added to your Remember Me!', 'success');
    }
    input.value = '';
    await refreshOccasions();
  }catch(e){
    showToast('Could not find a shared occasion with that code', 'error');
  }
}

/* ---------------- notifications ---------------- */
function timeAgo(iso){
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs/60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins+'m ago';
  const hrs = Math.round(mins/60);
  if(hrs < 24) return hrs+'h ago';
  return Math.round(hrs/24)+'d ago';
}

async function refreshNotifications(){
  const badge = document.getElementById('notif-badge');
  if(!badge) return;
  try{
    const data = await apiGet('/api/notifications');
    if(data.unreadCount > 0){ badge.style.display='flex'; badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount; }
    else { badge.style.display='none'; }

    const panel = document.getElementById('notif-panel');
    if(panel){
      if(data.items.length===0){
        panel.innerHTML = `<div class="notif-panel-head"><span>Reminders</span></div><div class="empty-note">No reminders yet</div>`;
      } else {
        panel.innerHTML = `
          <div class="notif-panel-head"><span>Reminders</span><button class="btn btn-ghost btn-sm" style="padding:4px 10px; font-size:11px;" onclick="markAllNotificationsRead()">Mark all read</button></div>
          ${data.items.map(n=>`<div class="notif-item ${n.isRead?'':'unread'}">
            <div>${escapeHtml(n.message)}</div>
            <div class="notif-time">${timeAgo(n.createdAt)}</div>
          </div>`).join('')}
        `;
      }
    }
  }catch(e){ /* silent - notifications are a nice-to-have */ }
}
async function markAllNotificationsRead(){
  const ok = await apiPost('/api/notifications/read-all', {});
  await refreshNotifications();
  showToast('All reminders marked as read', 'success');
}

/* ---------------- reminder settings ---------------- */
async function loadNotificationSettings(){
  const t3 = document.getElementById('notify-3-toggle');
  const t7 = document.getElementById('notify-7-toggle');
  if(!t3 || !t7) return;
  try{
    const s = await apiGet('/api/settings');
    t3.checked = s.notify3DaysBefore;
    t7.checked = s.notify7DaysBefore;
  }catch(e){}
  t3.addEventListener('change', saveNotificationSettings);
  t7.addEventListener('change', saveNotificationSettings);
}
async function saveNotificationSettings(){
  const t3 = document.getElementById('notify-3-toggle');
  const t7 = document.getElementById('notify-7-toggle');
  const ok = await apiPut('/api/settings/notifications', { notify3DaysBefore: t3.checked, notify7DaysBefore: t7.checked });
  showToast(ok ? 'Reminder settings saved' : 'Could not save reminder settings', ok?'success':'error');
}

/* ---------------- settings page: appearance ---------------- */
const THEME_COLORS = { pink:'#ff6fb0', blue:'#5ac8ff', purple:'#b388ff', green:'#4cbf7d', yellow:'#ffcf3f', orange:'#ff9f43', red:'#ff5c5c' };

function renderThemeSwatches(current){
  const el = document.getElementById('theme-swatches');
  if(!el) return;
  el.innerHTML = Object.keys(THEME_COLORS).map(name => `
    <div class="theme-swatch ${name===current?'selected':''}" style="background:${THEME_COLORS[name]};" data-color="${name}" title="${name}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  `).join('');
  el.querySelectorAll('.theme-swatch').forEach(sw=>{
    sw.addEventListener('click', ()=>selectTheme(sw.dataset.color));
  });
}
function updateModeButtons(mode){
  const lightBtn = document.getElementById('mode-light-btn');
  const darkBtn = document.getElementById('mode-dark-btn');
  if(!lightBtn || !darkBtn) return;
  lightBtn.classList.toggle('selected', mode==='light');
  darkBtn.classList.toggle('selected', mode==='dark');
}
async function saveAppearance(color, mode){
  try{
    const r = await fetch('/api/settings/appearance', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ themeColor: color, themeMode: mode })
    });
    showToast(r.ok ? 'Background updated' : 'Could not save that, please try again', r.ok ? 'success' : 'error');
  }catch(e){
    showToast('Could not save that, please try again', 'error');
  }
}
function selectTheme(color){
  document.documentElement.dataset.theme = color;
  document.querySelectorAll('.theme-swatch').forEach(sw=>sw.classList.toggle('selected', sw.dataset.color===color));
  saveAppearance(color, document.documentElement.dataset.mode || 'light');
}
function selectMode(mode){
  document.documentElement.dataset.mode = mode;
  updateModeButtons(mode);
  saveAppearance(document.documentElement.dataset.theme || 'pink', mode);
}

/* ---------------- settings page: profile ---------------- */
async function saveUsername(){
  const input = document.getElementById('profile-username-input');
  const errEl = document.getElementById('username-error');
  errEl.textContent = '';
  const newUsername = input.value.trim();
  if(!newUsername){ errEl.textContent = 'Please enter a username'; return; }

  try{
    const r = await fetch('/api/account/username', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newUsername }) });
    const data = await r.json().catch(()=>null);
    if(!r.ok){ errEl.textContent = (data && data.message) || 'Could not update your username'; return; }
    showToast('Username updated', 'success');
  }catch(e){
    errEl.textContent = 'Could not update your username, please try again';
  }
}
async function savePassword(){
  const current = document.getElementById('current-password-input');
  const next = document.getElementById('new-password-input');
  const errEl = document.getElementById('password-error');
  errEl.textContent = '';

  try{
    const r = await fetch('/api/account/password', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ currentPassword: current.value, newPassword: next.value })
    });
    const data = await r.json().catch(()=>null);
    if(!r.ok){ errEl.textContent = (data && data.message) || 'Could not update your password'; return; }
    showToast('Password updated', 'success');
    current.value = '';
    next.value = '';
  }catch(e){
    errEl.textContent = 'Could not update your password, please try again';
  }
}

async function initSettingsPage(){
  try{
    const s = await apiGet('/api/settings');
    renderThemeSwatches(s.themeColor);
    updateModeButtons(s.themeMode);
    document.getElementById('profile-username-input').value = s.username;
  }catch(e){
    showToast('Could not load your settings', 'error');
  }

  document.getElementById('mode-light-btn').addEventListener('click', ()=>selectMode('light'));
  document.getElementById('mode-dark-btn').addEventListener('click', ()=>selectMode('dark'));
  document.getElementById('save-username-btn').addEventListener('click', saveUsername);
  document.getElementById('save-password-btn').addEventListener('click', savePassword);
}

/* ---------------- confetti ---------------- */
function burstConfetti(){
  const colors = AVATAR_COLORS;
  for(let i=0;i<24;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 6 + Math.random()*6;
    p.style.width = size+'px'; p.style.height = (size*0.4)+'px';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.borderRadius = Math.random()>0.5 ? '50%' : '3px';
    p.style.left = (40+Math.random()*20)+'vw'; p.style.top = '30vh'; p.style.opacity = '1';
    document.body.appendChild(p);
    const dx = (Math.random()-0.5)*260, dy = -120 - Math.random()*180, rot = Math.random()*360;
    p.animate([
      { transform:'translate(0,0) rotate(0deg)', opacity:1 },
      { transform:`translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity:1, offset:0.6 },
      { transform:`translate(${dx*1.2}px, ${dy+280}px) rotate(${rot*2}deg)`, opacity:0 }
    ], { duration: 1100 + Math.random()*500, easing:'cubic-bezier(.2,.8,.2,1)' });
    setTimeout(()=>p.remove(), 1700);
  }
}

/* ---------------- sprinkle backdrop ---------------- */
function scatterSprinkles(count){
  const colors = ['#ff6fb0','#5ac8ff','#7ce8c0','#ffd23f','#ff9fcd'];
  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    const isDot = Math.random()>0.5;
    el.className = 'sprinkle ' + (isDot?'dot':'stick');
    const size = 5 + Math.random()*12;
    el.style.width = (isDot?size:size*2.4)+'px';
    el.style.height = size+'px';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.left = Math.random()*100+'vw';
    el.style.top = Math.random()*100+'vh';
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.opacity = 0.3;
    document.body.appendChild(el);
  }
}

/* ---------------- init ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  scatterSprinkles(30);

  const overlay = document.getElementById('overlay');
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

  const headerAdd = document.getElementById('header-add-btn');
  if(headerAdd) headerAdd.addEventListener('click', ()=>openAddModal());

  const fab = document.getElementById('fab-add');
  if(fab) fab.addEventListener('click', ()=>openAddModal());

  const redeemBtn = document.getElementById('redeem-code-btn');
  const redeemInput = document.getElementById('redeem-code-input');
  if(redeemBtn && redeemInput){
    redeemBtn.addEventListener('click', redeemShareCode);
    redeemInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') redeemShareCode(); });
  }

  if(document.querySelector('.cal-toggle')){
    document.querySelectorAll('.cal-toggle button').forEach(btn=>{
      btn.addEventListener('click', ()=>{ calMode = btn.dataset.mode; renderCalendar(); });
    });
    document.getElementById('cal-prev').addEventListener('click', ()=>shiftCal(-1));
    document.getElementById('cal-next').addEventListener('click', ()=>shiftCal(1));
  }

  const bellBtn = document.getElementById('notif-bell-btn');
  if(bellBtn){
    bellBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      document.getElementById('notif-panel').classList.toggle('active');
    });
    document.addEventListener('click', ()=>{ document.getElementById('notif-panel').classList.remove('active'); });
  }

  if(document.getElementById('people-list') || document.getElementById('cal-body')){
    await refreshOccasions();
    refreshNotifications();
    setInterval(refreshNotifications, 60000);
  }

  loadNotificationSettings();

  if(document.getElementById('theme-swatches')){
    initSettingsPage();
  }

  if(window.SHARE_TOKEN){
    initSharePage();
  }
});
