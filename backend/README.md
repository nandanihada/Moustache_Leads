# Ascend Backend API

A clean and secure Python Flask backend with MongoDB integration for the Ascend application.

## Features

- **User Authentication**: Registration and login with JWT tokens
- **Password Security**: Bcrypt hashing for secure password storage
- **MongoDB Integration**: Using MongoDB Atlas with proper connection handling
- **CORS Support**: Configured for frontend integration
- **Input Validation**: Comprehensive validation for user inputs
- **Error Handling**: Proper error responses and logging
- **Token-based Auth**: JWT tokens for secure API access

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Configuration

The `.env` file is already configured with your MongoDB connection string. Make sure to update the `JWT_SECRET_KEY` for production:

```env
MONGODB_URI=mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/?retryWrites=true&w=majority&appName=Mustache
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
FLASK_ENV=development
PORT=5000
```

### 3. Run the Application

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword123"
}
```

**Response:**
```json
{
    "message": "User registered successfully",
    "token": "jwt_token_here",
    "user": {
        "id": "user_id",
        "username": "john_doe",
        "email": "john@example.com"
    }
}
```

#### POST `/api/auth/login` or `/login` (legacy)
Login with existing credentials.

**Request Body:**
```json
{
    "username": "john_doe",
    "password": "securepassword123"
}
```

**Response:**
```json
{
    "message": "Login successful",
    "token": "jwt_token_here",
    "user": {
        "id": "user_id",
        "username": "john_doe",
        "email": "john@example.com"
    }
}
```

#### GET `/api/auth/profile`
Get user profile (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Response:**
```json
{
    "user": {
        "id": "user_id",
        "username": "john_doe",
        "email": "john@example.com",
        "created_at": "2023-01-01T00:00:00"
    }
}
```

#### POST `/api/auth/verify-token`
Verify if JWT token is valid.

**Headers:**
```
Authorization: Bearer jwt_token_here
```

### Utility Endpoints

#### GET `/health`
Check API and database health.

#### GET `/`
Get API information and available endpoints.

## Database Schema

### Users Collection
```json
{
    "_id": "ObjectId",
    "username": "string (unique)",
    "email": "string (unique)",
    "password": "hashed_string",
    "created_at": "datetime",
    "updated_at": "datetime",
    "is_active": "boolean"
}
```

## Security Features

- **Password Hashing**: Uses bcrypt for secure password storage
- **JWT Tokens**: Stateless authentication with configurable expiration
- **Input Validation**: Email format, password strength, and required field validation
- **CORS Configuration**: Properly configured for frontend integration
- **Error Handling**: Secure error messages without exposing sensitive information

## Frontend Integration

The backend is configured to work with your existing React frontend. The login page at `/src/pages/Login.tsx` will work seamlessly with the `/login` endpoint.

## Development Notes

- Database name: `ascend_db`
- JWT token expiration: 24 hours (configurable)
- Supported CORS origins: localhost:3000, localhost:5173 (Vite/React dev servers)
- All passwords are hashed using bcrypt before storage
- MongoDB connection uses connection pooling for optimal performance
