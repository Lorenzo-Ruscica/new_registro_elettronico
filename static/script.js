// Script Logica - Flat / Clean Design

document.addEventListener('DOMContentLoaded', () => {

    const DOM = {
        loginForm: document.getElementById('login-form'),
        loginBtn: document.getElementById('login-btn'),
        errorMsg: document.getElementById('login-error'),
        navItems: document.querySelectorAll('.nav-item[data-target]'),
        views: document.querySelectorAll('.app-view'),
        logoutBtn: document.getElementById('logout-btn'),
        searchGlobal: document.getElementById('global-search'),
        dateDisplay: document.getElementById('current-date'),
        sortVotiBtn: document.getElementById('sort-voti'),
        pageTitle: document.getElementById('page-title')
    };

    let GLOBAL_DATA = null;
    let chartsInstance = {};
    let sortDirection = 'desc';

    // 1. Orologio Minimal
    const updateTime = () => {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'};
        DOM.dateDisplay.textContent = now.toLocaleDateString('it-IT', options).replace(/^./, str => str.toUpperCase());
    };
    updateTime(); setInterval(updateTime, 60000);

    // 2. Mostra/Nascondi Password
    const togglePasswordBtn = document.getElementById('toggle-password');
    if(togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const pwdObj = document.getElementById('password');
            if(pwdObj.type === 'password') {
                pwdObj.type = 'text';
                togglePasswordBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                togglePasswordBtn.style.color = 'var(--primary)';
            } else {
                pwdObj.type = 'password';
                togglePasswordBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
                togglePasswordBtn.style.color = 'var(--text-muted)';
            }
        });
    }

    // 3. Navigazione tra le viste
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            DOM.navItems.forEach(nav => nav.classList.remove('active'));
            
            const target = document.getElementById(`view-${item.dataset.target}`);
            
            DOM.views.forEach(view => {
                if (view !== target) {
                    view.classList.remove('active');
                    setTimeout(() => { 
                        if (!view.classList.contains('active')) view.style.display = 'none'; 
                    }, 300);
                }
            });

            item.classList.add('active');
            DOM.pageTitle.textContent = item.textContent.trim();
            target.style.display = 'block';
            setTimeout(() => {
                target.classList.add('active');
                if(item.dataset.target === 'voti' && !chartsInstance.medie) renderMedieChart(GLOBAL_DATA);
                if(item.dataset.target === 'dashboard' && !chartsInstance.dash) renderDashChart(GLOBAL_DATA);
            }, 50);
        });
    });

    // 4. Logout
    if(DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', () => {
            fetch('/api/logout', { method: 'POST' }).then(() => location.reload());
        });
    }

    // 5. Autenticazione (Login Call)
    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btnText = DOM.loginBtn.querySelector('.btn-text');
        const loader = DOM.loginBtn.querySelector('.spinner');

        DOM.errorMsg.textContent = '';
        btnText.style.display = 'none';
        loader.style.display = 'block';
        DOM.loginBtn.disabled = true;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if(data.success) {
                document.getElementById('user-display').textContent = username;
                switchScreen('loading-screen');
                performSync();
            } else {
                throw new Error(data.message || 'Credenziali errate');
            }
        } catch(err) {
            DOM.errorMsg.textContent = err.message;
            btnText.style.display = 'block';
            loader.style.display = 'none';
            DOM.loginBtn.disabled = false;
        }
    });

    function switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // 6. Sincronizzazione Dati
    async function performSync() {
        const syncStatus = document.getElementById('sync-status');
        try {
            const res = await fetch('/api/data');
            if(!res.ok) throw new Error();
            GLOBAL_DATA = await res.json();
            
            syncStatus.textContent = 'Analisi completata. Generazione UI...';
            populateAll(GLOBAL_DATA);
            
            setTimeout(() => {
                switchScreen('app-screen');
                document.querySelector('.nav-item.active').click(); 
                renderDashChart(GLOBAL_DATA);
            }, 600);

        } catch(e) {
            alert('Errore di comunicazione col server d\'istituto. Riprova.');
            location.reload();
        }
    }

    /* ==== LOGICA UI: POPOLAMENTO DATI ==== */
    
    function getNumericalVoto(str) {
        if(!str) return null;
        let num = parseFloat(str.replace(',', '.'));
        if(str.includes('+')) num += 0.25;
        if(str.endsWith('-')) num -= 0.25;
        if(str.includes('1/2')) num += 0.5;
        return isNaN(num) ? null : num;
    }

    function populateAll(data) {
        // --- 1. DASHBOARD ---
        const navgVoti = data.voti.map(v => getNumericalVoto(v.voto)).filter(n => n !== null);
        const sumVoti = navgVoti.reduce((a, b) => a + b, 0);
        const media = navgVoti.length > 0 ? (sumVoti/navgVoti.length).toFixed(2) : 0;
        
        const mediaEl = document.getElementById('dash-media');
        mediaEl.textContent = media > 0 ? media : '--';
        document.getElementById('media-status').innerHTML = media >= 6 ? '<span class="text-primary font-medium">Andamento Stabile</span>' : '<span style="color:var(--danger)">Carenze rilevate</span>';

        const compiti = data.argomenti.filter(a => a.tipo.toLowerCase().includes('asseg') || a.tipo.toLowerCase().includes('compit'));
        document.getElementById('dash-compiti').textContent = compiti.length;

        const assenzeNo = data.assenze.filter(a => !a.giustificata).length;
        document.getElementById('dash-assenze').textContent = data.assenze.length;
        const msgAssenze = document.getElementById('dash-giustifiche');
        msgAssenze.textContent = assenzeNo > 0 ? `Incombe: ${assenzeNo} da giustificare` : 'Nessuna comunicazione pendente';
        if(assenzeNo > 0) msgAssenze.style.color = 'var(--danger)';

        // Dash Agenda Minimal
        const dAgenda = document.getElementById('dash-agenda');
        dAgenda.innerHTML = '';
        data.agenda.slice(0, 4).forEach((a, index) => {
            const isTask = a.tipo.toLowerCase().includes('compito');
            dAgenda.innerHTML += `
            <li class="${isTask ? 'is-task' : ''}">
                <span class="a-time-s">${a.data} | ${a.orario || 'ND'}</span>
                <span class="a-title-s">${a.titolo.length > 30 ? a.titolo.substring(0,30)+'...' : a.titolo}</span>
                <span style="font-size:0.8rem; color:var(--text-muted)">${a.tipo.toUpperCase()}</span>
            </li>`;
        });
        if(data.agenda.length === 0) dAgenda.innerHTML = '<li style="border-color:var(--text-muted)"><span class="a-title-s" style="font-weight:400; color:var(--text-muted)">Nessun appuntamento imminente.</span></li>';

        // --- 2. VOTI: TABELLA ---
        renderVotiTable(data.voti);
        const filterStr = document.getElementById('filter-materia');
        const materieUniche = [...new Set(data.voti.map(v => v.materia))];
        materieUniche.forEach(mat => filterStr.innerHTML += `<option value="${mat}">${mat}</option>`);

        // --- 3. AGENDA GRID ---
        const agendaC = document.getElementById('agenda-container');
        agendaC.innerHTML = '';
        data.agenda.forEach(a => {
            const badgeCol = a.tipo.toLowerCase().includes('ver') ? 'bg-danger' : 'bg-primary-soft';
            agendaC.innerHTML += `
            <div class="ac-card">
                <div class="ac-header">
                    <span class="ac-date">${a.data}</span>
                    <span class="ac-time">${a.orario || 'Orario Indefinto'}</span>
                </div>
                <span class="badge ${badgeCol}" style="align-self:flex-start;">${a.tipo}</span>
                <span class="ac-titolo">${a.titolo}</span>
                <div class="ac-docente"><i class="fa-solid fa-chalkboard-user" style="margin-right:6px"></i>${a.docente || '-'}</div>
            </div>`;
        });

        // --- 4. KANBAN COMPITI FLAT ---
        const kTodo = document.getElementById('col-todo');
        const kStudio = document.getElementById('col-studio');
        kTodo.innerHTML = ''; kStudio.innerHTML = '';
        
        let todoCount = 0;
        compiti.forEach((c, idx) => {
            kTodo.innerHTML += `
            <div class="k-task" id="task-${idx}" onclick="this.classList.toggle('done'); updateTaskCount();">
                <span class="k-meta">${c.materia} &bull; ${c.stato || 'Giorno ' + c.data}</span>
                <div class="k-titolo">${c.tipo.toUpperCase()}</div>
                <div class="k-desc">${c.contenuto}</div>
            </div>`;
            todoCount++;
        });
        document.getElementById('count-todo').textContent = todoCount;

        data.argomenti.filter(a => !a.tipo.toLowerCase().includes('asseg') && !a.tipo.toLowerCase().includes('compit')).forEach(c => {
            kStudio.innerHTML += `
            <div class="k-task studio">
                <span class="k-meta">${c.materia} &bull; ${c.data}</span>
                <div class="k-titolo">${c.tipo.toUpperCase()}</div>
                <div class="k-desc">${c.contenuto}</div>
            </div>`;
        });

        // --- 5. ASSENZE ---
        const tAssenze = document.getElementById('assenze-body');
        tAssenze.innerHTML = '';
        data.assenze.forEach(a => {
            const check = a.giustificata ? '<span style="color:var(--success);font-weight:600;"><i class="fa-solid fa-check"></i> Giustificata</span>' : '<span style="color:var(--danger);font-weight:600;"><i class="fa-solid fa-xmark"></i> Richiesta Validazione</span>';
            tAssenze.innerHTML += `
            <tr>
                <td style="font-weight:600; color:var(--text-main)">${a.data}</td>
                <td><span class="badge bg-primary-soft">${a.tipo}</span></td>
                <td style="color:var(--text-muted)">${a.descrizione || '-'}</td>
                <td>${check}</td>
            </tr>`;
        });
        if(data.assenze.length === 0) tAssenze.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Nessuna assenza nei registri.</td></tr>';

        // --- 6. NOTE ---
        const nCont = document.getElementById('note-body');
        nCont.innerHTML = '';
        data.note.forEach(n => {
            nCont.innerHTML += `
            <div class="note-item-clean">
                <i class="fa-solid fa-bell"></i>
                <div style="flex:1">
                    <span style="display:block; font-size:0.85rem; font-weight:700; color:var(--danger); text-transform:uppercase; margin-bottom:5px">Segnalazione Disciplinare</span>
                    <p>"${n.contenuto}"</p>
                </div>
            </div>`;
        });
        if(data.note.length === 0) nCont.innerHTML = '<span style="color:var(--success); font-weight:600;"><i class="fa-solid fa-face-smile" style="margin-right:8px;"></i> Nessuna nota disciplinare o annotazione.</span>';
    }


    /* ==== LIBRERIA KANBAN: DRAG & DROP LOGIC ==== */
    window.updateTaskCount = () => {
        const todos = document.querySelectorAll('#col-todo .k-task:not(.done)').length;
        const doneList = document.querySelectorAll('#col-todo .k-task.done');
        document.getElementById('count-todo').textContent = todos;
        document.getElementById('count-done').textContent = doneList.length;
        
        const colDone = document.getElementById('col-done');
        doneList.forEach(t => {
            colDone.appendChild(t); 
            t.onclick = function() { 
                this.classList.remove('done');
                document.getElementById('col-todo').appendChild(this);
                window.updateTaskCount();
            }
        });
    };

    document.getElementById('clear-done').addEventListener('click', () => {
        document.getElementById('col-done').innerHTML = '';
        document.getElementById('count-done').textContent = '0';
    });

    /* ==== RICERCH E FILTRI ==== */
    document.getElementById('filter-materia').addEventListener('change', (e) => {
        const val = e.target.value;
        document.querySelectorAll('#voti-body tr').forEach(r => {
            if(val === 'all' || r.dataset.materia === val) r.style.display = '';
            else r.style.display = 'none';
        });
    });

    DOM.sortVotiBtn.addEventListener('click', () => {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        const sorted = [...GLOBAL_DATA.voti].sort((a,b) => {
            let nA = getNumericalVoto(a.voto) || 0;
            let nB = getNumericalVoto(b.voto) || 0;
            return sortDirection === 'desc' ? nA - nB : nB - nA;
        });
        renderVotiTable(sorted);
        document.getElementById('filter-materia').value = 'all'; // resetta filter
    });

    DOM.searchGlobal.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if(document.getElementById('view-voti').classList.contains('active')) {
            document.querySelectorAll('#voti-body tr').forEach(r => {
                const text = r.textContent.toLowerCase();
                r.style.display = text.includes(query) ? '' : 'none';
            });
        }
    });

    function renderVotiTable(votiArray) {
        const tbody = document.getElementById('voti-body');
        tbody.innerHTML = '';
        votiArray.forEach(v => {
            const num = getNumericalVoto(v.voto);
            let circleClass = 'voto-circle v-orange';
            let labelBadge = '<span class="badge bg-primary-soft">Neutrale</span>';
            
            if(num >= 8) { circleClass = 'voto-circle v-green'; labelBadge = '<span class="badge bg-success">Ottimo</span>'; }
            else if(num < 6 && num !== null) { circleClass = 'voto-circle v-red'; labelBadge = '<span class="badge bg-danger">Da Recuperare</span>'; }

            tbody.innerHTML += `
            <tr data-materia="${v.materia}">
                <td style="color:var(--text-muted); font-size:0.85rem">${v.data}</td>
                <td style="font-weight:600; color:var(--text-main)">${v.materia}</td>
                <td><div class="${circleClass}">${v.voto}</div></td>
                <td>${labelBadge}</td>
            </tr>`;
        });
    }

    /* ==== CHART.JS ACADEMIC STYLES ==== */
    Chart.defaults.color = '#6b7280';
    Chart.defaults.font.family = "'Inter', sans-serif";

    function renderDashChart(data) {
        if(chartsInstance.dash) chartsInstance.dash.destroy();
        const votivalidi = data.voti.map(v => getNumericalVoto(v.voto)).filter(n => n !== null);
        if(votivalidi.length === 0) return;

        const ctx = document.getElementById('dashChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(29, 78, 216, 0.2)'); // primary-light var
        gradient.addColorStop(1, 'rgba(29, 78, 216, 0)');

        chartsInstance.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels: votivalidi.slice(-12).map((_, i) => "Valutazione"),
                datasets: [{
                    label: 'Trend Voti Recenti',
                    data: votivalidi.slice(-12),
                    fill: true, backgroundColor: gradient, borderColor: '#1d4ed8', borderWidth: 2, tension: 0.3,
                    pointBackgroundColor: '#1d4ed8', pointBorderColor: '#fff', pointRadius: 4, pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { min: 2, max: 10, grid: { color: '#e5e7eb', drawBorder: false }},
                    x: { display: false, grid: { display: false } }
                }
            }
        });
    }

    function renderMedieChart(data) {
        if(chartsInstance.medie) chartsInstance.medie.destroy();
        const materieMap = {};
        data.voti.forEach(v => {
            const num = getNumericalVoto(v.voto);
            if(num === null) return;
            if(!materieMap[v.materia]) materieMap[v.materia] = {s:0, c:0};
            materieMap[v.materia].s += num;
            materieMap[v.materia].c++;
        });

        const labels = Object.keys(materieMap).map(m => m.substring(0,18)+ (m.length>18?'..':''));
        const medie = Object.keys(materieMap).map(m => (materieMap[m].s / materieMap[m].c).toFixed(2));
        
        const ctx = document.getElementById('materieChart').getContext('2d');
        chartsInstance.medie = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Media Materia',
                    data: medie,
                    backgroundColor: medie.map(m => m >= 6 ? '#1d4ed8' : '#dc2626'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 10, grid: { color: '#e5e7eb'} },
                    x: { grid: { display: false } }
                }
            }
        });
    }

});
