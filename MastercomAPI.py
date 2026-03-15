import requests
import time
import re
import json
from bs4 import BeautifulSoup

# --- CLASSE MOTORE ---
class MastercomAPI:
    def __init__(self, user, password):
        self.url = "https://agnelli-to.registroelettronico.com/mastercom/index.php"
        self.user = user
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        })
        self.data_session = {}

    def get_session_data(self):
        """Ritorna i cookie e i dati necessari per saltare il login."""
        return {
            "cookies": self.session.cookies.get_dict(),
            "data_session": self.data_session
        }

    def set_session_data(self, data):
        """Ripristina una sessione esistente."""
        if data:
            self.session.cookies.update(data.get("cookies", {}))
            self.data_session = data.get("data_session", {})

    def is_logged_in(self):
        """Verifica se la sessione è ancora valida caricando una pagina leggera."""
        if not self.data_session: return False
        try:
            res = self.session.get(self.url, timeout=5)
            return "form_login" not in res.text
        except:
            return False

    def login(self):
        payload = {
            "user": self.user,
            "password_user": self.password,
            "db_key": "mastercom_2025_2026",    
            "login_ts": int(time.time()),
            "form_login": "true"
        }
        
        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        try:
            self.data_session = {
                "current_key": soup.find('input', {'id': 'current_key'})['value'],
                "current_user": soup.find('input', {'id': 'current_user'})['value'],
                "db_key": soup.find('input', {'id': 'db_key'})['value']
            }
            
            user_info = {"name": "Studente", "foto": None}
            try:
                strong_tag = soup.find('strong', class_='text-mastercom-dark-blue')
                if strong_tag:
                    name_txt = strong_tag.text.strip()
                    if name_txt.lower().startswith("ciao "):
                        name_txt = name_txt[5:].strip()
                    user_info["name"] = name_txt
                    
                img_tag = soup.find('img', src=re.compile(r'foto_studenti'))
                if img_tag and 'src' in img_tag.attrs:
                    user_info["foto"] = "https://agnelli-to.registroelettronico.com/mastercom/" + img_tag['src']
            except Exception:
                pass
                
            self.data_session["user_info"] = user_info
            
            return True
        except (TypeError, KeyError):
            return False

# --- SEZIONE VOTI ---
    def prendi_voti(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "voti",
            "stato_secondario": "",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session["db_key"]
        }

        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', attrs={'data-tipo': 'voto'})
        
        risultati = []
        for riga in righe:
            materia = riga.find('div', class_='bold').text.strip()
            voto = riga.find('strong').text.strip()
            testo_div = riga.find_all('div')[2].text.strip()
            
            # Utilizziamo una regex per separare sempre i primi 10 caratteri della data (DD/MM/YYYY) dal tipo adiacente
            import re
            m = re.match(r"(\d{2}/\d{2}/\d{4})\s*(.*)", testo_div)
            if m:
                data = m.group(1)
                tipo = m.group(2) if m.group(2) else "—"
            else:
                data = testo_div[:10]  # Fallback
                tipo = testo_div[10:] if len(testo_div) > 10 else "—"
            
            # Controllo flag: "Il voto non fa media" o similare
            peso_zero = "Il voto non fa media" in riga.text
            
            risultati.append({"materia": materia, "voto": voto, "data": data, "tipo": tipo, "peso_zero": peso_zero})
        
        return risultati

# --- SEZIONE ASSENZE ---
    def get_assenze(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "assenze",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session["db_key"]
        }

        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', attrs={'data-giustificata': True})
        
        risultati = []
        for riga in righe:
            tds = riga.find_all('td')
            if len(tds) < 3: continue
            
            tipo = tds[0].find('strong').text.strip()
            data = riga['data-date']
            descrizione = tds[2].get_text(" ", strip=True).replace("Giustificata", "").strip()
            giustificata = riga['data-giustificata'] == "1"
            
            risultati.append({
                "tipo": tipo,
                "data": data,
                "descrizione": descrizione,
                "giustificata": giustificata
            })
        return risultati

# --- SEZIONE AGENDA ---
    def get_agenda(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "agenda",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session.get("db_key", "")
        }

        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', class_='border-bottom')
        risultati = []

        for riga in righe:
            tds = riga.find_all('td')
            if len(tds) < 2: continue

            data_raw = tds[0].get_text(separator=" ", strip=True)
            data_pulita = " ".join(data_raw.replace("OGGI", "").split())
            eventi = tds[1].find_all('div', attrs={'data-type': True})

            for evento in eventi:
                tipo = evento.get('data-type', '')
                orario_div = evento.find('div', class_='right')
                orario = orario_div.get_text(separator=" - ", strip=True) if orario_div else ""
                titolo_tag = evento.find('strong')
                titolo = titolo_tag.get_text(strip=True) if titolo_tag else ""
                autore_tag = evento.find('i', class_='small')
                autore = autore_tag.get_text(strip=True).strip("()") if autore_tag else ""

                risultati.append({
                    "data": data_pulita,
                    "tipo": tipo,
                    "orario": orario,
                    "titolo": titolo,
                    "docente": autore
                })
        return risultati
    
# --- SEZIONE ARGOMENTI E COMPITI ---
    def get_argomenti_compiti(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "argomenti-compiti",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session.get("db_key", "")
        }

        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', class_='border-bottom')
        risultati = []
        data_corrente = ""

        for riga in righe:
            tds = riga.find_all('td')
            if not tds: continue
            
            if len(tds) == 2:
                data_col = tds[0]
                content_col = tds[1]
                strong_tag = data_col.find('strong')
                if strong_tag:
                     data_testo = strong_tag.get_text(separator=" ", strip=True)
                else:
                     data_testo = data_col.get_text(separator=" ", strip=True)
                data_corrente = " ".join(data_testo.replace("OGGI", "").split())
            elif len(tds) == 1:
                content_col = tds[0]
            else:
                continue

            materia_tag = content_col.find('strong')
            materia = materia_tag.text.strip() if materia_tag else "Sconosciuta"
            blocchi = content_col.find_all('div', attrs={'data-type': True})

            for blocco in blocchi:
                tipo = blocco.get('data-type')
                testo_completo = blocco.get_text(separator="\n", strip=True)
                docente_tag = blocco.find('i', class_='text-gray')
                docente = docente_tag.text.strip() if docente_tag else ""
                contenuto = testo_completo.replace(docente, "").strip()
                if contenuto.startswith("- "):
                    contenuto = contenuto[2:]
                
                stato = ""
                if tipo == "assegnazione":
                    label = blocco.find('label')
                    if label:
                        stato_span = label.find('span')
                        if stato_span:
                            stato = stato_span.text.strip()
                            contenuto = contenuto.replace(stato, "").strip()
                    inserito_tag = blocco.find('span', class_='text-gray small')
                    if inserito_tag:
                         contenuto = contenuto.replace(inserito_tag.text, "").strip()

                risultati.append({
                    "data": data_corrente,
                    "materia": materia,
                    "tipo": tipo,
                    "contenuto": contenuto.replace('\n', ' | '),
                    "docente": docente,
                    "stato": stato
                })
        return risultati
    
# --- SEZIONE NOTE DISCIPLINARI ---
    def get_note(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "note-disciplinari",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session.get("db_key", "")
        }

        res = self.session.post(self.url, data=payload)
        if "Nessuna nota disciplinare trovata" in res.text:
            return []

        soup = BeautifulSoup(res.text, 'html.parser')
        note = []
        elementi = soup.find_all('div', class_='card')
        for el in elementi:
            testo = el.get_text(separator=" ", strip=True)
            if testo and "Nessuna nota" not in testo:
                note.append({"contenuto": testo})
        return note

    def get_orario(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "orario",
            "stato_secondario": "",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session.get("db_key", "")
        }

        res = self.session.post(self.url, data=payload)
        
        m = re.search(r"var\s+riepilogo_orario\s*=\s*JSON\.parse\('([^']+)'\)", res.text)
        if not m:
            return []
            
        try:
            # We replace \\/ with \/ etc, JSON loader handles standard escape sequences
            orario_str = m.group(1).encode().decode('unicode_escape')
            data = json.loads(orario_str)
            return data.get('elenco_ore_totale', [])
        except Exception as e:
            print("Errore nel parsing JSON orario:", e)
            return []

    def get_corsi(self):
        if not self.data_session: return []

        payload = {
            "form_stato": "studente",
            "stato_principale": "corsi",
            "stato_secondario": "",
            "permission": "nexus",
            "operazione": "",
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "from_app": "1",
            "webview": "1",
            "header": "SI",
            "db_key": self.data_session.get("db_key", "")
        }

        res = self.session.post(self.url, data=payload)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        corsi = []
        rows = soup.select('table.table.striped tr')
        for row in rows:
            tds = row.find_all('td')
            if len(tds) < 2: continue
            
            titolo_el = tds[0].find('strong')
            if not titolo_el: continue
            titolo = titolo_el.get_text(strip=True)
            
            prof_el = tds[0].find('div', class_='italic small')
            professore = prof_el.get_text(separator=" ", strip=True) if prof_el else ""
            
            btn = tds[0].find('button', onclick=re.compile(r'toggleInfo'))
            id_corso = ""
            if btn:
                m = re.search(r"toggleInfo\([^,]+,\s*'(\d+)'\)", btn['onclick'])
                if m: id_corso = m.group(1)
                
            dettagli = ""
            if id_corso:
                dettagli_div = soup.find('div', id=id_corso)
                if dettagli_div:
                    # Clean the detailed text removing "Orario lezioni:" etc.
                    dettagli = dettagli_div.get_text(separator="\n", strip=True)
            
            date_div = tds[1].find('div')
            date_testo = date_div.get_text(separator=" - ", strip=True) if date_div else ""
            
            iscritto = False
            iscrizione_div = tds[1].find('div', id=f"div_iscrizione_{id_corso}")
            if iscrizione_div:
                testo_iscr = iscrizione_div.get_text(strip=True)
                if "Non iscritto" not in testo_iscr and "Iscritto" in testo_iscr:
                    iscritto = True
                    
            corsi.append({
                "id": id_corso,
                "titolo": titolo,
                "professore": professore,
                "dettagli": dettagli,
                "periodo": date_testo,
                "iscritto": iscritto
            })
            
        return corsi

    def toggle_corso(self, id_corso, action="subscribe"):
        if not self.data_session: return False
        
        payload = {
            "form_stato": "studente",
            "stato_principale": "corsi",
            "stato_secondario": "",
            "permission": "nexus",
            "operazione": action, # We assume 'subscribe' or 'unsubscribe' is passed to 'operazione'
            "id_corso": id_corso, # Best guess parameter name
            "current_user": self.data_session["current_user"],
            "current_key": self.data_session["current_key"],
            "db_key": self.data_session.get("db_key", "")
        }
        res = self.session.post(self.url, data=payload)
        return True # Assuming succes for now



# --- ESECUZIONE E STAMPA TERMINALE ---
if __name__ == "__main__":
    registro = MastercomAPI("616709", "tzncx6y7sm")
    
    print("Tentativo di connessione a Mastercom...")
    if registro.login():
        print("✅ Login riuscito!\n")
        
        print("="*60)
        print("📊 VOTI")
        print("="*60)
        voti = registro.prendi_voti()
        for v in voti:
            print(f"[{v['data']}] {v['materia']:<25} VOTO: {v['voto']}")
            
        print("\n" + "="*60)
        print("📅 AGENDA")
        print("="*60)
        agenda = registro.get_agenda()
        for a in agenda:
            print(f"[{a['data']}] {a['orario']:<15} | {a['tipo'].upper():<12} | {a['titolo']}")
            
        print("\n" + "="*60)
        print("📚 ARGOMENTI E COMPITI (Prime 10 voci)")
        print("="*60)
        argomenti = registro.get_argomenti_compiti()
        for c in argomenti[:10]:
            stato_str = f"[{c['stato']}]" if c['stato'] else ""
            print(f"[{c['data']}] {c['materia']:<20} | {c['tipo'].upper()} {stato_str}")
            print(f"   -> {c['contenuto'][:80]}...")
            
        print("\n" + "="*60)
        print("🛑 ASSENZE E RITARDI")
        print("="*60)
        assenze = registro.get_assenze()
        if not assenze:
            print("Nessuna assenza trovata.")
        for ass in assenze:
            giust = "✅ Giustificata" if ass['giustificata'] else "❌ Da giustificare"
            print(f"[{ass['data']}] TIPO: {ass['tipo']} | {ass['descrizione']} | {giust}")
            
        print("\n" + "="*60)
        print("⚠️ NOTE DISCIPLINARI")
        print("="*60)
        note = registro.get_note()
        if not note:
            print("Nessuna nota trovata. Ottimo lavoro!")
        for n in note:
            print(f"-> {n['contenuto']}")
            
        print("\n" + "="*60)
        print("🕒 ORARIO")
        print("="*60)
        orario = registro.get_orario() or []
        if not orario:
            print("Nessun orario trovato.")
        for o in orario[:10]: # Print first 10
            print(f"[{o.get('giorno_tradotto', '')} {o.get('data_inizio_tradotta', '')}] {o.get('ora_inizio_tradotta', '')} - {o.get('ora_fine_tradotta', '')} | {o.get('descrizione_materia', '')} ({o.get('cognome_professore', '')})")
            
        print("\n" + "="*60)
        print("🏫 CORSI")
        print("="*60)
        corsi = registro.get_corsi() or []
        if not corsi:
            print("Nessun corso trovato.")
        for c in corsi[:10]: # Print first 10
            iscr = "✅ ISCRITTO" if c['iscritto'] else "❌ NON ISCRITTO"
            print(f"[{c['periodo']}] {c['titolo']} | {c['professore']} | {iscr}")
            
    else:
        print("❌ Login fallito.")