import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# Set testing environment before importing app
os.environ['FLASK_ENV'] = 'testing'
os.environ['TESTING'] = 'True'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_USER'] = 'test_user'
os.environ['DB_PASSWORD'] = 'test_password'
os.environ['DB_NAME'] = 'test_poll_app'
os.environ['JWT_SECRET_KEY'] = 'test_secret_key'

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import app

@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.app.config['TESTING'] = True
    with app.app.test_client() as client:
        yield client

@pytest.fixture
def mock_db_connection():
    """Mock database connection and cursor."""
    with patch('app.get_db_connection') as mock_get_db:
        # Set up mock connection and cursor
        mock_connection = MagicMock()
        mock_get_db.return_value = mock_connection
        mock_cursor = mock_connection.cursor.return_value
        mock_cursor.__enter__.return_value = mock_cursor
        
        # Return mocks for test to configure
        yield mock_get_db, mock_connection, mock_cursor

@pytest.fixture
def auth_token():
    """Create a JWT token for a test user."""
    user_id = 1
    username = 'testuser'
    with patch('app.PyJWT.encode') as mock_encode:
        mock_encode.return_value = 'test_token'
        token = app.create_token(user_id, username)
        
        return {
            'user_id': user_id,
            'username': username,
            'token': token,
            'headers': {'Authorization': f'Bearer {token}'}
        }

@pytest.fixture
def mock_jwt_decode():
    """Mock jwt.decode to return test user data."""
    with patch('app.PyJWT.decode') as mock_decode:
        mock_decode.return_value = {
            'user_id': 1,
            'username': 'testuser'
        }
        yield mock_decode 