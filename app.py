import os
import json
import sqlite3
from datetime import datetime, date
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

DB_PATH = 'transit.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        full_name TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        stops_json TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assign_date TEXT,
        route_id INTEGER,
        bus_id TEXT,
        driver_id INTEGER,
        conductor_id INTEGER,
        UNIQUE(assign_date, bus_id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER,
        passenger_name TEXT,
        pick_stop_index INTEGER,
        drop_stop_index INTEGER,
        fare REAL,
        seat_number INTEGER,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS journey_stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER,
        stop_index INTEGER,
        visited BOOLEAN DEFAULT 0,
        UNIQUE(assignment_id, stop_index)
    )''')
    
    c.execute("SELECT COUNT(*) as count FROM users")
    if c.fetchone()['count'] == 0:
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES ('admin', '123', 'Admin', 'Chief Admin')")
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES ('c1', '123', 'Conductor', 'Ramesh Kumar')")
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES ('c2', '123', 'Conductor', 'Amit Singh')")
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES ('d1', '123', 'Driver', 'Suresh Patel')")
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES ('d2', '123', 'Driver', 'Vijay Dev')")
        
        default_stops_1 = [
            {"name": "Station A"}, {"name": "Market Road"}, {"name": "City Park"},
            {"name": "Central Mall"}, {"name": "River Side"}, {"name": "Old Town"},
            {"name": "University"}, {"name": "Stadium"}, {"name": "Bus Depot"}
        ]
        default_stops_2 = [
            {"name": "Station B"}, {"name": "Garden View"}, 
            {"name": "Library"}, {"name": "Post Office"}
        ]
        c.execute("INSERT INTO routes (name, stops_json) VALUES (?, ?)", ("Route Alpha", json.dumps(default_stops_1)))
        c.execute("INSERT INTO routes (name, stops_json) VALUES (?, ?)", ("Route Beta", json.dumps(default_stops_2)))
        
        today = date.today().isoformat()
        c.execute("INSERT INTO assignments (assign_date, route_id, bus_id, driver_id, conductor_id) VALUES (?, ?, ?, ?, ?)",
                 (today, 1, "BUS-01", 4, 2))
        assign_id = c.lastrowid
        for i in range(len(default_stops_1)):
            c.execute("INSERT INTO journey_stops (assignment_id, stop_index, visited) VALUES (?, ?, 0)",
                     (assign_id, i))
    conn.commit()
    conn.close()

init_db()

# ================= STATIC & AUTH ================= 
@app.route('/')
def index(): return send_from_directory('.', 'index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ?", (data.get('username'), data.get('password')))
    user = c.fetchone()
    conn.close()
    if user: return jsonify({"success": True, "user": dict(user)})
    else: return jsonify({"success": False, "error": "Invalid username or password"}), 401

@app.route('/<path:path>')
def static_files(path):
    if os.path.exists(path): return send_from_directory('.', path)
    return "", 404

# ================= ADMIN API =================
@app.route('/api/admin/data', methods=['GET'])
def get_admin_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as cnt FROM users WHERE role != 'Admin'")
    staff_count = c.fetchone()['cnt']
    c.execute("SELECT SUM(fare) as total_rev FROM tickets")
    total_rev = c.fetchone()['total_rev'] or 0
    c.execute("SELECT COUNT(*) as total_tkts FROM tickets")
    total_tkts = c.fetchone()['total_tkts'] or 0
    c.execute("SELECT id, name FROM routes")
    routes = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({"total_revenue": total_rev, "total_tickets": total_tkts, "total_staff": staff_count, "routes": routes})

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, full_name, role FROM users WHERE role != 'Admin'")
    users = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({"drivers": [u for u in users if u['role'] == 'Driver'], "conductors": [u for u in users if u['role'] == 'Conductor']})

@app.route('/api/admin/active_staff', methods=['GET'])
def active_staff():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT a.bus_id, r.name as route_name, d.full_name as driver, c.full_name as conductor
        FROM assignments a
        JOIN routes r ON a.route_id = r.id
        LEFT JOIN users d ON a.driver_id = d.id
        LEFT JOIN users c ON a.conductor_id = c.id
        WHERE a.assign_date = ?
    """, (date.today().isoformat(),))
    ops = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({"active_operations": ops})

@app.route('/api/admin/all_staff', methods=['GET'])
def all_staff():
    conn = get_db()
    c = conn.cursor()
    # Get all users (except Admin), and join with today's assignments if any
    today = date.today().isoformat()
    query = """
        SELECT u.id, u.username, u.full_name, u.role, 
               IFNULL(ad.bus_id, ac.bus_id) as bus_id
        FROM users u
        LEFT JOIN assignments ad ON u.id = ad.driver_id AND ad.assign_date = ?
        LEFT JOIN assignments ac ON u.id = ac.conductor_id AND ac.assign_date = ?
        WHERE u.role != 'Admin'
        ORDER BY u.role, u.full_name
    """
    c.execute(query, (today, today))
    staff_list = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({"staff": staff_list})

@app.route('/api/admin/staff', methods=['POST'])
def add_staff():
    data = request.json
    fname = data.get('full_name')
    uname = data.get('username')
    pwd = data.get('password')
    role = data.get('role')
    
    if not all([fname, uname, pwd, role]):
        return jsonify({"error": "Missing fields"}), 400
        
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
                 (uname, pwd, role, fname))
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/route', methods=['POST'])
def add_route():
    data = request.json
    name = data.get('name')
    stops = data.get('stops')
    
    if not name or not stops or len(stops) < 2:
        return jsonify({"error": "Route needs a name and at least 2 stops"}), 400
        
    conn = get_db()
    c = conn.cursor()
    try:
        stops_json = json.dumps([{"name": s} for s in stops])
        c.execute("INSERT INTO routes (name, stops_json) VALUES (?, ?)", (name, stops_json))
        conn.commit()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/assign', methods=['POST'])
def assign_bus():
    data = request.json
    assign_date = data.get('date')
    route_id, bus_id = data.get('route_id'), data.get('bus_id')
    driver_id, conductor_id = data.get('driver_id'), data.get('conductor_id')
    if not all([assign_date, route_id, bus_id, driver_id, conductor_id]):
        return jsonify({"error": "Missing fields"}), 400
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("SELECT stops_json FROM routes WHERE id = ?", (route_id,))
        route = c.fetchone()
        if not route: return jsonify({"error": "Route not found"}), 404
        stops = json.loads(route['stops_json'])
        c.execute("""
            INSERT OR REPLACE INTO assignments (assign_date, route_id, bus_id, driver_id, conductor_id) 
            VALUES (?, ?, ?, ?, ?)
        """, (assign_date, route_id, bus_id, driver_id, conductor_id))
        
        c.execute("SELECT id FROM assignments WHERE assign_date = ? AND bus_id = ?", (assign_date, bus_id))
        assign_id = c.fetchone()['id']
        c.execute("DELETE FROM journey_stops WHERE assignment_id = ?", (assign_id,))
        for i in range(len(stops)):
            c.execute("INSERT INTO journey_stops (assignment_id, stop_index, visited) VALUES (?, ?, 0)", (assign_id, i))
        conn.commit()
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

@app.route('/api/admin/analytics', methods=['GET'])
def get_analytics():
    target_date = request.args.get('date') or date.today().isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT r.name as route_name, r.id as route_id, 
               IFNULL(SUM(t.fare), 0) as revenue,
               COUNT(t.id) as ticket_count
        FROM routes r
        LEFT JOIN assignments a ON r.id = a.route_id AND a.assign_date = ?
        LEFT JOIN tickets t ON a.id = t.assignment_id
        GROUP BY r.id
    """, (target_date,))
    results = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({"date": target_date, "analytics": results})

# ================= BUS SYNC API =================
def get_assignment_for_user(user_id, role, today_str):
    conn = get_db()
    c = conn.cursor()
    col = "driver_id" if role == "Driver" else "conductor_id"
    c.execute(f"""
        SELECT a.id as assign_id, a.bus_id, r.name as route_name, r.stops_json 
        FROM assignments a JOIN routes r ON a.route_id = r.id
        WHERE a.{col} = ? AND a.assign_date = ?
    """, (user_id, today_str))
    assignment = c.fetchone()
    conn.close()
    return assignment

@app.route('/api/sync', methods=['GET'])
def sync_state():
    user_id = request.args.get('user_id')
    role = request.args.get('role')
    assignment = get_assignment_for_user(user_id, role, date.today().isoformat())
    if not assignment: return jsonify({"error": "No assignment found", "stops": [], "bus_id": "Off Duty"})
        
    assign_id = assignment['assign_id']
    base_stops = json.loads(assignment['stops_json'])
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT stop_index, visited FROM journey_stops WHERE assignment_id = ? ORDER BY stop_index", (assign_id,))
    state_rows = c.fetchall()
    c.execute("SELECT SUM(fare) as revenue FROM tickets WHERE assignment_id = ?", (assign_id,))
    rev = (c.fetchone()['revenue'] or 0)
    
    c.execute("SELECT id, passenger_name, pick_stop_index, drop_stop_index, fare, seat_number FROM tickets WHERE assignment_id = ? AND status = 'ACTIVE'", (assign_id,))
    active_passengers = [dict(r) for r in c.fetchall()]
    conn.close()
    
    stops_state = []
    for i, base in enumerate(base_stops):
        row = state_rows[i] if i < len(state_rows) else None
        alighters = sum(1 for p in active_passengers if p['drop_stop_index'] == i)
        stops_state.append({
            "index": i, "name": base['name'], "visited": bool(row['visited']) if row else False, "alighting": alighters
        })
        
    return jsonify({
        "bus_id": assignment['bus_id'], "route_name": assignment['route_name'], "revenue": rev,
        "stops": stops_state, "active_passengers": active_passengers
    })

# ================= ACTIONS API =================
@app.route('/api/action/ticket', methods=['POST'])
def issue_ticket():
    data = request.json
    assignment = get_assignment_for_user(data.get('user_id'), "Conductor", date.today().isoformat())
    if not assignment: return jsonify({"error": "No assignment found"}), 404
        
    assign_id = assignment['assign_id']
    pick_idx = int(data.get('pick_stop_index'))
    drop_idx = int(data.get('drop_stop_index'))
    fare = float(data.get('fare', 0))
    pname = data.get('passenger_name')
    
    if drop_idx <= pick_idx: return jsonify({"error": "Drop location must be after pick location"}), 400
        
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("SELECT visited FROM journey_stops WHERE assignment_id = ? AND stop_index = ?", (assign_id, pick_idx))
        stop_data = c.fetchone()
        if stop_data and stop_data['visited']: return jsonify({"error": "Bus has already passed pick up point"}), 400
            
        c.execute("SELECT seat_number FROM tickets WHERE assignment_id = ? AND status = 'ACTIVE'", (assign_id,))
        active_seats = [r['seat_number'] for r in c.fetchall()]
        
        if len(active_seats) >= 20: return jsonify({"error": "Bus is entirely full (Capacity 20)"}), 400
        assigned_seat = next(i for i in range(1, 21) if i not in active_seats)
        
        c.execute("INSERT INTO tickets (assignment_id, passenger_name, pick_stop_index, drop_stop_index, fare, seat_number) VALUES (?, ?, ?, ?, ?, ?)",
                 (assign_id, pname, pick_idx, drop_idx, fare, assigned_seat))
        conn.commit()
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

@app.route('/api/action/stop', methods=['POST'])
def mark_stop():
    data = request.json
    stop_idx = data.get('stop_index')
    assignment = get_assignment_for_user(data.get('user_id'), "Conductor", date.today().isoformat())
    if not assignment: return jsonify({"error": "No assignment found"}), 404
        
    conn = get_db()
    c = conn.cursor()
    try:
        assign_id = assignment['assign_id']
        c.execute("UPDATE journey_stops SET visited = 1 WHERE assignment_id = ? AND stop_index = ?", (assign_id, stop_idx))
        c.execute("UPDATE tickets SET status = 'ALIGHTED' WHERE assignment_id = ? AND drop_stop_index = ? AND status = 'ACTIVE'", (assign_id, stop_idx))
        conn.commit()
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

@app.route('/api/action/cancel_ticket', methods=['POST'])
def cancel_ticket():
    data = request.json
    ticket_id = data.get('ticket_id')
    assignment = get_assignment_for_user(data.get('user_id'), "Conductor", date.today().isoformat())
    if not assignment: return jsonify({"error": "No assignment"}), 404
        
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("UPDATE tickets SET status = 'CANCELLED' WHERE id = ? AND assignment_id = ?", (ticket_id, assignment['assign_id']))
        conn.commit()
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally: conn.close()
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(port=5000, debug=True)
