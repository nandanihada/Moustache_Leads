# Gunicorn configuration for Render deployment
import os

# Bind to the port Render provides
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# Workers — 1 sync worker for 512MB RAM on Render
# With only 5 background services (down from 15), 1 worker is sufficient for ~22 users/day
# Total memory: ~200-250MB (well within 512MB limit)
workers = 1
timeout = 180  # 3 minutes for bulk import operations

# Prevent memory leaks — restart workers after N requests
max_requests = 800
max_requests_jitter = 100

# Memory limit: restart worker if it exceeds threshold
# This prevents slow memory leaks from accumulating
worker_tmp_dir = "/dev/shm"

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

def post_worker_init(worker):
    """Only the first worker (worker.age == 1) runs background services.
    This prevents duplicate threads consuming memory across workers."""
    import os
    if worker.age == 1:
        os.environ['RUN_BACKGROUND_SERVICES'] = '1'
    else:
        os.environ['RUN_BACKGROUND_SERVICES'] = '0'
