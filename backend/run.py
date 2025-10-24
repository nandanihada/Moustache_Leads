#!/usr/bin/env python3
"""
Production-ready entry point for the Ascend Backend API
"""

from app import create_app
from config import Config
from database import db_instance
import logging

def main():
    """Main entry point for the application"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create Flask app
    app = create_app()
    
    # Initialize database connection
    try:
        db_instance.connect()
        logging.info("Database connection established successfully")
    except Exception as e:
        logging.error(f"Failed to connect to database: {e}")
        return 1
    
    # Start the application
    logging.info(f"Starting Ascend Backend API on port {Config.PORT}")
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=Config.FLASK_ENV == 'development'
    )
    
    return 0

if __name__ == '__main__':
    exit(main())
