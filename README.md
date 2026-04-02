# TransitPro - Permanent Data Edition

TransitPro has been upgraded to include a full **Python Flask + SQLite backend**, meaning all routes, assignments, tickets, and revenue histories are now permanently saved.

## Features Built
- **Admin Analytics Dashboard:**
  - View detailed Day-Wise Analytics for your generated revenue broken down per route.
  - Hard-assign a Bus ID to a specific Route on a specific Date before the Conductor or Driver logs in.
- **Conductor Operations:** Issue/cancel tickets and mark route progression.
- **Driver Alert System:** Stops where passengers must alight are prominently highlighted in red to reduce missing drops.
- **Real-Time Cross-Tab Sync via API:** The frontend continuously tracks and pulls state from the `SQLite` Database via an internal REST API (`localhost:5000/api`), keeping all Conductors, Drivers, and Admin screens in sync!

## Prerequisites
- Python 3 installed
- Web browser

## Installation & Setup

1. Open your terminal/command prompt to this folder.
2. Ensure you have the required python packages (`Flask` and `Flask-CORS`) installed by running:
```bash
pip install flask flask-cors
```
3. Boot up the dedicated server by running:
```bash
python app.py
```
4. Access the App: Open your web browser and navigate directly to **[http://localhost:5000](http://localhost:5000)**. 

### How to use Daily Scheduling as an Admin
1. Login as an **Admin**.
2. Go to the **Assign Bus** card. Select today's date, pick a Route, and assign a bus to it (e.g., `BUS-99`). Click **Lock Assignment**.
3. Now open a separate browser tab to **http://localhost:5000** and log in as a **Conductor** for `BUS-99`. 
4. Issue tickets during your trip!
5. In your Admin tab, change the Date Picker in the **Daily Analytics** box to today's date to watch the revenue update per route!
