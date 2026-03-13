// Main Application Logic - Modern UI Pattern
document.addEventListener('DOMContentLoaded', () => {

    const DOM = {
        loginForm: document.getElementById('login-form'),
        loginBtn: document.getElementById('login-btn'),
        errorMsg: document.getElementById('login-error'),
        navItems: document.querySelectorAll('.nav-item[data-target]'),
        views: document.querySelectorAll('.app-view'),
        themeToggle: document.getElementById('theme-toggle'),
        logoutBtn: document.getElementById('logout-btn'),
        searchGlobal: document.getElementById('global-search'),
        dateDisplay: document.getElementById('current-date'),
        sortVotiBtn: document.getElementById('sort-voti')
    };

    let GLOBAL_DATA = null;
    let chartsInstance = {};
    let sortDirection = 'desc'; // Per la tabella voti

    // 1. Orologio Globale
    const updateTime = () => {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        DOM.dateDisplay.textContent = now.toLocaleDateString('it-IT', options);
    };
    updateTime(); setInterval(updateTime, 60000);

    // 2. Navigazione Veloce
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
            target.style.display = 'block';
            setTimeout(() => {
                target.classList.add('active');
                if(item.dataset.target === 'voti' && !chartsInstance.medie) renderMedieChart(GLOBAL_DATA);
                if(item.dataset.target === 'dashboard' && !chartsInstance.dash) renderDashChart(GLOBAL_DATA);
            }, 50);
        });
    });

    // 3. Tema Chiaro / Scuro
    DOM.themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        if(html.getAttribute('data-theme') === 'dark') {
            html.setAttribute('data-theme', 'light');
            DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            html.setAttribute('data-theme', 'dark');
            DOM.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    });

    // 4. Logout
    DOM.logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' }).then(() => location.reload());
    });

    // 5. Autenticazione
    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btnText = DOM.loginBtn.querySelector('.btn-text');
        const loader = DOM.loginBtn.querySelector('.loader-spinner');

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
                throw new Error(data.message || 'Credenziali respinte.');
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

    // 6. Sincronizzazione Dati (Loader finto ma con vero fetch)
    const syncStatus = document.getElementById('sync-status');
    const syncTextArr = ["Connessione in corso...", "Recupero Voti...", "Analisi Valutazioni...", "Sincronizzazione Compiti...", "Costruzione Dashboard..."];
    
    async function performSync() {
        let i = 0;
        const tInt = setInterval(() => { if(i < syncTextArr.length) syncStatus.textContent = syncTextArr[i++]; }, 800);

        try {
            const res = await fetch('/api/data');
            clearInterval(tInt);
            if(!res.ok) throw new Error();
            GLOBAL_DATA = await res.json();
            
            // Popolamento
            populateAll(GLOBAL_DATA);
            
            syncStatus.textContent = "Sincronizzazione Completata!";
            setTimeout(() => {
                switchScreen('app-screen');
                document.querySelector('.nav-item.active').click(); 
                renderDashChart(GLOBAL_DATA);
            }, 600);

        } catch(e) {
            clearInterval(tInt);
            alert("Errore severo di rete durante l'allocazione dal server.");
            location.reload();
        }
    }

    /* ==========================================================
       POPOLAMENTO & LOGICA STRUMENTI E INTERFACCIA
       ========================================================== */

    function getNumericalVoto(str) {
        if(!str) return null;
        let num = parseFloat(str.replace(',', '.'));
        if(str.includes('+')) num += 0.25;
        if(str.endsWith('-')) num -= 0.25;
        if(str.includes('1/2')) num += 0.5;
        return isNaN(num) ? null : num;
    }

    function populateAll(data) {
        // --- 1. DASHBOARD OVERVIEW --- 
        const navgVoti = data.voti.map(v => getNumericalVoto(v.voto)).filter(n => n !== null);
        const sumVoti = navgVoti.reduce((a, b) => a + b, 0);
        const media = navgVoti.length > 0 ? (sumVoti/navgVoti.length).toFixed(2) : 0;
        
        document.getElementById('dash-media').textContent = media > 0 ? media : '--';
        document.getElementById('media-bar').style.width = media > 0 ? (media*10)+'%' : '0%';
        if(media >= 6) document.getElementById('media-bar').classList.add('bg-success');
        else document.getElementById('media-bar').classList.add('bg-danger');

        const compiti = data.argomenti.filter(a => a.tipo.toLowerCase().includes('asseg'));
        document.getElementById('dash-compiti').textContent = compiti.length;

        const assenzeNo = data.assenze.filter(a => !a.giustificata).length;
        document.getElementById('dash-assenze').textContent = data.assenze.length;
        document.getElementById('dash-giustifiche').textContent = assenzeNo > 0 ? `Urgenti: ${assenzeNo} da giustificare` : 'Tutte giustificate';
        if(assenzeNo > 0) document.getElementById('dash-giustifiche').className = 'text-danger font-bold';

        // Dash Agenda Liste (Brevi)
        const dAgenda = document.getElementById('dash-agenda');
        dAgenda.innerHTML = '';
        data.agenda.slice(0, 3).forEach(a => {
            dAgenda.innerHTML += `
            <div class="agenda-item ${a.tipo.toLowerCase().includes('compito') || a.tipo.toLowerCase().includes('ver') ? 'warning' : ''}">
                <span class="a-time">${a.data} - ${a.orario || 'Orario ND'}</span>
                <span class="a-title">${a.titolo}</span>
                <span class="a-sub text-muted">${a.docente}</span>
            </div>`;
        });
        if(data.agenda.length === 0) dAgenda.innerHTML = '<p class="text-muted">Nessun impegno a breve.</p>';

        // --- 2. VOTI: TABELLA ---
        renderVotiTable(data.voti);

        // Popola Dropdown Voti
        const filterStr = document.getElementById('filter-materia');
        const materieUniche = [...new Set(data.voti.map(v => v.materia))];
        materieUniche.forEach(mat => filterStr.innerHTML += `<option value="${mat}">${mat}</option>`);

        // --- 3. AGENDA COMPLETA ---
        const agendaC = document.getElementById('agenda-container');
        agendaC.innerHTML = '';
        data.agenda.forEach(a => {
            agendaC.innerHTML += `
            <div class="cal-card">
                <div class="cal-top">
                    <span>${a.data}</span> <span>${a.orario || '--:--'}</span>
                </div>
                <div class="cal-body">
                    <span class="badge ${a.tipo.toLowerCase().includes('verif')?'bg-danger':'bg-primary'}">${a.tipo}</span>
                    <h4>${a.titolo}</h4>
                    <p class="text-muted" style="margin-top:auto;"><i class="fa-solid fa-user-tie"></i> ${a.docente}</p>
                </div>
            </div>`;
        });

        // --- 4. KANBAN COMPITI ---
        const kTodo = document.getElementById('col-todo');
        const kStudio = document.getElementById('col-studio');
        kTodo.innerHTML = ''; kStudio.innerHTML = '';
        
        let todoCount = 0;
        compiti.forEach((c, idx) => {
            // Task board per assegnazioni
            kTodo.innerHTML += `
            <div class="task-card" id="task-${idx}" onclick="this.classList.toggle('is-done'); updateTaskCount();">
                <span class="tc-date">${c.data} | ${c.stato || 'Assegnato'}</span>
                <h4>${c.materia}</h4>
                <p>${c.contenuto}</p>
                <div class="tc-footer"><i class="fa-solid fa-check"></i> Clicca per completare</div>
            </div>`;
            todoCount++;
        });
        document.getElementById('count-todo').textContent = todoCount;

        // Materiale Studio
        data.argomenti.filter(a => !a.tipo.toLowerCase().includes('asseg')).forEach(c => {
            kStudio.innerHTML += `
            <div class="task-card is-studio">
                <span class="tc-date">${c.data}</span>
                <h4>${c.materia}</h4>
                <p>${c.contenuto}</p>
                <div class="tc-footer">Lezione eseguita in classe</div>
            </div>`;
        });

        // --- 5. ASSENZE ---
        const tAssenze = document.getElementById('assenze-body');
        tAssenze.innerHTML = '';
        data.assenze.forEach(a => {
            tAssenze.innerHTML += `
            <tr>
                <td style="font-weight:700;">${a.data}</td>
                <td><span class="badge bg-primary">${a.tipo}</span></td>
                <td>${a.descrizione || 'Nessuna specifica'}</td>
                <td style="font-weight:600;" class="${a.giustificata?'text-success':'text-danger'}">
                    ${a.giustificata?'<i class="fa-solid fa-circle-check"></i> Giustificata':'<i class="fa-solid fa-triangle-exclamation"></i> Da Giustificare'}
                </td>
            </tr>`;
        });

        // --- 6. NOTE ---
        const nCont = document.getElementById('note-body');
        nCont.innerHTML = '';
        data.note.forEach(n => {
            nCont.innerHTML += `
            <div class="note-box">
                <div class="n-icon"><i class="fa-solid fa-bell"></i></div>
                <div>
                    <h4 class="text-danger mb-15">Avviso Disciplinare</h4>
                    <p>"${n.contenuto}"</p>
                </div>
            </div>`;
        });
        if(data.note.length === 0) nCont.innerHTML = '<p class="text-muted"><i class="fa-solid fa-face-smile"></i> Condotta esemplare, nessuna nota.</p>';
    }

    window.updateTaskCount = () => {
        const todos = document.querySelectorAll('#col-todo .task-card:not(.is-done)').length;
        const doneList = document.querySelectorAll('#col-todo .task-card.is-done');
        document.getElementById('count-todo').textContent = todos;
        document.getElementById('count-done').textContent = doneList.length;
        
        // Sposta visualmente i completati nella colonna "Done"
        const colDone = document.getElementById('col-done');
        doneList.forEach(t => {
            colDone.appendChild(t); // Muove l'elemento nel DOM
            t.onclick = function() { // Se lo riclicca lo rimette in Todo
                this.classList.remove('is-done');
                document.getElementById('col-todo').appendChild(this);
                window.updateTaskCount();
            }
        });
    };

    document.getElementById('clear-done').addEventListener('click', () => {
        document.getElementById('col-done').innerHTML = '';
        document.getElementById('count-done').textContent = '0';
    });

    // Filtri Voti e Ricerca
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
        // Cerca velocemente nella tabella voti
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
            let bClass = 'voto-badge m-orange';
            if(num >= 8) bClass = 'voto-badge m-green';
            if(num < 6) bClass = 'voto-badge m-red';

            tbody.innerHTML += `
            <tr data-materia="${v.materia}">
                <td class="text-muted"><i class="fa-regular fa-calendar" style="margin-right:8px;"></i>${v.data}</td>
                <td>${v.materia}</td>
                <td><span class="${bClass}">${v.voto}</span></td>
                <td><span class="badge ${num >= 6 ? 'bg-success' : 'bg-danger'}">${num >= 6 ? 'Positivo' : 'Insufficienza'}</span></td>
            </tr>`;
        });
    }

    /* ==== CHARTS.JS GENERATION ==== */
    // Costanti per i colori moderni
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

    function renderDashChart(data) {
        if(chartsInstance.dash) chartsInstance.dash.destroy();
        const votivalidi = data.voti.map(v => getNumericalVoto(v.voto)).filter(n => n !== null);
        if(votivalidi.length === 0) return;

        const ctx = document.getElementById('dashChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // primary var
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)');

        chartsInstance.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels: votivalidi.slice(-15).map((_, i) => i+1),
                datasets: [{
                    label: 'Ultime Performance',
                    data: votivalidi.slice(-15),
                    fill: true, backgroundColor: gradient, borderColor: '#6366f1', borderWidth: 3, tension: 0.4,
                    pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { min: 2, max: 10, grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }},
                    x: { display: false }
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

        const labels = Object.keys(materieMap).map(m => m.substring(0,10)+ (m.length>10?'..':''));
        const medie = Object.keys(materieMap).map(m => (materieMap[m].s / materieMap[m].c).toFixed(2));
        
        // Colori barre dinamici base voto
        const bgColors = medie.map(m => m >= 6 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)');

        const ctx = document.getElementById('materieChart').getContext('2d');
        chartsInstance.medie = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Media Materia',
                    data: medie,
                    backgroundColor: bgColors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 10, grid: { borderDash: [5,5], color: 'rgba(255,255,255,0.05)'} },
                    x: { grid: { display: false } }
                }
            }
        });
    }

});
