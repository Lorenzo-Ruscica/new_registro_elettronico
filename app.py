from flask import Flask, request, jsonify, render_template, session
from MastercomAPI import MastercomAPI
import os
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import time

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "chiave_super_segreta_statica_vercel_123")
app.permanent_session_lifetime = timedelta(days=30)

CACHE_DIR = "_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def get_user_cache_path(username):
    h = hashlib.md5(username.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"data_{h}.json")

def save_cache(username, data):
    path = get_user_cache_path(username)
    with open(path, "w") as f:
        json.dump({"timestamp": time.time(), "data": data}, f)

def load_cache(username):
    path = get_user_cache_path(username)
    if os.path.exists(path):
        with open(path, "r") as f:
            cache = json.load(f)
            # Cache valida per 15 minuti
            if time.time() - cache["timestamp"] < 900:
                return cache["data"]
    return None

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')

@app.route("/api/login", methods=["POST"])
def login():
    session.permanent = True
    data = request.json
    user = data.get("username")
    password = data.get("password")
    
    api = MastercomAPI(user, password)
    if api.login():
        session['user'] = user
        session['password'] = password
        session['api_session'] = api.get_session_data()
        return jsonify({"success": True, "message": "Login effettuato!"})
    else:
        return jsonify({"success": False, "message": "Credenziali non valide o login fallito."})

@app.route("/api/data", methods=["GET"])
def get_all_data():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    
    username = session['user']
    password = session['password']
    
    # 1. Prova a caricare dalla cache locale (ultra veloce)
    cached_data = load_cache(username)
    if cached_data:
        return jsonify(cached_data)

    api = MastercomAPI(username, password)
    
    # 2. Prova a riutilizzare la sessione esistente
    api.set_session_data(session.get('api_session'))
    
    # Se la sessione non è valida o non esiste, facciamo il login
    if not api.is_logged_in():
        if not api.login():
            return jsonify({"error": "Sessione scaduta"}), 401
        # Aggiorniamo la sessione Flask con i nuovi cookie
        session['api_session'] = api.get_session_data()

    # 3. Recupero dati in PARALLELO (molto più veloce del sequenziale)
    with ThreadPoolExecutor(max_workers=7) as executor:
        f_voti = executor.submit(api.prendi_voti)
        f_agenda = executor.submit(api.get_agenda)
        f_argomenti = executor.submit(api.get_argomenti_compiti)
        f_assenze = executor.submit(api.get_assenze)
        f_note = executor.submit(api.get_note)
        f_orario = executor.submit(api.get_orario)
        f_corsi = executor.submit(api.get_corsi)

        response_data = {
            "utente": api.data_session.get("user_info", {}),
            "voti": f_voti.result(),
            "agenda": f_agenda.result(),
            "argomenti": f_argomenti.result(),
            "assenze": f_assenze.result(),
            "note": f_note.result(),
            "orario": f_orario.result(),
            "corsi": f_corsi.result()
        }

    # Salviamo in cache per la prossima volta
    save_cache(username, response_data)
    
    return jsonify(response_data)

@app.route("/api/corsi/toggle", methods=["POST"])
def toggle_corso():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
        
    data = request.json
    id_corso = data.get("id_corso")
    action = data.get("action") # 'subscribe' or 'unsubscribe'
    
    api = MastercomAPI(session['user'], session['password'])
    if not api.login():
        return jsonify({"error": "Sessione scaduta"}), 401
        
    success = api.toggle_corso(id_corso, action)
    return jsonify({"success": success})

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyA9xE4OkmA8LSHx7oJyevt1pk-c9-ynCc0")
    
    if not api_key:
        return jsonify({"reply": "⚠️ **Chiave API Mancante** ⚠️\nPer usare l'Assistente AI devi prima configurare la tua chiave *Gemini API*. Apri il file `app.py` e scrivi la tua chiave (puoi ottenerla gratis su [aistudio.google.com](https://aistudio.google.com/app/apikey)) nella variabile d'ambiente `GEMINI_API_KEY`."})
    
    user_msg = data.get("message", "")
    context_data = data.get("context", {})
    
    system_prompt = f"""Sei EduTrack AI, l'assitente virtuale personale di uno studente all'interno di un registro elettronico di ultima generazione.
Devi rispondere alle domande dello studente in modo amichevole, diretto, motivante e molto conciso. Assolutamente NON USARE MAI le emoji nelle tue risposte.
Sei in grado di leggere e analizzare il rendimento, i compiti e l'orario dello studente. Usa la formattazione markdown per evidenziare i concetti chiave.
Non inventare se non trovi un dato.
ECCO I DATI REALI DELLO STUDENTE ORA:
Nome: {context_data.get('nome', 'Studente')}
Voti: {context_data.get('voti', [])}
Appuntamenti e Agenda: {context_data.get('agenda', [])}
Compiti e Argomenti: {context_data.get('argomenti', [])}
Oggi è il: {context_data.get('oggi', '')}"""

    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_msg}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 1000
        }
    }
    
    try:
        r = requests.post(url, json=payload, headers=headers)
        if r.status_code == 200:
            resp_txt = r.json()['candidates'][0]['content']['parts'][0]['text']
            return jsonify({"reply": resp_txt})
        else:
            return jsonify({"reply": f"Si è verificato un errore API: {r.status_code}"})
    except Exception as e:
        return jsonify({"reply": f"Errore di connessione all'Avanguardia AI: {str(e)}"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
