
# Flight Route Planner - Setup Instructions


## Quick Start Summary

1.  Install MySQL and create database
2.  Import `db/seed_flights.sql`
3.  Update MySQL credentials in `backend/app/__init__.py`
4.  Create virtual environment: `python -m venv .venv`
5.  Activate venv: `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Mac/Linux)
6.  Install backend deps: `pip install -r requirements.txt`
7.  Run backend: `python run.py` (Terminal 1)
8.  Install frontend deps: `cd frontend && npm install`
9.  Run frontend: `npm start` (Terminal 2)
10. Open browser to http://localhost:3000

---

This is a full-stack flight route planning application built with Flask (Python backend) and React (frontend).

Before running the project, ensure you have the following installed:

1. **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
2. **Node.js 16+ and npm** - [Download Node.js](https://nodejs.org/)
3. **MySQL Server** - [Download MySQL](https://dev.mysql.com/downloads/mysql/)
---

##  Database Setup

### Step 1: Install and Start MySQL

1. Install MySQL if not already installed
2. Start MySQL server
3. Open MySQL command line or MySQL Workbench

### Step 2: Create Database and Import Data

1. Open MySQL command line:
   ```bash
   mysql -u root -p
   ```
   (Enter your MySQL root password when prompted)

2. Create the database:
   ```sql
   CREATE DATABASE flight_planner;
   ```

3. Use the database:
   ```sql
   USE flight_planner;
   ```

4. Import the SQL file:
   ```sql
   SOURCE db/seed_flights.sql;
   ```
   
   **OR** if you're in the project root directory:
   ```bash
   mysql -u root -p flight_planner < db/seed_flights.sql
   ```

### Step 3: Update Database Credentials

Open `backend/app/__init__.py` and update the MySQL configuration (lines 19-22):

```python
app.config["MYSQL_HOST"] = "localhost"          # Usually localhost
app.config["MYSQL_USER"] = "root"               # Your MySQL username
app.config["MYSQL_PASSWORD"] = "your_password"  # Your MySQL password
app.config["MYSQL_DB"] = "flight_planner"       # Database name
```

** IMPORTANT:** Replace `your_password` with your actual MySQL root password.

---

##  Backend Setup (Flask)

### Step 1: Navigate to Project Directory

```bash
cd dsaProjectFinal-main-fixed
```

### Step 2: Create Virtual Environment (Recommended)

**On Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

You should see `(.venv)` in your terminal prompt.

### Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- Flask
- flask-cors
- mysql-connector-python
- requests

### Step 4: Run the Backend Server

```bash
python run.py
```

The backend server will start on **http://localhost:5000**

You should see output like:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

**Keep this terminal window open** - the backend server needs to keep running.

---

##  Frontend Setup (React)

### Step 1: Open a NEW Terminal Window

Keep the backend server running in the first terminal, and open a second terminal window.

### Step 2: Navigate to Frontend Directory

```bash
cd dsaProjectFinal-main-fixed/frontend
```

### Step 3: Install Node Dependencies

```bash
npm install
```

This will install all React dependencies including:
- React
- React Router
- Leaflet (for maps)
- React Icons
- And other dependencies listed in `package.json`


### Step 4: Start the Frontend Development Server

```bash
npm start
```

The React app will start on **http://localhost:3000**

Your browser should automatically open to `http://localhost:3000`

---


### Frontend

1. Navigate to `http://localhost:3000`
2. You should see the Flight Route Planner dashboard

---

##  Running the Complete Application

**To run the full application, you need TWO terminal windows:**

### Terminal 1 - Backend (Flask)
```bash
cd dsaProjectFinal-main-fixed
.venv\Scripts\activate          # Windows
# OR
source .venv/bin/activate       # macOS/Linux
python run.py
```

### Terminal 2 - Frontend (React)
```bash
cd dsaProjectFinal-main-fixed/frontend
npm start
```

---



## Quick Start Summary

1.  Install MySQL and create database
2.  Import `db/seed_flights.sql`
3.  Update MySQL credentials in `backend/app/__init__.py`
4.  Create virtual environment: `python -m venv .venv`
5.  Activate venv: `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Mac/Linux)
6.  Install backend deps: `pip install -r requirements.txt`
7.  Run backend: `python run.py` (Terminal 1)
8.  Install frontend deps: `cd frontend && npm install`
9.  Run frontend: `npm start` (Terminal 2)
10. Open browser to http://localhost:3000

---

