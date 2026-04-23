from pymongo import MongoClient
from config import Config
import logging
import ssl
import certifi

class Database:
    _instance = None
    _client = None
    _db = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            self.connect()
    
    def connect(self):
        try:
            if not Config.MONGODB_URI:
                logging.warning("MONGODB_URI not set — skipping database connection")
                self._client = None
                self._db = None
                return
            
            # Try multiple connection approaches
            import time
            connection_attempts = [
                # Attempt 1: Atlas connection with certifi CA + custom timeouts
                lambda: MongoClient(
                    Config.MONGODB_URI,
                    tlsCAFile=certifi.where(),
                    serverSelectionTimeoutMS=30000,
                    connectTimeoutMS=30000,
                    socketTimeoutMS=60000,
                    maxPoolSize=50,
                    minPoolSize=5,
                    retryWrites=True,
                    retryReads=True
                ),
                # Attempt 2: Atlas connection with SSL bypass for problematic networks
                lambda: MongoClient(
                    Config.MONGODB_URI,
                    tlsAllowInvalidCertificates=True,
                    serverSelectionTimeoutMS=30000,
                    connectTimeoutMS=30000,
                    socketTimeoutMS=60000,
                    maxPoolSize=50,
                    minPoolSize=5,
                    retryWrites=True,
                    retryReads=True
                ),
                # Attempt 3: Standard connection with pooling
                lambda: MongoClient(
                    Config.MONGODB_URI,
                    serverSelectionTimeoutMS=30000,
                    maxPoolSize=50,
                    minPoolSize=5,
                    retryWrites=True,
                    retryReads=True
                ),
            ]
            
            for i, attempt in enumerate(connection_attempts, 1):
                if attempt is None:
                    continue
                    
                try:
                    logging.info(f"MongoDB connection attempt {i}...")
                    self._client = attempt()
                    # Test the connection with a short timeout
                    self._client.admin.command('ping')
                    self._db = self._client[Config.DATABASE_NAME]
                    logging.info(f"Successfully connected to MongoDB on attempt {i}")
                    return
                except Exception as attempt_error:
                    logging.warning(f"Connection attempt {i} failed: {attempt_error}")
                    if self._client:
                        self._client.close()
                    self._client = None
                    self._db = None
                    # Small sleep before next attempt if this was a network blip
                    if i < len(connection_attempts):
                        time.sleep(2)
                    continue
            
            # If all attempts failed
            raise Exception("All connection attempts failed. Check your internet connection or MongoDB Atlas IP whitelist.")
            
        except Exception as e:
            logging.error(f"Failed to connect to MongoDB: {e}")
            # Don't raise the exception to allow the app to start without DB
            logging.warning("App will continue without database connection")
            self._client = None
            self._db = None
    
    def get_db(self):
        if self._db is None:
            logging.warning("Database is not connected")
        return self._db
    
    def get_collection(self, collection_name):
        if self._db is None:
            logging.warning("Database is not connected")
            return None
        return self._db[collection_name]
    
    def is_connected(self):
        return self._client is not None and self._db is not None
    
    def close_connection(self):
        if self._client:
            self._client.close()
            logging.info("MongoDB connection closed")

# Global database instance
db_instance = Database()
