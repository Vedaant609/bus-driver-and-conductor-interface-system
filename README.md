# TransitPro

Hey there! This is a simple bus management system with a Python Flask and SQLite backend. It saves everything—routes, assignments, tickets, and revenue—so you don't lose your data when you close the app.

## What's inside?
- **Admin Dashboard:** Keep an eye on daily revenue and assign buses to routes.
- **Conductor Tools:** Issue and cancel tickets easily while on the road.
- **Driver Alerts:** Get highlighted alerts for upcoming stops so nobody misses their drop.

The best part? Everything syncs up in real-time. If a conductor issues a ticket, the admin sees the revenue update right away!

## How to run it

1. Make sure you have Python 3 installed.
2. Open your terminal in this folder and install what we need:
   ```bash
   pip install flask flask-cors
   ```
3. Start up the backend server:
   ```bash
   python app.py
   ```
4. Open your browser and head over to [http://localhost:5000](http://localhost:5000).

To get started, log in as an Admin, assign a bus for today, and then you can log in as a Conductor in another tab to try issuing tickets!

That's it! Enjoy using TransitPro!
