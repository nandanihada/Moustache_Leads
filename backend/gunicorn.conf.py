# Gunicorn configuration for Render deployment
import os

# Bind to the port Render provides
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# Workers
workers = 2
worker_class = "sync"
timeout = 180  # 3 minutes for bulk import operations

# Prevent memory leaks — restart workers after N requests
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Graceful restart
graceful_timeout = 30
keepalive = 5
