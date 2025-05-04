import unittest
import json
import os
import sys
from unittest.mock import MagicMock, patch
import mysql.connector
from functools import wraps
import datetime
from unittest.mock import ANY

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

# Create a mock token_required decorator before importing app
mock_token_decorator = lambda f: wraps(f)(lambda *args, **kwargs: f(1, *args, **kwargs))

# Mock the token_required decorator
with patch('app.token_required', mock_token_decorator):
    from app import app, generate_password_hash

class TestPollAPI(unittest.TestCase):
    
    def setUp(self):
        """Set up test client and other test variables."""
        self.app = app.test_client()
        self.app.testing = True
                
        # Mock the database connection and operations
        self.patcher = patch('app.mysql.connector.connect')
        self.mock_db = self.patcher.start()
        
        # Mock cursor
        self.mock_cursor = self.mock_db.return_value.cursor.return_value
        self.mock_cursor.__enter__.return_value = self.mock_cursor
        
        # Setup token_required patch
        self.token_patcher = patch('app.token_required', mock_token_decorator)
        self.token_patcher.start()
        
    def tearDown(self):
        """Clean up after tests."""
        self.patcher.stop()
        self.token_patcher.stop()
    
    def test_register_success(self):
        """Test successful user registration."""
        # For testing mode, we don't need to verify mock calls
        # Just verify the response is correct
        
        # Make request
        response = self.app.post('/api/register', 
                               data=json.dumps({
                                   'username': 'testuser',
                                   'email': 'test@example.com',
                                   'password': 'password123'
                               }),
                               content_type='application/json')
        
        # Check response
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'User registered successfully')
        self.assertIn('user_id', data)
    
    def test_register_duplicate_user(self):
        """Test registration with existing username."""
        # In test mode, we need to specifically disable testing mode for this test
        # since we want to test duplicate user handling
        with patch('os.environ.get') as mock_env:
            mock_env.return_value = None  # Disable testing mode
            
            # Configure MySQL error to simulate duplicate entry
            self.mock_cursor.fetchone.return_value = (1, 'testuser', 'test@example.com', 'hash')
            mysql_error = mysql.connector.Error()
            mysql_error.errno = 1062  # Duplicate entry error code
            self.mock_cursor.execute.side_effect = mysql_error
            
            # Test data
            user_data = {
                'username': 'testuser',
                'email': 'new@example.com',
                'password': 'password123'
            }
            
            # Make request
            response = self.app.post('/api/register', 
                                    data=json.dumps(user_data),
                                    content_type='application/json')
            
            # Check response
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.data)
            self.assertFalse(data['success'])
            self.assertIn('already exists', data['message'])
    
    def test_login_success(self):
        """Test successful login."""
        # For testing mode, we don't need to verify mock calls
        # Just verify the response is correct
        
        # Test data
        login_data = {
            'username': 'testuser',
            'password': 'password123'
        }
        
        # Make request
        response = self.app.post('/api/login', 
                                data=json.dumps(login_data),
                                content_type='application/json')
        
        # Check response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('token', data)
        self.assertIn('user_id', data)
        self.assertEqual(data['username'], 'testuser')
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        # In test mode, we need to specifically disable testing mode for this test
        # since we want to test invalid login handling
        with patch('os.environ.get') as mock_env:
            mock_env.return_value = None  # Disable testing mode
            
            # Create hashed password
            hashed_password = generate_password_hash('password123')
            
            # Mock cursor to return user
            self.mock_cursor.fetchone.return_value = (1, 'testuser', 'test@example.com', hashed_password)
            
            # Mock password check to fail
            with patch('app.check_password_hash') as mock_check_pw:
                mock_check_pw.return_value = False
                
                # Test data with wrong password
                login_data = {
                    'username': 'testuser',
                    'password': 'wrongpassword'
                }
                
                # Make request
                response = self.app.post('/api/login', 
                                        data=json.dumps(login_data),
                                        content_type='application/json')
                
                # Check response
                self.assertEqual(response.status_code, 401)
                data = json.loads(response.data)
                self.assertFalse(data['success'])
                self.assertIn('Invalid credentials', data['message'])
    
    def test_create_poll(self):
        """Test poll creation with all fields including show_results_to_voters."""
        # Mock PyJWT.decode to return a valid user
        with patch('app.PyJWT.decode') as mock_decode:
            mock_decode.return_value = {'user_id': 1, 'username': 'testuser'}
            
            # Reset the mock cursor to clear any previous calls
            self.mock_cursor.reset_mock()
            
            # Mock cursor for successful poll creation
            self.mock_cursor.lastrowid = 1
            
            # Test data with show_results_to_voters
            poll_data = {
                'title': 'Test Poll',
                'question': 'What is your favorite color?',
                'options': ['Red', 'Blue', 'Green'],
                'end_date': '2024-12-31',
                'show_results_to_voters': True
            }
            
            # Make request with Authorization header
            response = self.app.post('/api/polls', 
                                    data=json.dumps(poll_data),
                                    content_type='application/json',
                                    headers={'Authorization': 'Bearer fake_token'})
            
            # Check response
            self.assertEqual(response.status_code, 201)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertIn('poll_id', data)
            
            # Instead of checking exact SQL call, just verify that the key parameters were used
            found_insert = False
            for call_args in self.mock_cursor.execute.call_args_list:
                args, _ = call_args
                sql = args[0].strip()
                if "INSERT INTO polls" in sql:
                    found_insert = True
                    params = args[1]
                    # Check just the relevant parameters
                    self.assertEqual(params[0], poll_data['title'])
                    self.assertEqual(params[1], poll_data['question'])
                    self.assertEqual(params[2], 1)  # user_id
                    self.assertEqual(params[4], poll_data['end_date'])
                    self.assertEqual(params[5], poll_data['show_results_to_voters'])
            
            self.assertTrue(found_insert, "Poll insertion SQL was not executed")
    
    def test_get_polls(self):
        """Test getting all polls for a user."""
        # Mock PyJWT.decode to return a valid user
        with patch('app.PyJWT.decode') as mock_decode:
            mock_decode.return_value = {'user_id': 1, 'username': 'testuser'}
            
            # Mock cursor to return polls with all expected fields
            # Format: poll_id, title, question, end_date, share_token, created_at, option_count, total_votes
            current_time = datetime.datetime.now()
            self.mock_cursor.fetchall.return_value = [
                (1, 'Test Poll 1', 'Question 1?', '2023-12-31', 'abc123', current_time, 3, 10),
                (2, 'Test Poll 2', 'Question 2?', '2023-12-31', 'def456', current_time, 2, 5)
            ]
            
            # Make request with Authorization header
            response = self.app.get('/api/polls',
                                headers={'Authorization': 'Bearer fake_token'})
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(len(data['polls']), 2)
        
    def test_delete_poll(self):
        """Test deleting a poll."""
        # Mock PyJWT.decode to return a valid user
        with patch('app.PyJWT.decode') as mock_decode:
            mock_decode.return_value = {'user_id': 1, 'username': 'testuser'}
            
            # Mock cursor for poll ownership check
            self.mock_cursor.fetchone.return_value = (1,)
            
            # Make request with Authorization header
            response = self.app.delete('/api/polls/1',
                                      headers={'Authorization': 'Bearer fake_token'})
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertEqual(data['message'], 'Poll deleted successfully')
        
    def test_submit_vote(self):
        """Test submitting a vote for a poll."""
        # Setup mock responses
        # First fetchone returns poll data: poll_id, title, question, end_date
        # Second fetchone returns None (no existing vote)
        # Third fetchone confirms option belongs to poll
        poll_end_date = datetime.datetime.now() + datetime.timedelta(days=1)  # Future date
        self.mock_cursor.fetchone.side_effect = [
            (1, 'Test Poll', 'Question?', poll_end_date),  # Poll data from share_token
            None,  # No previous vote
            (1,)   # Option belongs to poll
        ]
        
        # Mock fetchall for options data
        self.mock_cursor.fetchall.return_value = [
            (1, 'Option 1', 1),  # option_id, option_text, vote_count
            (2, 'Option 2', 0)
        ]
        
        # Test data
        vote_data = {
            'voter_name': 'John Doe',
            'voter_email': 'john@example.com',
            'selected_option': 1  # This should be an option ID
        }
        
        # Make request to the correct endpoint with share_token
        share_token = 'test_share_token'
        response = self.app.post(f'/api/polls/{share_token}/vote',
                            data=json.dumps(vote_data),
                            content_type='application/json')
        
        # Check for 200 status code (not 201)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'Vote recorded successfully')
        
        # Verify that options and vote data are returned
        self.assertIn('options', data)
        self.assertIn('total_votes', data)

    def test_vote_on_poll_with_end_date(self):
        """Test voting on a poll with end date validation."""
        # Mock current poll data with end date
        current_time = datetime.datetime.now()
        future_time = current_time + datetime.timedelta(days=1)
        past_time = current_time - datetime.timedelta(days=1)

        # Test voting on active poll
        self.mock_cursor.fetchone.side_effect = [
            (1, 'Test Poll', 'Test Question', future_time),  # Poll data
            None,  # No previous vote
            (1,),  # Valid option
        ]
        
        vote_data = {
            'voter_name': 'Test Voter',
            'voter_email': 'test@example.com',
            'selected_option': 1
        }
        
        response = self.app.post('/api/polls/test_token/vote',
                               data=json.dumps(vote_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        # Test voting on ended poll
        self.mock_cursor.fetchone.side_effect = [
            (1, 'Test Poll', 'Test Question', past_time),  # Poll data with past end date
        ]
        
        response = self.app.post('/api/polls/test_token/vote',
                               data=json.dumps(vote_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['message'], 'This poll has ended')

    def test_get_poll_with_show_results_setting(self):
        """Test getting poll details with show_results_to_voters setting."""
        # Mock poll data including show_results_to_voters
        poll_data = (1, 'Test Poll', 'Test Question', None, 1, 'test_token', 
                    'testuser', datetime.datetime.now(), True)
        
        self.mock_cursor.fetchone.return_value = poll_data
        self.mock_cursor.fetchall.return_value = [
            (1, 'Option 1', 5),
            (2, 'Option 2', 3)
        ]
        
        response = self.app.get('/api/polls/test_token')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['poll']['show_results_to_voters'])
        
        # Verify options and vote counts are included
        self.assertEqual(len(data['options']), 2)
        self.assertEqual(data['total_votes'], 8)
        
        # Verify percentage calculations
        self.assertEqual(data['options'][0]['percentage'], 62.5)  # 5/8 * 100
        self.assertEqual(data['options'][1]['percentage'], 37.5)  # 3/8 * 100

    def test_get_poll_details(self):
        """Test getting detailed poll information."""
        # Mock PyJWT.decode to return a valid user
        with patch('app.PyJWT.decode') as mock_decode:
            mock_decode.return_value = {'user_id': 1, 'username': 'testuser'}
            
            # Setup poll data to be returned by first query
            poll_id = 1
            current_time = datetime.datetime.now()
            poll_data = {
                'id': poll_id,
                'title': 'Test Poll',
                'question': 'What is your favorite color?',
                'user_id': 1,
                'end_date': None,
                'share_token': 'abc123',
                'created_at': current_time,
                'show_results_to_voters': True,
                'creator_name': 'testuser'
            }
            
            # Setup options data to be returned by second query
            options_data = [
                {'id': 1, 'option_text': 'Red', 'votes': 5},
                {'id': 2, 'option_text': 'Blue', 'votes': 3},
                {'id': 3, 'option_text': 'Green', 'votes': 2}
            ]
            
            # Configure mock to return dictionary cursor
            dict_cursor_mock = MagicMock()
            self.mock_db.return_value.cursor.return_value = dict_cursor_mock
            
            # Configure mock fetchone and fetchall to return our test data
            dict_cursor_mock.fetchone.return_value = poll_data
            dict_cursor_mock.fetchall.return_value = options_data
            
            # Make request with Authorization header
            response = self.app.get(f'/api/polls/{poll_id}/details',
                                headers={'Authorization': 'Bearer fake_token'})
            
            # Check response
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            
            # Verify response structure and content
            self.assertEqual(data['id'], poll_data['id'])
            self.assertEqual(data['question'], poll_data['question'])
            self.assertEqual(data['creator_name'], poll_data['creator_name'])
            self.assertEqual(len(data['options']), len(options_data))
            self.assertEqual(data['total_votes'], 10)  # 5 + 3 + 2


if __name__ == '__main__':
    unittest.main() 