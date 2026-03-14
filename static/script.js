/* ===================================================
   EduTrack — Core Application Script V4
   =================================================== */

'use strict';

// ────────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────────
const State = {
    data: null,
    charts: {},
    sortDir: 'date-desc',
    theme: localStorage.getItem('edu-theme') || 'dark',
};

// ────────────────────────────────────────────────────
// UTILITY
// ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function switchScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('is-active'));
    $(id).classList.add('is-active');
}

function parseVoto(str) {
    if (!str) return null;
    let n = parseFloat(String(str).replace(',', '.'));
    if (isNaN(n)) return null;
    if (str.includes('+')) n += 0.25;
    if (str.endsWith('-')) n -= 0.25;
    if (str.includes('½') || str.includes('1/2')) n += 0.5;
    return n;
}

function votoClass(n) {
    if (n === null) return 'warn';
    if (n >= 7.5) return 'ok';
    if (n >= 6)   return 'warn';
    return 'danger';
}

function truncate(str, n = 50) {
    return str && str.length > n ? str.substring(0, n) + '…' : (str || '');
}

function formatDate(str) {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('it-IT', {day:'2-digit',month:'short'}); } catch { return str; }
}

function animateValue(el, start, end, duration = 800) {
    if (!el) return;
    const startTime = performance.now();
    const diff = end - start;
    function step(ts) {
        const elapsed = ts - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (start + diff * eased).toFixed(typeof end === 'number' && end % 1 !== 0 ? 2 : 0);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ────────────────────────────────────────────────────
// THEME
// ────────────────────────────────────────────────────
function applyTheme(theme) {
    State.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('edu-theme', theme);

    // Aggiorna colori Chart.js
    Chart.defaults.color = theme === 'dark' ? '#8b8b9e' : '#6b6b80';
}
applyTheme(State.theme);

$('theme-toggle').addEventListener('click', () => {
    applyTheme(State.theme === 'dark' ? 'light' : 'dark');
    // Ridisegna i grafici con i nuovi colori
    if (State.charts.dash)   { State.charts.dash.destroy();   State.charts.dash   = null; }
    if (State.charts.medie)  { State.charts.medie.destroy();  State.charts.medie  = null; }
    if (State.charts.radar)  { State.charts.radar.destroy();  State.charts.radar  = null; }
    if (State.charts.spark)  { State.charts.spark.destroy();  State.charts.spark  = null; }
    if (State.data) {
        const current = document.querySelector('.sb-link.is-active')?.dataset.view;
        renderChartIfNeeded(current);
    }
});

// ────────────────────────────────────────────────────
// DATE DISPLAY
// ────────────────────────────────────────────────────
function updateDateDisplay() {
    const now = new Date();
    $('current-date').textContent = now.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'})
        .replace(/^./, c => c.toUpperCase());
}
updateDateDisplay();
setInterval(updateDateDisplay, 60000);

// ────────────────────────────────────────────────────
// NAVIGATION (Sidebar + Mobile Bottom Nav)
// ────────────────────────────────────────────────────
const pageTitles = {
    dashboard: 'Dashboard',
    voti:      'Voti e Valutazioni',
    agenda:    'Calendaro Agenda',
    compiti:   'Compiti & Studio',
    assenze:   'Registro Assenze',
    note:      'Note Disciplinari',
};

function navigateTo(view) {
    // Update sidebar links
    $$('.sb-link').forEach(l => l.classList.toggle('is-active', l.dataset.view === view));
    // Update bottom nav
    $$('.bn-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));

    // Hide all views
    $$('.view').forEach(v => v.classList.remove('is-active'));
    const target = $(`view-${view}`);
    if (!target) return;

    // Animate view in
    target.classList.add('is-active');
    $('tb-page-title').textContent = pageTitles[view] || view;

    // Close mobile sidebar
    closeMobileSidebar();

    // Render charts if needed
    if (State.data) renderChartIfNeeded(view);

    // Trigger stagger animation reset for child elements
    target.querySelectorAll('[class*="anim-fade-up"]').forEach(el => {
        el.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight; // reflow
        el.style.animation = '';
    });
}

// Sidebar & Bottom Nav listeners
$$('.sb-link, .bn-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTo(el.dataset.view); });
});

// Mobile sidebar toggle
const sidebar = $('sidebar');
const overlay = $('sidebar-overlay');
const menuBtn = $('mobile-menu-btn');

function openMobileSidebar()  { sidebar.classList.add('is-open'); overlay.classList.add('is-open'); }
function closeMobileSidebar() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); }

menuBtn.addEventListener('click', openMobileSidebar);
overlay.addEventListener('click', closeMobileSidebar);

// ────────────────────────────────────────────────────
// LOGOUT
// ────────────────────────────────────────────────────
$('logout-btn').addEventListener('click', () => {
    $('app-screen').style.opacity = '0';
    $('app-screen').style.transition = 'opacity .4s';
    setTimeout(() => fetch('/api/logout', { method:'POST' }).then(() => location.reload()), 350);
});

// ────────────────────────────────────────────────────
// SHOW PASSWORD TOGGLE
// ────────────────────────────────────────────────────
$('toggle-pwd').addEventListener('click', () => {
    const pwd = $('password');
    const ico = $('toggle-pwd').querySelector('i');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        ico.className = 'fa-solid fa-eye-slash';
        $('toggle-pwd').style.color = 'var(--c-primary)';
    } else {
        pwd.type = 'password';
        ico.className = 'fa-solid fa-eye';
        $('toggle-pwd').style.color = '';
    }
});

// ────────────────────────────────────────────────────
// REMEMBER-ME: Precompila i campi al caricamento
// ────────────────────────────────────────────────────
(function loadSavedCredentials() {
    const saved = JSON.parse(localStorage.getItem('edu-creds') || 'null');
    if (saved) {
        $('username').value = saved.u || '';
        $('password').value = saved.p || '';
        $('remember-me').checked = true;
    }
})();

// ────────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────────
$('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('username').value.trim();
    const password = $('password').value;
    const remember = $('remember-me').checked;
    const errEl    = $('login-error');
    const btn      = $('login-btn');
    const ctaTxt   = btn.querySelector('.cta-text');
    const ctaLoad  = btn.querySelector('.cta-loader');

    errEl.textContent = '';
    ctaTxt.hidden  = true;
    ctaLoad.hidden = false;
    btn.disabled   = true;

    try {
        const res  = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (data.success) {
            // Salva credenziali se remember-me attivo
            if (remember) {
                localStorage.setItem('edu-creds', JSON.stringify({ u: username, p: password }));
            } else {
                localStorage.removeItem('edu-creds');
            }
            $('user-display').textContent      = username;
            $('sb-avatar-initial').textContent = username[0]?.toUpperCase() || 'S';
            switchScreen('sync-screen');
            runSync();
        } else {
            throw new Error(data.message || 'Credenziali non valide.');
        }
    } catch (err) {
        errEl.textContent = err.message;
        ctaTxt.hidden  = false;
        ctaLoad.hidden = true;
        btn.disabled   = false;
        $('login-form').animate([
            { transform:'translateX(-6px)' },
            { transform:'translateX(6px)' },
            { transform:'translateX(-4px)' },
            { transform:'translateX(4px)' },
            { transform:'translateX(0)' },
        ], { duration: 400, easing:'ease-out' });
    }
});

// ────────────────────────────────────────────────────
// SYNC / DATA FETCH
// ────────────────────────────────────────────────────
const syncSteps = [
    [10,  'Connessione al server d\'istituto…'],
    [30,  'Recupero voti e valutazioni…'],
    [55,  'Scaricamento agenda e compiti…'],
    [75,  'Analisi assenze e giustificazioni…'],
    [90,  'Preparazione interfaccia…'],
    [100, 'Completato!'],
];

async function runSync() {
    const fill   = $('sync-fill');
    const status = $('sync-status');
    let stepIdx  = 0;

    const ticker = setInterval(() => {
        if (stepIdx >= syncSteps.length) { clearInterval(ticker); return; }
        const [pct, txt] = syncSteps[stepIdx++];
        fill.style.width   = pct + '%';
        status.textContent = txt;
    }, 500);

    try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('Errore di rete');
        State.data = await res.json();

        clearInterval(ticker);
        fill.style.width   = '100%';
        status.textContent = 'Completato!';

        populateAll(State.data);

        setTimeout(() => {
            switchScreen('app-screen');
            navigateTo('dashboard');
        }, 500);

    } catch (err) {
        clearInterval(ticker);
        alert('Errore durante la sincronizzazione. Riprova.');
        location.reload();
    }
}

// ────────────────────────────────────────────────────
// POPULATE ALL DATA
// ────────────────────────────────────────────────────
function populateAll(data) {
    populateDashboard(data);
    populateVoti(data.voti);
    populateAgenda(data.agenda);
    populateCompiti(data.argomenti);
    populateAssenze(data.assenze);
    populateNote(data.note);
}

// ── DASHBOARD ──────────────────────────────────────
function populateDashboard(data) {
    const votiNums = data.voti.map(v => parseVoto(v.voto)).filter(n => n !== null);
    const media    = votiNums.length ? (votiNums.reduce((a,b) => a+b,0) / votiNums.length) : 0;
    const positivi = votiNums.filter(n => n >= 6).length;
    const compiti  = data.argomenti.filter(a => /asseg|compit/i.test(a.tipo)).length;
    const assenze  = data.assenze.length;
    const dagiust  = data.assenze.filter(a => !a.giustificata).length;

    // KPI counters with animation
    const mediaEl = $('dash-media');
    animateValue(mediaEl, 0, media, 900);
    animateValue($('dash-compiti'), 0, compiti, 700);
    animateValue($('dash-assenze'), 0, assenze, 700);
    animateValue($('dash-positivi'), 0, positivi, 700);

    $('dash-giustifiche').innerHTML = dagiust > 0
        ? `<span style="color:var(--c-danger)"><i class='fa-solid fa-circle-exclamation'></i> ${dagiust} da giustificare</span>`
        : `<span style="color:var(--c-ok)"><i class='fa-solid fa-circle-check'></i> Tutto ok</span>`;

    // Agenda panel
    const agendaEl = $('dash-agenda');
    agendaEl.innerHTML = '';
    const items = data.agenda.slice(0, 5);
    if (!items.length) {
        agendaEl.innerHTML = `<li class="ev-item"><div class="ev-body"><div class="ev-title" style="color:var(--c-muted)">Nessun impegno in agenda</div></div></li>`;
    } else {
        items.forEach(a => {
            const isVerifica = /ver/i.test(a.tipo);
            const isCompito  = /compit/i.test(a.tipo);
            const dotCls     = isVerifica ? 'danger' : isCompito ? 'warn' : '';
            agendaEl.innerHTML += `
            <li class="ev-item">
                <div class="ev-dot ${dotCls}"></div>
                <div class="ev-body">
                    <div class="ev-title">${truncate(a.titolo, 48)}</div>
                    <div class="ev-meta">
                        <span><i class='fa-regular fa-calendar'></i> ${a.data}</span>
                        <span><i class='fa-regular fa-clock'></i> ${a.orario || 'ND'}</span>
                        <span class="badge badge-muted">${a.tipo}</span>
                    </div>
                </div>
            </li>`;
        });
    }

    // Subject progress bars
    const sbEl = $('subject-bars');
    sbEl.innerHTML = '';
    const materieMap = buildMaterieMap(data.voti);
    const entries = Object.entries(materieMap).sort((a,b) => b[1].media - a[1].media);
    $('badge-materie').textContent = `${entries.length} materie`;
    entries.forEach(([mat, info]) => {
        const m = info.media;
        const fillCls = m >= 6.5 ? '' : m >= 6 ? 'fill-warn' : 'fill-danger';
        sbEl.innerHTML += `
        <div class="sb-row">
            <span class="sb-materia" title="${mat}">${truncate(mat, 18)}</span>
            <div class="sb-track"><div class="sb-fill ${fillCls}" style="width:0%" data-w="${(m/10)*100}%"></div></div>
            <span class="sb-valore">${m.toFixed(1)}</span>
        </div>`;
    });
    // Animate bars after paint
    requestAnimationFrame(() => {
        sbEl.querySelectorAll('.sb-fill').forEach(b => { b.style.width = b.dataset.w; });
    });
}

// ── VOTI ───────────────────────────────────────────
function populateVoti(voti) {
    renderVotiTable(voti);

    // Populate materia filter
    const sel = $('filter-materia');
    sel.innerHTML = '<option value="all">Tutte le materie</option>';
    [...new Set(voti.map(v => v.materia))].sort().forEach(m => {
        sel.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

function renderVotiTable(voti) {
    const tbody = $('voti-body');
    tbody.innerHTML = '';
    if (!voti.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--c-muted)">Nessun voto registrato.</td></tr>`;
        return;
    }
    voti.forEach(v => {
        const n   = parseVoto(v.voto);
        const cls = votoClass(n);
        const esito = n === null ? '<span class="badge badge-muted">N/D</span>'
            : n >= 6 ? '<span class="badge badge-ok">Positivo</span>'
            : '<span class="badge badge-danger">Insufficiente</span>';
        tbody.innerHTML += `
        <tr data-materia="${v.materia}">
            <td style="color:var(--c-muted);font-size:.82rem">${v.data}</td>
            <td style="font-weight:600">${v.materia}</td>
            <td><div class="voto-chip ${cls}">${v.voto}</div></td>
            <td><span class="badge badge-muted">${v.tipo || '—'}</span></td>
            <td>${esito}</td>
        </tr>`;
    });
}

// ── AGENDA (grouped by day) ────────────────────────
function populateAgenda(agenda) {
    renderAgenda(agenda, 'all');
    $('filter-tipo-agenda').addEventListener('change', e => renderAgenda(agenda, e.target.value));
}

function renderAgenda(agenda, filter) {
    const cont = $('agenda-container');
    cont.innerHTML = '';
    cont.classList.add('agenda-by-day');

    const filtered = filter === 'all' ? agenda : agenda.filter(a => {
        const t = a.tipo.toLowerCase();
        if (filter === 'verifica') return t.includes('ver');
        if (filter === 'compito')  return t.includes('compit') || t.includes('asseg');
        return !t.includes('ver') && !t.includes('compit') && !t.includes('asseg');
    });

    if (!filtered.length) {
        cont.innerHTML = `<p style="color:var(--c-muted);padding:20px">Nessun evento trovato.</p>`;
        return;
    }

    // Raggruppa per data
    const byDay = {};
    filtered.forEach(a => {
        const dayKey = a.data || 'Senza data';
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push(a);
    });

    // Ordina le date
    const sortedDays = Object.keys(byDay).sort((a, b) => {
        const pa = parseDateIT(a), pb = parseDateIT(b);
        return pa - pb;
    });

    sortedDays.forEach(day => {
        const items  = byDay[day];
        const dateObj = parseDateIT(day);
        const isValid = !isNaN(dateObj.getTime());
        const dayName = isValid ? dateObj.toLocaleDateString('it-IT', { weekday:'long' }).replace(/^./, c => c.toUpperCase()) : day;
        const dayFull = isValid ? dateObj.toLocaleDateString('it-IT', { day:'numeric', month:'long', year:'numeric' }) : day;
        const today   = new Date(); today.setHours(0,0,0,0);
        const isPast  = isValid && dateObj < today;

        const block = document.createElement('div');
        block.className = 'agenda-day-block';
        block.innerHTML = `
        <div class="agenda-day-header">
            <div class="agenda-day-pill" style="${isPast ? 'opacity:.55' : ''}">
                <i class="fa-regular fa-calendar"></i>${dayName}
            </div>
            <span class="agenda-day-full">${dayFull}</span>
            <div class="agenda-day-line"></div>
            <span class="agenda-day-count">${items.length} evento${items.length > 1 ? 'i' : ''}</span>
        </div>
        <div class="agenda-day-grid" id="daygrid-${day.replace(/\//g,'-')}"></div>`;

        cont.appendChild(block);

        const grid = block.querySelector('.agenda-day-grid');
        items.forEach(a => {
            const isV   = /ver/i.test(a.tipo);
            const isC   = /compit|asseg/i.test(a.tipo);
            const badge = isV ? 'badge-danger' : isC ? 'badge-warn' : 'badge-primary';
            const cls   = isV ? 'ag-verifica' : isC ? 'ag-compito' : 'ag-evento';
            grid.innerHTML += `
            <div class="ag-card ${cls}" style="${isPast ? 'opacity:.6' : ''}">
                <div class="ag-top">
                    <span class="ag-date"><i class='fa-regular fa-clock' style='margin-right:5px'></i>${a.orario || '—'}</span>
                    <span class="badge ${badge}">${a.tipo}</span>
                </div>
                <div class="ag-title">${a.titolo}</div>
                <div class="ag-docente"><i class='fa-solid fa-chalkboard-user'></i>${a.docente || 'ND'}</div>
            </div>`;
        });
    });
}

function parseDateIT(str) {
    if (!str) return new Date(NaN);
    // Formato DD/MM/YYYY o YYYY-MM-DD
    if (str.includes('/')) {
        const [d, m, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(str);
}

// ── COMPITI — TIMELINE per DATA ────────────────────
let _allArgomenti = [];

function populateCompiti(argomenti) {
    _allArgomenti = argomenti;
    renderTimeline(argomenti, 'all');

    // Filter buttons
    const btnAll     = $('filter-compiti-all');
    const btnCompiti = $('filter-compiti-compiti');
    const btnStudio  = $('filter-compiti-studio');

    function setActive(active) {
        [btnAll, btnCompiti, btnStudio].forEach(b => b.classList.remove('active'));
        active.classList.add('active');
    }
    btnAll.addEventListener('click',     () => { setActive(btnAll);     renderTimeline(_allArgomenti, 'all'); });
    btnCompiti.addEventListener('click', () => { setActive(btnCompiti); renderTimeline(_allArgomenti, 'compiti'); });
    btnStudio.addEventListener('click',  () => { setActive(btnStudio);  renderTimeline(_allArgomenti, 'studio'); });
}

function renderTimeline(argomenti, filter) {
    const tl = $('compiti-timeline');
    tl.innerHTML = '';

    // Filtra
    let items = argomenti;
    if (filter === 'compiti') items = argomenti.filter(a =>  /asseg|compit/i.test(a.tipo));
    if (filter === 'studio')  items = argomenti.filter(a => !/asseg|compit/i.test(a.tipo));

    if (!items.length) {
        tl.innerHTML = `<p style="color:var(--c-muted);padding:20px">Nessun elemento trovato.</p>`;
        return;
    }

    // Raggruppa per data
    const byDay = {};
    items.forEach(a => {
        const k = a.data || 'Senza data';
        if (!byDay[k]) byDay[k] = [];
        byDay[k].push(a);
    });

    const sortedDays = Object.keys(byDay).sort((a, b) => parseDateIT(b) - parseDateIT(a)); // più recenti prima

    // Carica dati completati da localStorage
    const doneSet = new Set(JSON.parse(localStorage.getItem('edu-done') || '[]'));

    sortedDays.forEach(day => {
        const dayItems = byDay[day];
        const dateObj = parseDateIT(day);
        const isValid = !isNaN(dateObj.getTime());
        const dayNum  = isValid ? dateObj.getDate() : '?';
        const dayMon  = isValid ? dateObj.toLocaleDateString('it-IT', { month:'short' }).toUpperCase() : '';
        const dayFull = isValid ? dateObj.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' }).replace(/^./, c => c.toUpperCase()) : day;

        const block = document.createElement('div');
        block.className = 'tl-day-block';
        block.innerHTML = `
        <div class="tl-day-header">
            <div class="tl-day-dot">
                <span class="tl-dot-num">${dayNum}</span>
                <span class="tl-dot-mon">${dayMon}</span>
            </div>
            <div class="tl-day-info">
                <div class="tl-day-name">${dayFull}</div>
                <div class="tl-day-count">${dayItems.length} attività</div>
            </div>
        </div>
        <div class="tl-cards" id="tlcards-${day.replace(/\//g,'-')}"></div>`;

        tl.appendChild(block);
        const cardsContainer = block.querySelector('.tl-cards');

        dayItems.forEach((c, idx) => {
            const isCompito = /asseg|compit/i.test(c.tipo);
            const accentCls = isCompito ? 'compito' : 'studio';
            const cardKey   = `${day}_${c.materia}_${idx}`;
            const isDone    = doneSet.has(cardKey);

            const card = document.createElement('div');
            card.className = `tl-card${isDone ? ' done' : ''}${!isCompito ? ' studio' : ''}` ;
            card.dataset.key = cardKey;
            card.innerHTML = `
            <div class="tl-card-accent ${accentCls}"></div>
            <div class="tl-card-body">
                <span class="tl-card-meta">${c.materia} · <span class="badge ${isCompito ? 'badge-warn' : 'badge-ok'}">${c.tipo}</span></span>
                <div class="tl-card-main">${c.tipo}</div>
                <div class="tl-card-desc">${truncate(c.contenuto, 120)}</div>
            </div>
            ${isCompito ? `<button class="tl-check-btn" title="Segna completato"><i class="fa-${isDone ? 'solid' : 'regular'} fa-circle-check"></i></button>` : ''}`;

            if (isCompito) {
                card.querySelector('.tl-check-btn').addEventListener('click', () => {
                    card.classList.toggle('done');
                    const nowDone = card.classList.contains('done');
                    const ico = card.querySelector('.tl-check-btn i');
                    ico.className = `fa-${nowDone ? 'solid' : 'regular'} fa-circle-check`;
                    // Animazione
                    card.animate(
                        [{ transform:'scale(.96)' }, { transform:'scale(1)' }],
                        { duration:250, easing:'cubic-bezier(.34,1.56,.64,1)' }
                    );
                    // Persisti in localStorage
                    const ds = new Set(JSON.parse(localStorage.getItem('edu-done') || '[]'));
                    nowDone ? ds.add(cardKey) : ds.delete(cardKey);
                    localStorage.setItem('edu-done', JSON.stringify([...ds]));
                });
            }
            cardsContainer.appendChild(card);
        });
    });
}

// ── ASSENZE ─────────────────────────────────────────

/* ===================================================
   CALCOLO ORE SCUOLA — Istituto Tecnico 2025/2026
   Lun/Mar/Mer/Ven/Sab = 6h  |  Gio = 8h
   (Questa scuola: Lun–Ven, calcola Sabato se in programma)
   Anno scolastico: 15 Sep 2025 → 10 Jun 2026
   Esclusi: festivi nazionali italiani standard
   =================================================== */

const SCHOOL_START = new Date(2025, 8, 15); // 15 Settembre 2025
const SCHOOL_END   = new Date(2026, 5, 10); // 10 Giugno 2026

// Festivi nazionali fissi (MM-DD) + festivi anno specifico
const FESTIVI_FISSI = new Set([
    '01-01', '01-06', '04-25', '05-01', '06-02',
    '08-15', '11-01', '12-08', '12-25', '12-26',
]);
// Festivi mobili 2025-2026 (Pasqua 5 Apr 2026 → Lunedì Angelo 6 Apr 2026)
const FESTIVI_DATE = new Set([
    '2025-11-02', // Commemorazione defunti (pontes comuni)
    '2025-12-24', '2025-12-27', '2025-12-28', '2025-12-29',
    '2025-12-30', '2025-12-31', '2026-01-02',  // Vacanze Natale
    '2026-03-02', '2026-03-03', '2026-03-04',  // Carnevale (appross.)
    '2026-04-05', '2026-04-06',                // Pasqua + Lunedì
]);

function isFestivo(d) {
    const mmdd = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const yyyymmdd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return FESTIVI_FISSI.has(mmdd) || FESTIVI_DATE.has(yyyymmdd);
}

function getOrePer(date) {
    const dow = date.getDay(); // 0=Dom 1=Lun 2=Mar 3=Mer 4=Gio 5=Ven 6=Sab
    if (dow === 0) return 0; // Domenica no scuola
    if (isFestivo(date)) return 0;
    return dow === 4 ? 8 : 6; // Giovedì=8, altri giorni scolastici=6
}

function calcTotaleOreAnno() {
    let tot = 0;
    const cur = new Date(SCHOOL_START);
    while (cur <= SCHOOL_END) {
        tot += getOrePer(cur);
        cur.setDate(cur.getDate() + 1);
    }
    return tot;
}

function classifyAssenza(tipo) {
    const t = tipo.toLowerCase();
    if (t.includes('ritardo') || t.includes('entrat') || t.includes('in ritardo')) return 'ritardo';
    if (t.includes('uscit') || t.includes('permess') || t.includes('anticipata')) return 'uscita';
    if (t.includes('assenz') || t.includes('absent')) return 'assenza';
    return 'altro';
}

function calcOreAssenza(tipo, dataStr) {
    const cat = classifyAssenza(tipo);
    if (cat === 'assenza') {
        // Ore intere basate sul giorno della settimana
        const d = parseDateIT(dataStr);
        if (!isNaN(d.getTime())) return getOrePer(d) || 6;
        return 6;
    }
    if (cat === 'ritardo' || cat === 'uscita') {
        // Un ritardo/uscita conta come 1h equivalente
        return 1;
    }
    return 1;
}

function populateAssenze(assenze) {
    const SOGLIA_PCT = 25;
    const totAnno   = calcTotaleOreAnno();

    // Classificazione
    let nAssenze = 0, nRitardi = 0, nUscite = 0, nOk = 0, nNg = 0;
    let oreAssenze = 0, oreRitardi = 0, oreUscite = 0, oreTotMancate = 0;

    assenze.forEach(a => {
        const cat = classifyAssenza(a.tipo);
        const ore = calcOreAssenza(a.tipo, a.data);
        oreTotMancate += ore;

        if (cat === 'assenza') { nAssenze++; oreAssenze += ore; }
        else if (cat === 'ritardo') { nRitardi++; oreRitardi += ore; }
        else if (cat === 'uscita')  { nUscite++;  oreUscite += ore; }

        if (a.giustificata) nOk++;
        else nNg++;
    });

    const pct       = totAnno > 0 ? (oreTotMancate / totAnno) * 100 : 0;
    const pctStr    = pct.toFixed(1);
    const oreRimaste = Math.max(0, totAnno * (SOGLIA_PCT / 100) - oreTotMancate);

    // ── Barra rischio ────────────────────────────────────
    const badge   = $('arc-pct-badge');
    const barFill = $('arc-bar-fill');

    // Anima la barra da 0 a pct (ma la barra rappresenta pct su 100%, con soglia visuale al 25%)
    // La barra piena = 100% corrisponde alla soglia (25% delle ore); oltre la soglia la barra va oltre
    const barPct = Math.min((pct / SOGLIA_PCT) * 100, 110); // vai fino a 110% per mostrare il superamento

    setTimeout(() => {
        barFill.style.width = barPct + '%';
    }, 300);

    badge.textContent = pctStr + '%';
    badge.className   = 'arc-pct-badge';
    barFill.className = 'arc-bar-fill';

    if (pct >= SOGLIA_PCT) {
        badge.classList.add('pct-danger');
        barFill.classList.add('bar-danger');
    } else if (pct >= SOGLIA_PCT * 0.7) {
        badge.classList.add('pct-warn');
        barFill.classList.add('bar-warn');
    }

    $('arc-legend-hours').textContent  = `${oreTotMancate}h mancate`;
    $('arc-legend-total').textContent  = `su ${totAnno}h totali anno scolastico`;
    const leftEl = $('arc-legend-left');
    if (pct >= SOGLIA_PCT) {
        leftEl.innerHTML = `<span style="color:var(--c-danger);font-weight:700"><i class="fa-solid fa-skull-crossbones"></i> Soglia SUPERATA di ${(oreTotMancate - totAnno*SOGLIA_PCT/100).toFixed(0)}h</span>`;
    } else {
        leftEl.innerHTML = `<span style="color:var(--c-ok);font-weight:700"><i class="fa-solid fa-shield-halved"></i> Margine: ancora ${oreRimaste.toFixed(0)}h prima del 25%</span>`;
    }

    // ── KPI Cards ────────────────────────────────────────
    animateValue($('sum-assenze'), 0, nAssenze, 600);
    animateValue($('sum-ritardi'), 0, nRitardi, 600);
    animateValue($('sum-uscite'),  0, nUscite,  600);
    animateValue($('sum-ok'),      0, nOk,      600);
    $('sum-assenze-h').textContent = `${oreAssenze}h equiv.`;
    $('sum-ritardi-h').textContent = `${oreRitardi}h equiv.`;
    $('sum-uscite-h').textContent  = `${oreUscite}h equiv.`;
    $('sum-ng-label').innerHTML    = nNg > 0
        ? `<span style="color:var(--c-danger)">${nNg} da giustificare</span>`
        : `<span style="color:var(--c-ok)">Tutte giustificate</span>`;

    // ── Tabella ──────────────────────────────────────────
    const giorniIT = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];

    function renderAssenzeTable(list) {
        const tbody = $('assenze-body');
        tbody.style.opacity = '0';
        tbody.style.transition = 'opacity .25s';
        setTimeout(() => {
            tbody.innerHTML = '';
            if (!list.length) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--c-muted)">Nessun risultato.</td></tr>`;
                tbody.style.opacity = '1';
                return;
            }
            list.forEach(a => {
                const cat   = classifyAssenza(a.tipo);
                const ore   = calcOreAssenza(a.tipo, a.data);
                const isOre = ore >= 6;
                const stato = a.giustificata
                    ? `<span class='badge badge-ok'><i class='fa-solid fa-check'></i> Giustificata</span>`
                    : `<span class='badge badge-danger'><i class='fa-solid fa-xmark'></i> Da giustificare</span>`;

                let tipoCls  = 'tipo-altro';
                let tipoTxt  = a.tipo;
                if (cat === 'assenza') tipoCls = 'tipo-assenza';
                if (cat === 'ritardo') tipoCls = 'tipo-ritardo';
                if (cat === 'uscita')  tipoCls = 'tipo-uscita';

                const d = parseDateIT(a.data);
                const giorno = !isNaN(d.getTime()) ? giorniIT[d.getDay()] : '—';

                tbody.innerHTML += `
                <tr data-cat="${cat}">
                    <td style="font-weight:600">${a.data}</td>
                    <td style="color:var(--c-muted);font-size:.85rem">${giorno}</td>
                    <td><span class="badge ${tipoCls}">${tipoTxt}</span></td>
                    <td><span class="ore-chip ${isOre ? 'full' : 'part'}"><i class="fa-regular fa-clock"></i>${ore}h</span></td>
                    <td style="color:var(--c-muted);font-size:.88rem">${a.descrizione || '—'}</td>
                    <td>${stato}</td>
                </tr>`;
            });
            tbody.style.opacity = '1';
        }, 250);
    }

    renderAssenzeTable(assenze);

    // Filtro tipo
    $('filter-tipo-assenze').addEventListener('change', e => {
        const v = e.target.value;
        if (v === 'all') return renderAssenzeTable(assenze);
        renderAssenzeTable(assenze.filter(a => classifyAssenza(a.tipo) === v));
    });
}


// ── NOTE ────────────────────────────────────────────
function populateNote(note) {
    const cont = $('note-body');
    cont.innerHTML = '';
    if (!note || !note.length) {
        cont.innerHTML = `
        <div class="note-card" style="border-left-color:var(--c-ok);border-color:var(--c-ok-l)">
            <i class='fa-solid fa-face-smile' style="color:var(--c-ok)"></i>
            <div><div class="note-head" style="color:var(--c-ok)">Nessuna nota disciplinare</div>
            <div class="note-text" style="font-style:normal">Condotta esemplare, nessuna annotazione nel registro.</div></div>
        </div>`;
        return;
    }
    note.forEach(n => {
        cont.innerHTML += `
        <div class="note-card">
            <i class='fa-solid fa-triangle-exclamation'></i>
            <div>
                <div class="note-head">Nota / Annotazione</div>
                <div class="note-text">"${n.contenuto}"</div>
            </div>
        </div>`;
    });
}

// ── UTILITY: Medie per Materia ──────────────────────
function buildMaterieMap(voti) {
    const map = {};
    voti.forEach(v => {
        const n = parseVoto(v.voto);
        if (n === null) return;
        if (!map[v.materia]) map[v.materia] = { sum:0, count:0, media:0, voti:[] };
        map[v.materia].sum   += n;
        map[v.materia].count += 1;
        map[v.materia].voti.push(n);
    });
    Object.keys(map).forEach(k => { map[k].media = map[k].sum / map[k].count; });
    return map;
}

// ─────────────────────────────────────────────────────
// CHARTS (Chart.js 4)
// ─────────────────────────────────────────────────────
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.animation   = { duration: 1000, easing: 'easeOutQuart' };

function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
function gridColor() { return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }

function renderChartIfNeeded(view) {
    if (view === 'dashboard') {
        if (!State.charts.dash)  renderDashChart();
        if (!State.charts.spark) renderSparkChart();
    }
    if (view === 'voti') {
        if (!State.charts.medie) renderMedieChart();
        if (!State.charts.radar) renderRadarChart();
    }
}

function renderDashChart() {
    const voti = State.data.voti;
    const nums = voti.map(v => parseVoto(v.voto)).filter(n => n !== null);
    if (!nums.length) return;

    const ctx = $('dashChart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, 'rgba(37,99,235,.35)');
    grad.addColorStop(1, 'rgba(37,99,235,.0)');

    // Chip range filter
    let range = 'all';
    function drawChart(r) {
        range = r;
        const slice = r === 'all' ? nums : (r === '10' ? nums.slice(-10) : nums.slice(-5));
        const labels = slice.map((_,i) => `#${i+1}`);
        if (State.charts.dash) State.charts.dash.destroy();
        State.charts.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: slice, fill: true,
                    backgroundColor: grad, borderColor: '#2563eb',
                    borderWidth: 2.5, tension: .4, pointRadius: 4,
                    pointBackgroundColor: '#fff', pointBorderColor: '#2563eb',
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend:{ display:false }, tooltip:{ padding:12, cornerRadius:10 } },
                scales: {
                    y: { min:2, max:10, grid:{ color: gridColor() }, border:{ dash:[4,4] } },
                    x: { grid:{ display:false } }
                }
            }
        });
    }
    drawChart('all');

    // Chip click handlers
    $$('.chip[data-range]').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('.chip[data-range]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            drawChart(chip.dataset.range);
        });
    });
}

function renderSparkChart() {
    const nums = State.data.voti.map(v => parseVoto(v.voto)).filter(n => n !== null).slice(-8);
    if (!nums.length) return;
    const ctx = $('sparkMedia')?.getContext('2d');
    if (!ctx) return;
    State.charts.spark = new Chart(ctx, {
        type: 'line',
        data: {
            labels: nums.map((_,i) => i),
            datasets: [{ data: nums, borderColor:'rgba(37,99,235,.6)', borderWidth:2, pointRadius:0, tension:.4 }]
        },
        options: { responsive:true, maintainAspectRatio:false, animation:false,
            plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:false}} }
    });
}

function renderMedieChart() {
    const map = buildMaterieMap(State.data.voti);
    const entries = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
    const labels  = entries.map(([k]) => truncate(k, 14));
    const medie   = entries.map(([,v]) => v.media.toFixed(2));
    const colors  = entries.map(([,v]) => v.media >= 6 ? '#2563eb' : '#ef4444');

    const ctx = $('materieChart').getContext('2d');
    if (State.charts.medie) State.charts.medie.destroy();
    State.charts.medie = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets:[{ data: medie, backgroundColor: colors, borderRadius:8, barPercentage:.65 }] },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins: { legend:{display:false}, tooltip:{ padding:10, cornerRadius:10 } },
            scales: {
                y: { min:0, max:10, grid:{ color: gridColor() }, border:{ dash:[4,4] } },
                x: { grid:{ display:false } }
            }
        }
    });
}

function renderRadarChart() {
    const map = buildMaterieMap(State.data.voti);
    const entries = Object.entries(map).slice(0, 8); // max 8 assi
    if (entries.length < 2) return;
    const labels = entries.map(([k]) => truncate(k, 12));
    const medie  = entries.map(([,v]) => v.media);

    const ctx = $('radarChart').getContext('2d');
    if (State.charts.radar) State.charts.radar.destroy();
    State.charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                data: medie, fill: true,
                backgroundColor: 'rgba(37,99,235,.2)',
                borderColor: '#2563eb', pointBackgroundColor: '#2563eb',
                borderWidth: 2, pointRadius: 4
            }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins: { legend:{display:false} },
            scales: { r: { min:0, max:10, grid:{ color: gridColor() }, pointLabels:{color:'var(--c-muted)', font:{size:11}} } }
        }
    });
}

// ─────────────────────────────────────────────────────
// FILTERS & SEARCH
// ─────────────────────────────────────────────────────
$('filter-materia').addEventListener('change', e => {
    const val = e.target.value;
    $$('#voti-body tr').forEach(r => {
        r.style.display = (val === 'all' || r.dataset.materia === val) ? '' : 'none';
    });
});

$('sort-voti').addEventListener('click', function() {
    State.sortDir = State.sortDir === 'date-desc' ? 'voto-desc' : 'date-desc';
    const sorted = [...State.data.voti].sort((a,b) => {
        if (State.sortDir === 'voto-desc') {
            return (parseVoto(b.voto) || 0) - (parseVoto(a.voto) || 0);
        }
        return 0; // Mantieni ordine originale per 'date-desc' (già in ordine dal backend)
    });
    const tbody = $('voti-body');
    tbody.style.opacity = '0';
    tbody.style.transition = 'opacity .25s';
    setTimeout(() => { renderVotiTable(sorted); tbody.style.opacity = '1'; $('filter-materia').value = 'all'; }, 250);
    this.innerHTML = State.sortDir === 'voto-desc'
        ? '<i class="fa-solid fa-sort-amount-down"></i> Per voto'
        : '<i class="fa-solid fa-sort"></i> Ordina';
});

// Ricerca globale
$('global-search').addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    $('clear-search').hidden = !q;

    // Cerca nella tabella voti(se è visibile)
    $$('#voti-body tr').forEach(r => {
        r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });

    // Cerca nell'agenda
    $$('#agenda-container .ag-card').forEach(c => {
        c.style.display = !q || c.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
});

$('clear-search').addEventListener('click', () => {
    $('global-search').value = '';
    $('global-search').dispatchEvent(new Event('input'));
    $('clear-search').hidden = true;
});
