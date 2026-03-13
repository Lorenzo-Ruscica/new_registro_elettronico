// EduTrack — Engine v3 (Apple-Fluid)

document.addEventListener('DOMContentLoaded', () => {

    const DOM = {
        loginForm: document.getElementById('login-form'),
        loginBtn: document.getElementById('login-btn'),
        errorMsg: document.getElementById('login-error'),
        logoutBtn: document.getElementById('logout-btn'),
        searchGlobal: document.getElementById('global-search'),
        dateDisplay: document.getElementById('current-date'),
        sortVotiBtn: document.getElementById('sort-voti'),
        pageTitle: document.getElementById('page-title')
    };

    // Raccogliamo TUTTI i nav items (sidebar + mobile bottom)
    const allNavItems = document.querySelectorAll('.s-link[data-target], .mob-item[data-target]');
    const allViews = document.querySelectorAll('.view');

    let DATA = null;
    let charts = {};
    let sortDir = 'desc';

    // ---------- CLOCK ----------
    const tick = () => {
        const d = new Date();
        const opts = { weekday:'long', day:'numeric', month:'long' };
        DOM.dateDisplay.textContent = d.toLocaleDateString('it-IT', opts).replace(/^./, s => s.toUpperCase());
    };
    tick(); setInterval(tick, 60000);

    // ---------- SHOW/HIDE PASSWORD ----------
    const eyeBtn = document.getElementById('toggle-pw');
    if (eyeBtn) {
        eyeBtn.addEventListener('click', () => {
            const inp = document.getElementById('password');
            const isHidden = inp.type === 'password';
            inp.type = isHidden ? 'text' : 'password';
            eyeBtn.innerHTML = isHidden ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            eyeBtn.style.color = isHidden ? 'var(--blue)' : 'var(--gray-400)';
        });
    }

    // ---------- NAVIGATION (Syncs sidebar + bottom nav) ----------
    allNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetName = item.dataset.target;

            // Micro bounce sull'icona
            const icon = item.querySelector('i');
            if (icon) { icon.style.transform = 'scale(0.75)'; setTimeout(() => icon.style.transform = '', 180); }

            // Deseleziona tutti (sidebar + mobile)
            allNavItems.forEach(n => n.classList.remove('active'));
            // Seleziona tutti quelli con lo stesso target
            allNavItems.forEach(n => { if (n.dataset.target === targetName) n.classList.add('active'); });

            // Titolo
            const displayNames = { dashboard:'Dashboard', voti:'Valutazioni', agenda:'Calendario', compiti:'Compiti', assenze:'Registro Assenze', note:'Note' };
            DOM.pageTitle.textContent = displayNames[targetName] || targetName;

            // Hide views
            const targetView = document.getElementById(`view-${targetName}`);
            allViews.forEach(v => {
                if (v !== targetView) {
                    v.classList.remove('active');
                    setTimeout(() => { if (!v.classList.contains('active')) v.style.display = 'none'; }, 250);
                }
            });

            // Show view + retrigger animations
            targetView.style.display = 'block';
            targetView.querySelectorAll('.reveal').forEach(el => {
                el.style.animation = 'none';
                el.offsetHeight; // force reflow
                el.style.animation = '';
            });
            setTimeout(() => {
                targetView.classList.add('active');
                if (targetName === 'voti' && !charts.medie) renderMedieChart(DATA);
                if (targetName === 'dashboard') {
                    if (!charts.dash) renderDashChart(DATA);
                    if (!charts.radar) renderRadarChart(DATA);
                }
            }, 20);
        });
    });

    // ---------- LOGOUT ----------
    if (DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', () => {
            document.getElementById('app-screen').style.opacity = '0';
            setTimeout(() => fetch('/api/logout', { method:'POST' }).then(() => location.reload()), 350);
        });
    }

    // ---------- LOGIN ----------
    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pwd = document.getElementById('password').value;
        const label = DOM.loginBtn.querySelector('.btn-label');
        const spin = DOM.loginBtn.querySelector('.btn-spin');

        DOM.errorMsg.textContent = '';
        label.style.display = 'none'; spin.style.display = 'block';
        DOM.loginBtn.disabled = true;
        DOM.loginBtn.style.transform = 'scale(0.97)';

        try {
            const res = await fetch('/api/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ username:user, password:pwd }) });
            const json = await res.json();
            if (json.success) {
                document.getElementById('user-display').textContent = user;
                flip('loading-screen');
                sync();
            } else {
                DOM.loginBtn.style.transform = '';
                throw new Error(json.message || 'Credenziali errate');
            }
        } catch(err) {
            DOM.errorMsg.textContent = err.message;
            label.style.display = ''; spin.style.display = 'none';
            DOM.loginBtn.disabled = false;
        }
    });

    function flip(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // ---------- SYNC ----------
    async function sync() {
        const st = document.getElementById('sync-status');
        try {
            const r = await fetch('/api/data');
            if (!r.ok) throw 0;
            DATA = await r.json();
            st.textContent = 'Interfaccia pronta...';
            populateAll(DATA);
            setTimeout(() => {
                flip('app-screen');
                document.querySelector('.s-link.active, .mob-item.active').click();
                renderDashChart(DATA);
                renderRadarChart(DATA);
            }, 700);
        } catch(_) {
            alert('Errore di connessione. Riprova.'); location.reload();
        }
    }

    // ---------- UTILS ----------
    function numVoto(s) {
        if (!s) return null;
        let n = parseFloat(s.replace(',','.'));
        if (s.includes('+')) n += 0.25;
        if (s.endsWith('-')) n -= 0.25;
        if (s.includes('½') || s.includes('1/2')) n += 0.5;
        return isNaN(n) ? null : n;
    }

    // ---------- POPULATE ----------
    function populateAll(d) {
        const nums = d.voti.map(v => numVoto(v.voto)).filter(Boolean);
        const avg = nums.length ? (nums.reduce((a,b) => a+b, 0) / nums.length).toFixed(2) : 0;

        document.getElementById('dash-media').textContent = avg > 0 ? avg : '--';
        document.getElementById('media-status').innerHTML = avg >= 6
            ? '<span style="color:var(--blue)"><i class="fa-solid fa-arrow-trend-up"></i> In regola</span>'
            : '<span style="color:var(--red)"><i class="fa-solid fa-arrow-trend-down"></i> Critico</span>';

        const hw = d.argomenti.filter(a => a.tipo.toLowerCase().includes('asseg') || a.tipo.toLowerCase().includes('compit'));
        document.getElementById('dash-compiti').textContent = hw.length;

        const ung = d.assenze.filter(a => !a.giustificata).length;
        document.getElementById('dash-assenze').textContent = d.assenze.length;
        document.getElementById('dash-giustifiche').innerHTML = ung > 0
            ? `<span style="color:var(--red)"><i class="fa-solid fa-circle-info"></i> ${ung} da giustificare</span>`
            : `<span style="color:var(--green)"><i class="fa-regular fa-circle-check"></i> Tutto in regola</span>`;

        // AGENDA MINI
        const aList = document.getElementById('dash-agenda');
        aList.innerHTML = '';
        d.agenda.slice(0, 5).forEach(a => {
            const isT = a.tipo.toLowerCase().includes('compito') || a.tipo.toLowerCase().includes('ver');
            aList.innerHTML += `<li style="border-left-color:${isT?'var(--orange)':'var(--blue)'}">
                <span class="ev-date">${a.data} — ${a.orario||'ND'}</span>
                <span class="ev-title">${a.titolo.length > 50 ? a.titolo.substring(0,50)+'…' : a.titolo}</span>
            </li>`;
        });
        if (!d.agenda.length) aList.innerHTML = '<li><span class="ev-title" style="color:var(--gray-400)">Nessun impegno registrato.</span></li>';

        // VOTI TABLE
        renderVotiTable(d.voti);
        const sel = document.getElementById('filter-materia');
        [...new Set(d.voti.map(v => v.materia))].forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);

        // AGENDA MASONRY
        const ac = document.getElementById('agenda-container'); ac.innerHTML = '';
        d.agenda.forEach(a => {
            const bcls = a.tipo.toLowerCase().includes('ver') ? 'background:var(--red-light);color:var(--red)' : 'background:var(--blue-light);color:var(--blue)';
            ac.innerHTML += `<div class="m-card"><div class="m-head"><span class="m-date">${a.data}</span><span class="m-time">${a.orario||'--:--'}</span></div><span class="badge" style="${bcls}">${a.tipo}</span><p>${a.titolo}</p><div class="m-doc"><i class="fa-solid fa-chalkboard-user" style="margin-right:6px"></i>${a.docente||'-'}</div></div>`;
        });

        // KANBAN
        const kT = document.getElementById('col-todo'), kS = document.getElementById('col-studio');
        kT.innerHTML = ''; kS.innerHTML = '';
        let tc = 0;
        hw.forEach((c,i) => {
            kT.innerHTML += `<div class="k-card" id="task-${i}" onclick="this.classList.toggle('done');updateTaskCount()"><span class="kc-meta">${c.materia} · ${c.stato||c.data}</span><div class="kc-title">${c.tipo}</div><div class="kc-desc">${c.contenuto}</div></div>`;
            tc++;
        });
        document.getElementById('count-todo').textContent = tc;
        d.argomenti.filter(a => !a.tipo.toLowerCase().includes('asseg') && !a.tipo.toLowerCase().includes('compit')).forEach(c => {
            kS.innerHTML += `<div class="k-card studio"><span class="kc-meta">${c.materia} · ${c.data}</span><div class="kc-title">${c.tipo}</div><div class="kc-desc">${c.contenuto}</div></div>`;
        });

        // ASSENZE
        const ab = document.getElementById('assenze-body'); ab.innerHTML = '';
        d.assenze.forEach(a => {
            const st = a.giustificata
                ? '<span style="color:var(--green);font-weight:600"><i class="fa-solid fa-check-circle"></i> Giustificata</span>'
                : '<span style="color:var(--red);font-weight:600"><i class="fa-solid fa-circle-xmark"></i> Da giustificare</span>';
            ab.innerHTML += `<tr><td style="font-weight:600">${a.data}</td><td><span class="badge" style="background:var(--gray-100);color:var(--gray-600)">${a.tipo}</span></td><td style="color:var(--gray-600)">${a.descrizione||'-'}</td><td>${st}</td></tr>`;
        });
        if (!d.assenze.length) ab.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:30px">Nessuna assenza.</td></tr>';

        // NOTE
        const nb = document.getElementById('note-body'); nb.innerHTML = '';
        d.note.forEach(n => {
            nb.innerHTML += `<div class="note-card"><i class="fa-solid fa-triangle-exclamation"></i><div><small style="display:block;font-weight:700;color:var(--gray-400);text-transform:uppercase;margin-bottom:6px">Nota Disciplinare</small><p>"${n.contenuto}"</p></div></div>`;
        });
        if (!d.note.length) nb.innerHTML = '<div class="note-card ok-note"><i class="fa-regular fa-face-smile"></i><div><p style="font-style:normal;font-weight:500">Nessuna nota disciplinare. Ottimo lavoro!</p></div></div>';
    }

    // ---------- KANBAN LOGIC ----------
    window.updateTaskCount = () => {
        const td = document.querySelectorAll('#col-todo .k-card:not(.done)').length;
        const dn = document.querySelectorAll('#col-todo .k-card.done');
        document.getElementById('count-todo').textContent = td;
        document.getElementById('count-done').textContent = dn.length;
        const colD = document.getElementById('col-done');
        dn.forEach(t => {
            t.style.opacity = '0'; t.style.transform = 'scale(0.95)';
            setTimeout(() => {
                colD.appendChild(t);
                t.style.opacity = ''; t.style.transform = '';
            }, 200);
            t.onclick = function() {
                this.classList.remove('done');
                this.style.opacity = '0';
                setTimeout(() => { document.getElementById('col-todo').appendChild(this); this.style.opacity = ''; window.updateTaskCount(); }, 200);
            };
        });
    };
    document.getElementById('clear-done').addEventListener('click', () => {
        const cd = document.getElementById('col-done');
        cd.style.opacity = '0';
        setTimeout(() => { cd.innerHTML = ''; cd.style.opacity = ''; document.getElementById('count-done').textContent = '0'; }, 200);
    });

    // ---------- FILTERS ----------
    document.getElementById('filter-materia').addEventListener('change', e => {
        const v = e.target.value;
        document.querySelectorAll('#voti-body tr').forEach(r => r.style.display = (v === 'all' || r.dataset.materia === v) ? '' : 'none');
    });

    DOM.sortVotiBtn.addEventListener('click', () => {
        DOM.sortVotiBtn.style.transform = 'scale(0.95)';
        setTimeout(() => DOM.sortVotiBtn.style.transform = '', 180);
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
        const sorted = [...DATA.voti].sort((a,b) => {
            const na = numVoto(a.voto)||0, nb = numVoto(b.voto)||0;
            return sortDir === 'desc' ? na - nb : nb - na;
        });
        const tb = document.getElementById('voti-body');
        tb.style.opacity = '0';
        setTimeout(() => { renderVotiTable(sorted); tb.style.opacity = '1'; document.getElementById('filter-materia').value = 'all'; }, 250);
    });

    if (DOM.searchGlobal) {
        DOM.searchGlobal.addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#voti-body tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none');
        });
    }

    function renderVotiTable(arr) {
        const tb = document.getElementById('voti-body');
        tb.style.transition = 'opacity 0.25s ease';
        tb.innerHTML = '';
        arr.forEach(v => {
            const n = numVoto(v.voto);
            let cc = 'voto-chip vc-o', badge = '<span class="badge" style="background:var(--orange-light);color:var(--orange)">Sufficiente</span>';
            if (n >= 7.5) { cc = 'voto-chip vc-g'; badge = '<span class="badge" style="background:var(--green-light);color:var(--green)">Positivo</span>'; }
            else if (n !== null && n < 6) { cc = 'voto-chip vc-r'; badge = '<span class="badge" style="background:var(--red-light);color:var(--red)">Carente</span>'; }
            tb.innerHTML += `<tr data-materia="${v.materia}"><td style="color:var(--gray-400)">${v.data}</td><td style="font-weight:600">${v.materia}</td><td><div class="${cc}">${v.voto}</div></td><td>${badge}</td></tr>`;
        });
    }

    // ---------- CHARTS ----------
    Chart.defaults.color = '#86868b';
    Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

    function renderDashChart(d) {
        if (charts.dash) charts.dash.destroy();
        const vals = d.voti.map(v => numVoto(v.voto)).filter(Boolean);
        if (!vals.length) return;
        const ctx = document.getElementById('dashChart').getContext('2d');
        const gr = ctx.createLinearGradient(0,0,0,280);
        gr.addColorStop(0,'rgba(0,113,227,0.2)'); gr.addColorStop(1,'rgba(0,113,227,0)');
        charts.dash = new Chart(ctx, {
            type:'line',
            data:{
                labels: vals.slice(-15).map((_,i)=>`#${i+1}`),
                datasets:[{
                    data:vals.slice(-15), fill:true, backgroundColor:gr, borderColor:'#0071e3',
                    borderWidth:3, tension:0.45, pointBackgroundColor:'#fff', pointBorderColor:'#0071e3',
                    pointRadius:4, pointHoverRadius:7, pointBorderWidth:2
                }]
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(0,0,0,0.85)', padding:12, cornerRadius:8, titleFont:{weight:'700'} } },
                scales:{ y:{min:2,max:10, grid:{color:'rgba(0,0,0,0.04)', drawBorder:false}}, x:{grid:{display:false}} },
                animation:{ duration:1500, easing:'easeOutQuart' }
            }
        });
    }

    function renderMedieChart(d) {
        if (charts.medie) charts.medie.destroy();
        const map = {};
        d.voti.forEach(v => { const n = numVoto(v.voto); if (!n) return; if (!map[v.materia]) map[v.materia]={s:0,c:0}; map[v.materia].s+=n; map[v.materia].c++; });
        const labels = Object.keys(map).map(m => m.length>14 ? m.substring(0,14)+'…' : m);
        const avgs = Object.keys(map).map(m => (map[m].s/map[m].c).toFixed(2));
        const ctx = document.getElementById('materieChart').getContext('2d');
        charts.medie = new Chart(ctx, {
            type:'bar',
            data:{
                labels,
                datasets:[{ data:avgs, backgroundColor:avgs.map(a => a>=6?'#0071e3':'#ff3b30'), borderRadius:6, barPercentage:0.55 }]
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(0,0,0,0.85)', padding:12, cornerRadius:8 } },
                scales:{ y:{min:0,max:10, grid:{color:'rgba(0,0,0,0.04)'}}, x:{grid:{display:false}} },
                animation:{ duration:1200, easing:'easeInOutQuart' }
            }
        });
    }

    function renderRadarChart(d) {
        if (charts.radar) charts.radar.destroy();
        const map = {};
        d.voti.forEach(v => { const n = numVoto(v.voto); if (!n) return; if (!map[v.materia]) map[v.materia]={s:0,c:0}; map[v.materia].s+=n; map[v.materia].c++; });
        const labels = Object.keys(map).map(m => m.length > 10 ? m.substring(0,10)+'…' : m);
        const avgs = Object.keys(map).map(m => +(map[m].s/map[m].c).toFixed(2));
        if (!labels.length) return;
        const ctx = document.getElementById('radarChart').getContext('2d');
        charts.radar = new Chart(ctx, {
            type:'radar',
            data:{
                labels,
                datasets:[{
                    data:avgs, fill:true,
                    backgroundColor:'rgba(0,113,227,0.12)', borderColor:'#0071e3', borderWidth:2.5,
                    pointBackgroundColor:'#0071e3', pointRadius:4, pointHoverRadius:6
                }]
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false} },
                scales:{ r:{ min:0, max:10, ticks:{ stepSize:2, backdropColor:'transparent' }, grid:{ color:'rgba(0,0,0,0.06)' }, pointLabels:{ font:{size:11, weight:'600'} } } },
                animation:{ duration:1200 }
            }
        });
    }

});
