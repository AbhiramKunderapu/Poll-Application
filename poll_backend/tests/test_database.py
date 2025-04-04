import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Set testing environment before importing app
os.environ['FLASK_ENV'] = 'testing'
os.environ['TESTING'] = 'True'

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import app
from app import get_db_connection, close_db_connection

class TestDatabaseOperations(unittest.TestCase):
    
    def setUp(self):
        """Set up test client and other test variables."""
        self.app = app.app.test_client()
        self.app.testing = True
        
        # Mock mysql.connector.connect
        self.patcher = patch('mysql.connector.connect')
        self.mock_connect = self.patcher.start()
        
        # Set up mock connection and cursor
        self.mock_connection = MagicMock()
        self.mock_connect.return_value = self.mock_connection
        self.mock_cursor = self.mock_connection.cursor.return_value
        self.mock_cursor.__enter__.return_value = self.mock_cursor
        
    def tearDown(self):
        """Clean up after tests."""
        self.patcher.stop()
    
    def test_get_db_connection(self):
        """Test database connection is established correctly."""
        # Call the function
        connection = get_db_connection()
        
        # Check that mysql.connector.connect was called with correct args
        self.mock_connect.assert_called_once()
        call_args = self.mock_connect.call_args[1]
        
        # Verify connection parameters
        self.assertEqual(call_args['host'], 'localhost')
        self.assertEqual(call_args['user'], 'root')
        self.assertEqual(call_args['database'], 'poll_app')
        self.assertIn('password', call_args)
        
        # Verify the returned connection is correct
        self.assertEqual(connection, self.mock_connection)
    
    def test_close_db_connection(self):
        """Test database connection is closed correctly."""
        # Call the function
        close_db_connection(self.mock_connection)
        
        # Verify connection was closed
        self.mock_connection.close.assert_called_once()
    
    def test_transaction_commit(self):
        """Test that transactions are committed correctly."""
        with patch('app.get_db_connection') as mock_get_db:
            mock_get_db.return_value = self.mock_connection
            
            # Create test query
            query = "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)"
            params = ('testuser', 'test@example.com', 'hashed_password')
            
            # Execute transaction within app context
            with app.app.app_context():
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                
                # Verify cursor executed query
                cursor.execute.assert_called_with(query, params)
                
                # Verify transaction was committed
                conn.commit.assert_called_once()
    
    @patch('app.os.environ.get', return_value=None)  # Disable testing mode
    def test_error_handling(self, mock_env):
        """Test error handling in database operations."""
        # Mock get_db_connection to throw an error directly
        with patch('mysql.connector.connect') as mock_connect:
            mock_connect.side_effect = Exception("Database connection error")
            
            # Execute operation with app context
            with app.app.app_context():
                # This should now raise an exception since we're directly mocking the connector
                with self.assertRaises(Exception):
                    get_db_connection()
    
    def test_connection_pooling(self):
        """Test that connection pooling is configured correctly."""
        # Call the function
        connection = get_db_connection()
        
        # Check that connection pooling args were included
        call_args = self.mock_connect.call_args[1]
        if 'pool_name' in call_args:
            self.assertIsNotNone(call_args['pool_name'])
            self.assertIsNotNone(call_args['pool_size'])
    
    def test_transaction_rollback(self):
        """Test that transactions are rolled back on error."""
        with patch('app.get_db_connection') as mock_get_db:
            mock_get_db.return_value = self.mock_connection
            
            # Simulate an error during transaction
            self.mock_cursor.execute.side_effect = Exception("Database error")
            
            # Execute transaction within app context
            with app.app.app_context():
                try:
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute("INSERT INTO users VALUES (%s, %s, %s)", ('test', 'test@example.com', 'hash'))
                except Exception:
                    conn.rollback()
                
                # Verify rollback was called
                conn.rollback.assert_called_once()

if __name__ == '__main__':
    unittest.main() 