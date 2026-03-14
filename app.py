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

if __name__ == "__main__":
    app.run(debug=True, port=5000)
