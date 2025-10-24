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
            # Try multiple connection approaches
            connection_attempts = [
                # Attempt 1: Atlas connection with SSL bypass
                lambda: MongoClient(
                    Config.MONGODB_URI,
                    serverSelectionTimeoutMS=10000,
                    connectTimeoutMS=20000,
                    socketTimeoutMS=30000,
                    tlsAllowInvalidCertificates=True
                ),
                # Attempt 2: Standard connection
                lambda: MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000),
                # Attempt 3: Local fallback
                lambda: MongoClient("mongodb://localhost:27017/ascend_db", serverSelectionTimeoutMS=2000)
            ]
            
            for i, attempt in enumerate(connection_attempts, 1):
                if attempt is None:
                    continue
                    
                try:
                    logging.info(f"MongoDB connection attempt {i}...")
                    self._client = attempt()
                    self._db = self._client[Config.DATABASE_NAME]
                    # Test the connection
                    self._client.admin.command('ping')
                    logging.info(f"Successfully connected to MongoDB on attempt {i}")
                    return
                except Exception as attempt_error:
                    logging.warning(f"Connection attempt {i} failed: {attempt_error}")
                    if self._client:
                        self._client.close()
                    self._client = None
                    self._db = None
                    continue
            
            # If all attempts failed
            raise Exception("All connection attempts failed")
            
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
