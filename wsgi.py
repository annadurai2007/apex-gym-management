import os
import sys
from pathlib import Path

# Ensure root directory is in python path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))

from backend.app import create_app

# WSGI Application object
app = create_app()

if __name__ == "__main__":
    from backend.config import Config
    app.run(host="0.0.0.0", port=Config.FLASK_PORT)
