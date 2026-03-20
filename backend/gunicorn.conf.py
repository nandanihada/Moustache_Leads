# Gunicorn configuration for Render deployment
import os

# Bind to the port Render provides
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# Workers — 2 sync workers (gevent removed to fix Render crash)
workers = 2
timeout = 180  # 3 minutes for bulk import operations

# Prevent memory leaks — restart workers after N requests
max_requests = 1000
max_requests_jitter = 50

# IMPORTANT: preload_app = False to avoid fork-unsafe MongoDB connections
# PyMongo connections established before fork() are NOT safe in child workers.
# Each worker will create its own app + DB connection on startup.
preload_app = False

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Graceful restart
graceful_timeout = 30
keepalive = 5
