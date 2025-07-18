# Pikapi
Group 08 Database Project

Members:
Lin Junyu (2401336)
Ng Wei Hao (2401794)
Reynard Tan Suan Wee (2403346)
Tan Bing Kun Terence (2401883)
Tan Jian Xin (2401421)
Tan Yuewen Sara (2401794)

## Features
- Build and edit Pokémon teams with advanced filters
- Battle AI-generated enemy teams with cost constraints
- Persistent player profiles, battle logs, and team data
- SQL and NoSQL support

## Prerequisites
- **Python 3.8+**
- **Node.js & npm** (for static asset management, optional)
- **MongoDB** (local or remote)
- **Redis** (for Flask-Session, optional but recommended)
- **pip** (Python package manager)

## Setup Instructions
### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/Pikapi.git
cd Pikapi
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables
Create a `.env` file in the project root (optional, but recommended):
```
FLASK_ENV=development
MONGO_URI=mongodb://localhost:27017/
MONGO_DB=pokemon_app
SECRET_KEY=your_secret_key
SESSION_TYPE=redis
REDIS_URL=redis://localhost:6379/0
```

- Adjust `MONGO_URI` and `MONGO_DB` as needed for your MongoDB setup.
- If not using Redis, you can omit `SESSION_TYPE` and `REDIS_URL`.

### 4. Run the Flask App
```bash
python main.py
```
- The app will be available at [http://localhost:5000](http://localhost:5000).

### 7. Access the App
- **Home:** `/`
- **Edit Team:** `/edit_team?id=1`
- **Battle:** `/battle`
- **Player Profile:** `/player`
- **Type Effectiveness:** `/type_effectiveness`

## Data Files
- All CSVs are in the `CSV/` directory.
- Pokémon images are in `static/images/`.

## Development Notes
- Static assets (JS/CSS) are in `static/`.
- Templates (HTML) are in `templates/`.
- Backend code is in `app/`.

## Resetting Data
- To fully reset all data (SQL and MongoDB), run:
```bash
python complete_reset.py
