import unittest
import os
import sys
import json
from unittest.mock import patch, MagicMock
import jwt
import datetime
from werkzeug.security import generate_password_hash, check_password_hash

# Set testing environment before importing app
os.environ['FLASK_ENV'] = 'testing'
os.environ['TESTING'] = 'True'

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import app
from app import create_token, verify_token

class TestAuthentication(unittest.TestCase):
    
    def setUp(self):
        """Set up test client and other test variables."""
        self.app = app.app.test_client()
        self.app.testing = True
        
        # Test user data
        self.user_id = 1
        self.username = 'testuser'
        
    def test_password_hashing(self):
        """Test that password hashing works correctly."""
        password = 'testpassword'
        
        # Hash the password
        hashed_password = generate_password_hash(password)
        
        # Check that the hash is different from the original password
        self.assertNotEqual(password, hashed_password)
        
        # Check that the hash can be verified
        self.assertTrue(check_password_hash(hashed_password, password))
        
        # Check that wrong password doesn't verify
        self.assertFalse(check_password_hash(hashed_password, 'wrongpassword'))
    
    def test_token_creation(self):
        """Test JWT token creation."""
        # Create token
        token = create_token(self.user_id, self.username)
        
        # Check that token is a string
        self.assertIsInstance(token, str)
        
        # Decode the token to verify contents
        decoded = jwt.decode(token, app.app.config['SECRET_KEY'], algorithms=['HS256'])
        
        # Check that decoded token contains correct user info
        self.assertEqual(decoded['user_id'], self.user_id)
        self.assertEqual(decoded['username'], self.username)
        self.assertIn('exp', decoded)  # Should have an expiration time
    
    # Skip token verification tests that rely on request context
    def test_token_verification(self):
        """Test JWT token verification."""
        # Create token
        token = create_token(self.user_id, self.username)
        # Create a request context with the Authorization header
        with app.app.test_request_context(headers={'Authorization': f'Bearer {token}'}):
            # Verify token
            user_id, username = verify_token()
            # Check that correct user info is returned
            self.assertEqual(user_id, self.user_id)
            self.assertEqual(username, self.username)

    def test_token_verification_failure_invalid_token(self):
        """Test JWT token verification with invalid token."""
        with app.app.test_request_context(headers={'Authorization': 'Bearer invalid_token'}):
            # Verify token should fail
            with self.assertRaises(Exception) as context:
                verify_token()
            self.assertIn('Invalid token', str(context.exception))

    def test_token_verification_missing_header(self):
        """Test JWT token verification with missing Authorization header."""
        with app.app.test_request_context(headers={}):
            # Verify token should fail
            with self.assertRaises(Exception) as context:
                verify_token()
            self.assertIn('Authorization header missing or invalid', str(context.exception))

    
    def test_login_endpoint(self):
        """Test login endpoint with correct credentials."""
        # Mock cursor response for valid user
        with patch('app.get_db_connection') as mock_get_db:
            # Set up mock cursor with a valid user
            mock_connection = MagicMock()
            mock_get_db.return_value = mock_connection
            mock_cursor = mock_connection.cursor.return_value
            mock_cursor.__enter__.return_value = mock_cursor
            
            # Create hashed password for test
            password = 'testpassword'
            hashed_password = generate_password_hash(password)
            
            # Mock cursor to return user with hashed password
            mock_cursor.fetchone.return_value = (self.user_id, self.username, 'test@example.com', hashed_password)
            
            # Test login with correct credentials
            login_data = {
                'username': self.username,
                'password': password
            }
            
            response = self.app.post(
                '/api/login',
                data=json.dumps(login_data),
                content_type='application/json'
            )
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertIn('token', data)
            self.assertEqual(data['user_id'], self.user_id)
            self.assertEqual(data['username'], self.username)
    
    @patch('app.os.environ.get', return_value=None)  # Disable testing mode
    def test_login_endpoint_invalid_credentials(self, mock_env):
        """Test login endpoint with incorrect credentials."""
        # Mock cursor response for valid user
        with patch('app.get_db_connection') as mock_get_db, \
             patch('app.check_password_hash', return_value=False) as mock_check:
            # Set up mock cursor with a valid user
            mock_connection = MagicMock()
            mock_get_db.return_value = mock_connection
            mock_cursor = mock_connection.cursor.return_value
            mock_cursor.__enter__.return_value = mock_cursor
            
            # Create hashed password for test
            password = 'testpassword'
            hashed_password = generate_password_hash(password)
            
            # Mock cursor to return user with hashed password
            mock_cursor.fetchone.return_value = (self.user_id, self.username, 'test@example.com', hashed_password)
            
            # Test login with incorrect password
            login_data = {
                'username': self.username,
                'password': 'wrongpassword'
            }
            
            response = self.app.post(
                '/api/login',
                data=json.dumps(login_data),
                content_type='application/json'
            )
            
            # Check response
            self.assertEqual(response.status_code, 401)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertEqual(data['message'], 'Invalid credentials')
    
    def test_protected_endpoint(self):
        """Test accessing a protected endpoint with valid token."""
        # Create token for test user
        token = create_token(self.user_id, self.username)
        
        # Set testing environment
        with patch.dict('os.environ', {'TESTING': 'True'}), \
            patch('app.get_db_connection') as mock_get_db:
            
            # Set up mock connection and cursor
            mock_connection = MagicMock()
            mock_get_db.return_value = mock_connection
            
            # Create a more detailed mock cursor to handle the specific SQL query in get_polls
            mock_cursor = MagicMock()
            mock_connection.cursor.return_value = mock_cursor
            mock_cursor.__enter__.return_value = mock_cursor
            
            # Prepare mock result that matches the structure expected in get_polls
            mock_result = [
                (1, 'Test Poll 1', 'Question 1?', '2023-12-31', 'abc123', 
                datetime.datetime.now(), 2, 10),  # Match all columns in the query
                (2, 'Test Poll 2', 'Question 2?', '2023-12-31', 'def456', 
                datetime.datetime.now(), 3, 15)
            ]
            mock_cursor.fetchall.return_value = mock_result
            
            # Test accessing protected endpoint with valid token
            response = self.app.get(
                '/api/polls',
                headers={'Authorization': f'Bearer {token}'}
            )
            
            # Debug response if error occurs
            if response.status_code != 200:
                print(f"Response data: {response.data}")
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['polls']), 2)

if __name__ == '__main__':
    unittest.main() 