# Redis Setup Guide for Pikapi

This guide will help you set up Redis caching for the Pikapi Pokemon application to improve query performance.

## Prerequisites
- Python 3.7+
- pip (Python package manager)
- Redis server

## Installation Steps

### 1. Install Redis Server
- **Windows:** Download from https://github.com/microsoftarchive/redis/releases, extract, and run `redis-server.exe`.
- **macOS:** `brew install redis && brew services start redis`
- **Linux:** `sudo apt install redis-server && sudo systemctl start redis-server`

### 2. Install Python Redis Client
```bash
pip install redis>=4.5.0
```
Or install all requirements:
```bash
pip install -r requirements.txt
```

### 3. Verify Redis Installation
```bash
redis-cli ping
```
You should see: `PONG`

## Configuration
- Default: `localhost:6379`, db 0, no password
- To customize, edit `app/cache.py` (host, port, db, password)

## Usage
- Start the app: `python main.py`
- Access dashboard: `http://localhost:5000/cache`
- Use dashboard to warm/clear cache and monitor stats

## Troubleshooting
- Ensure Redis server is running
- Check connection settings
- Use `redis-cli` for diagnostics
- See logs for errors

## Security & Production
- Use authentication and bind to localhost
- Monitor memory and hit rates
- Use persistence and clustering for reliability 