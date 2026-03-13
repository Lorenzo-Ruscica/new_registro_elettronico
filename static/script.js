// EduTrack Apple-Style Engine

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

    // 1. Orologio Clean
    const updateTime = () => {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long'};
        DOM.dateDisplay.textContent = now.toLocaleDateString('it-IT', options).replace(/^./, str => str.toUpperCase());
    };
    updateTime(); setInterval(updateTime, 60000);

    // 2. Mostra/Nascondi Password fluido
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

    // 3. Navigazione tra le viste (Animazione in Entrata)
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Effetto click icona (rimbalzo)
            const icon = item.querySelector('i');
            icon.style.transform = 'scale(0.8)';
            setTimeout(() => icon.style.transform = 'scale(1)', 150);

            // Nav handling
            DOM.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const targetId = `view-${item.dataset.target}`;
            const targetView = document.getElementById(targetId);
            
            DOM.pageTitle.textContent = item.innerHTML.replace('<i class="fa-solid fa-shapes"></i>', '').replace(/<[^>]*>?/gm, '').trim();

            DOM.views.forEach(view => {
                if (view.id !== targetId) {
                    view.classList.remove('active');
                    setTimeout(() => { if (!view.classList.contains('active')) view.style.display = 'none'; }, 200);
                }
            });

            // Applica staggers da capo ricaricando l'animazione
            targetView.style.display = 'block';
            targetView.querySelectorAll('[class*="stagger-"]').forEach(el => {
                el.style.animation = 'none';
                el.offsetHeight; /* trigger reflow */
                el.style.animation = null; 
            });

            setTimeout(() => {
                targetView.classList.add('active');
                if(item.dataset.target === 'voti' && !chartsInstance.medie) renderMedieChart(GLOBAL_DATA);
                if(item.dataset.target === 'dashboard' && !chartsInstance.dash) renderDashChart(GLOBAL_DATA);
            }, 10);
        });
    });

    // 4. Logout (Animazione dissolvenza)
    if(DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', () => {
            document.getElementById('app-screen').style.opacity = '0';
            setTimeout(() => {
                fetch('/api/logout', { method: 'POST' }).then(() => location.reload());
            }, 300);
        });
    }

    // 5. Autenticazione 
    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btnText = DOM.loginBtn.querySelector('.btn-text');
        const loader = DOM.loginBtn.querySelector('.spinner');

        DOM.errorMsg.style.opacity = '0';
        DOM.errorMsg.textContent = '';
        btnText.style.display = 'none';
        loader.style.display = 'block';
        DOM.loginBtn.disabled = true;
        DOM.loginBtn.style.transform = 'scale(0.97)';

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
                DOM.loginBtn.style.transform = 'scale(1)';
                throw new Error(data.message || 'Credenziali errate');
            }
        } catch(err) {
            DOM.errorMsg.textContent = err.message;
            DOM.errorMsg.style.opacity = '1';
            btnText.style.display = 'block';
            loader.style.display = 'none';
            DOM.loginBtn.disabled = false;
        }
    });

    function switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        screen.classList.add('active');
    }

    // 6. Sincronizzazione Dati
    async function performSync() {
        const syncStatus = document.getElementById('sync-status');
        try {
            const res = await fetch('/api/data');
            if(!res.ok) throw new Error();
            GLOBAL_DATA = await res.json();
            
            syncStatus.textContent = 'Ottimizzazione interfaccia...';
            populateAll(GLOBAL_DATA);
            
            setTimeout(() => {
                switchScreen('app-screen');
                document.querySelector('.nav-item.active').click(); 
                renderDashChart(GLOBAL_DATA);
            }, 800);

        } catch(e) {
            alert('Connessione al server d\'istituto interrotta. Riprova.');
            location.reload();
        }
    }

    /* ==== POPOPLAMENTO DATI ==== */
    
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
        document.getElementById('media-status').innerHTML = media >= 6 ? '<span class="text-primary"><i class="fa-solid fa-arrow-trend-up"></i> Regolare</span>' : '<span style="color:var(--danger)"><i class="fa-solid fa-arrow-trend-down"></i> Critico</span>';

        const compiti = data.argomenti.filter(a => a.tipo.toLowerCase().includes('asseg') || a.tipo.toLowerCase().includes('compit'));
        document.getElementById('dash-compiti').textContent = compiti.length;

        const assenzeNo = data.assenze.filter(a => !a.giustificata).length;
        document.getElementById('dash-assenze').textContent = data.assenze.length;
        const msgAssenze = document.getElementById('dash-giustifiche');
        msgAssenze.innerHTML = assenzeNo > 0 ? `<span style="color:var(--danger)"><i class="fa-solid fa-circle-info"></i> ${assenzeNo} da Giustif.</span>` : '<span style="color:var(--success)"><i class="fa-regular fa-circle-check"></i> Nulla da segnalare</span>';

        // Dash Agenda Minimal List
        const dAgenda = document.getElementById('dash-agenda');
        dAgenda.innerHTML = '';
        data.agenda.slice(0, 4).forEach((a, index) => {
            const isTask = a.tipo.toLowerCase().includes('compito');
            dAgenda.innerHTML += `
            <li class="${isTask ? 'is-task' : ''}" style="border-left-color:${isTask?'var(--warning)':'var(--primary)'}">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">${a.data}</span>
                    <span style="font-size:0.75rem; padding: 2px 8px; border-radius: 12px; background:${isTask?'#fff7ed':'#e8f2ff'}; color:${isTask?'var(--warning)':'var(--primary)'}">${a.tipo.toUpperCase()}</span>
                </div>
                <span style="font-size: 1.05rem; font-weight: 600;">${a.titolo.length > 40 ? a.titolo.substring(0,40)+'...' : a.titolo}</span>
            </li>`;
        });
        if(data.agenda.length === 0) dAgenda.innerHTML = '<li><span style="font-weight:400; color:var(--text-muted)">Nessun appuntamento in agenda.</span></li>';

        // --- 2. VOTI: TABELLA ---
        renderVotiTable(data.voti);
        const filterStr = document.getElementById('filter-materia');
        const materieUniche = [...new Set(data.voti.map(v => v.materia))];
        materieUniche.forEach(mat => filterStr.innerHTML += `<option value="${mat}">${mat}</option>`);

        // --- 3. AGENDA MASONRY ---
        const agendaC = document.getElementById('agenda-container');
        agendaC.innerHTML = '';
        data.agenda.forEach(a => {
            let badgeClass = 'badge-primary';
            if(a.tipo.toLowerCase().includes('ver')) badgeClass = 'badge-danger';
            
            agendaC.innerHTML += `
            <div class="ag-card">
                <div class="ag-header">
                    <span class="ag-date">${a.data}</span>
                    <span class="ag-time">${a.orario || '--:--'}</span>
                </div>
                <span class="badge ${badgeClass}" style="margin-bottom:12px">${a.tipo}</span>
                <p>${a.titolo}</p>
                <div class="ag-doc"><i class="fa-solid fa-chalkboard-user" style="margin-right:6px"></i>${a.docente || '-'}</div>
            </div>`;
        });

        // --- 4. KANBAN COMPITI ANIMATO ---
        const kTodo = document.getElementById('col-todo');
        const kStudio = document.getElementById('col-studio');
        kTodo.innerHTML = ''; kStudio.innerHTML = '';
        
        let todoCount = 0;
        compiti.forEach((c, idx) => {
            kTodo.innerHTML += `
            <div class="task-apple" id="task-${idx}" onclick="this.classList.toggle('done'); updateTaskCount();">
                <span class="t-meta">${c.materia} &bull; ${c.stato || 'Giorno ' + c.data}</span>
                <div class="t-titolo">${c.tipo}</div>
                <div class="t-desc">${c.contenuto}</div>
            </div>`;
            todoCount++;
        });
        document.getElementById('count-todo').textContent = todoCount;

        data.argomenti.filter(a => !a.tipo.toLowerCase().includes('asseg') && !a.tipo.toLowerCase().includes('compit')).forEach(c => {
            kStudio.innerHTML += `
            <div class="task-apple studio">
                <span class="t-meta">${c.materia} &bull; ${c.data}</span>
                <div class="t-titolo">${c.tipo}</div>
                <div class="t-desc">${c.contenuto}</div>
            </div>`;
        });

        // --- 5. ASSENZE ---
        const tAssenze = document.getElementById('assenze-body');
        tAssenze.innerHTML = '';
        data.assenze.forEach(a => {
            const check = a.giustificata ? '<span style="color:var(--success);font-weight:600;"><i class="fa-solid fa-check-circle"></i> Regolare</span>' : '<span style="color:var(--danger);font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Richiede valid.</span>';
            tAssenze.innerHTML += `
            <tr>
                <td style="font-weight:600; color:var(--text-dark)">${a.data}</td>
                <td><span class="badge badge-dark">${a.tipo}</span></td>
                <td style="color:var(--text-muted)">${a.descrizione || 'ND'}</td>
                <td>${check}</td>
            </tr>`;
        });
        if(data.assenze.length === 0) tAssenze.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px">Nessuna assenza registrata.</td></tr>';

        // --- 6. NOTE ---
        const nCont = document.getElementById('note-body');
        nCont.innerHTML = '';
        data.note.forEach(n => {
            nCont.innerHTML += `
            <div class="note-apple">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div style="flex:1">
                    <span style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px">Annotazione O Note</span>
                    <p>"${n.contenuto}"</p>
                </div>
            </div>`;
        });
        if(data.note.length === 0) nCont.innerHTML = '<div class="note-apple" style="border-left-color:var(--success);"><i class="fa-solid fa-face-smile" style="color:var(--success)"></i><p style="font-style:normal; margin-top:6px; font-weight:500;">Sanzioni o note disciplinari assenti nel sistema.</p></div>';
    }


    /* ==== LIBRERIA KANBAN: DRAG & DROP LOGIC ==== */
    window.updateTaskCount = () => {
        const todos = document.querySelectorAll('#col-todo .task-apple:not(.done)').length;
        const doneList = document.querySelectorAll('#col-todo .task-apple.done');
        document.getElementById('count-todo').textContent = todos;
        document.getElementById('count-done').textContent = doneList.length;
        
        const colDone = document.getElementById('col-done');
        doneList.forEach(t => {
            t.style.opacity = '0';
            setTimeout(() => {
                colDone.appendChild(t); 
                t.style.opacity = '1';
            }, 150);
            
            t.onclick = function() { 
                this.classList.remove('done');
                this.style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('col-todo').appendChild(this);
                    this.style.opacity = '1';
                    window.updateTaskCount();
                }, 150);
            }
        });
    };

    document.getElementById('clear-done').addEventListener('click', () => {
        document.getElementById('col-done').innerHTML = '';
        document.getElementById('count-done').textContent = '0';
    });

    /* ==== RICERCH E FILTRI FLUIDI ==== */
    document.getElementById('filter-materia').addEventListener('change', (e) => {
        const val = e.target.value;
        document.querySelectorAll('#voti-body tr').forEach(r => {
            if(val === 'all' || r.dataset.materia === val) r.style.display = '';
            else r.style.display = 'none';
        });
    });

    DOM.sortVotiBtn.addEventListener('click', () => {
        // Effetto bounce bottone
        DOM.sortVotiBtn.style.transform = 'scale(0.95)';
        setTimeout(() => DOM.sortVotiBtn.style.transform = 'scale(1)', 150);

        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        const sorted = [...GLOBAL_DATA.voti].sort((a,b) => {
            let nA = getNumericalVoto(a.voto) || 0;
            let nB = getNumericalVoto(b.voto) || 0;
            return sortDirection === 'desc' ? nA - nB : nB - nA;
        });
        
        // Animazione fade della tabella prima di ordinarla
        const tbody = document.getElementById('voti-body');
        tbody.style.opacity = '0';
        setTimeout(() => {
            renderVotiTable(sorted);
            tbody.style.opacity = '1';
            document.getElementById('filter-materia').value = 'all';
        }, 300);
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
        tbody.style.transition = 'opacity 0.3s ease';
        tbody.innerHTML = '';
        votiArray.forEach(v => {
            const num = getNumericalVoto(v.voto);
            let circleClass = 'voti-circle vc-orange';
            let labelBadge = '<span class="badge badge-dark">Sufficiente</span>';
            
            if(num >= 7.5) { circleClass = 'voti-circle vc-green'; labelBadge = '<span class="badge badge-success">Positiva</span>'; }
            else if(num < 6 && num !== null) { circleClass = 'voti-circle vc-red'; labelBadge = '<span class="badge badge-danger">Carente</span>'; }

            tbody.innerHTML += `
            <tr data-materia="${v.materia}">
                <td style="color:var(--text-muted); font-size:0.85rem">${v.data}</td>
                <td style="font-weight:600; color:var(--text-dark)">${v.materia}</td>
                <td><div class="${circleClass}">${v.voto}</div></td>
                <td>${labelBadge}</td>
            </tr>`;
        });
    }

    /* ==== CHART.JS MODERNO/APPLE STYLES ==== */
    Chart.defaults.color = '#86868b';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';

    function renderDashChart(data) {
        if(chartsInstance.dash) chartsInstance.dash.destroy();
        const votivalidi = data.voti.map(v => getNumericalVoto(v.voto)).filter(n => n !== null);
        if(votivalidi.length === 0) return;

        const ctx = document.getElementById('dashChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(0, 113, 227, 0.25)'); 
        gradient.addColorStop(1, 'rgba(0, 113, 227, 0)');

        chartsInstance.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels: votivalidi.slice(-12).map((_, i) => "Valutazione"),
                datasets: [{
                    label: 'Trend Voti Recenti',
                    data: votivalidi.slice(-12),
                    fill: true, backgroundColor: gradient, borderColor: '#0071e3', borderWidth: 3, tension: 0.4, /* Linea curva sfumata! */
                    pointBackgroundColor: '#fff', pointBorderColor: '#0071e3', pointRadius: 5, pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 } },
                scales: { 
                    y: { min: 2, max: 10, grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false }},
                    x: { display: false, grid: { display: false } }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
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

        const labels = Object.keys(materieMap).map(m => m.substring(0,15)+ (m.length>15?'..':''));
        const medie = Object.keys(materieMap).map(m => (materieMap[m].s / materieMap[m].c).toFixed(2));
        
        const ctx = document.getElementById('materieChart').getContext('2d');
        chartsInstance.medie = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Media Estrapolata',
                    data: medie,
                    backgroundColor: medie.map(m => m >= 6 ? '#0071e3' : '#ff3b30'),
                    borderRadius: 6,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 } },
                scales: {
                    y: { min: 0, max: 10, grid: { color: 'rgba(0,0,0,0.04)'} },
                    x: { grid: { display: false } }
                },
                animation: { duration: 1200, easing: 'easeInOutQuart' }
            }
        });
    }

});
