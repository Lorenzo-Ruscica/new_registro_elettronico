from flask import Flask, request, jsonify, render_template, session
from MastercomAPI import MastercomAPI
import os

app = Flask(__name__)
# Usiamo una chiave statica su Vercel, altrimenti a ogni richiesta serverless
# genera un nuovo os.urandom(24) e annulla la sessione dell'utente!
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "chiave_super_segreta_statica_vercel_123")

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    user = data.get("username")
    password = data.get("password")
    
    api = MastercomAPI(user, password)
    if api.login():
        # Salviamo in sessione le credenziali per le successive richieste
        # (In produzione si userebbero i token o i cookie estratti)
        session['user'] = user
        session['password'] = password
        return jsonify({"success": True, "message": "Login effettuato!"})
    else:
        return jsonify({"success": False, "message": "Credenziali non valide o login fallito."})

@app.route("/api/data", methods=["GET"])
def get_all_data():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
        
    api = MastercomAPI(session['user'], session['password'])
    if not api.login():
        return jsonify({"error": "Sessione scaduta"}), 401
        
    # Parallelizzarli renderebbe tutto più veloce, ma lo facciamo in sequenza
    voti = api.prendi_voti()
    agenda = api.get_agenda()
    argomenti = api.get_argomenti_compiti()
    assenze = api.get_assenze()
    note = api.get_note()
    orario = api.get_orario()
    corsi = api.get_corsi()
    
    return jsonify({
        "utente": api.data_session.get("user_info", {}),
        "voti": voti,
        "agenda": agenda,
        "argomenti": argomenti,
        "assenze": assenze,
        "note": note,
        "orario": orario,
        "corsi": corsi
    })

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
