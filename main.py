import os
import subprocess
import sys
from flask import Flask
from flask_session import Session
from app.routes import register_routes

def check_and_init_database():
    """Check if pokemon.db exists, if not run init_db.py"""
    db_path = 'pokemon.db'
    
    if not os.path.exists(db_path):
        print("Database not found. Initializing database...")
        try:
            # Run the init_db.py script
            result = subprocess.run([sys.executable, 'init_db.py'], 
                                  capture_output=True, text=True, check=True)
            print("Database initialization completed successfully.")
            print(result.stdout)
        except subprocess.CalledProcessError as e:
            print(f"Error initializing database: {e}")
            print(f"Error output: {e.stderr}")
            sys.exit(1)
        except FileNotFoundError:
            print("Error: init_db.py not found. Please ensure the file exists.")
            sys.exit(1)
    else:
        print("Database found. Starting application...")

# Check and initialize database before starting Flask app
check_and_init_database()

app = Flask(__name__)
app.secret_key = 'b6e2e2c1e2e4a7b1c3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6'  # Change this to a secure, random value and keep it constant!
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 60 * 60 * 24 * 7  # 7 days (in seconds)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True if using HTTPS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
Session(app)

register_routes(app)

if __name__ == '__main__':
    app.run(debug=True)