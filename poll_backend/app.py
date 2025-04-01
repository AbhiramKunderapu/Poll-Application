import os
import jwt
import mysql.connector
from flask import Flask, request, jsonify
from flask_cors import CORS
import secrets
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
app.config['SECRET_KEY'] = 'your-secret-key'

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'abhi20062010',
    'database': 'poll_app',
    'auth_plugin': 'mysql_native_password',
    'use_pure': True
}

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except mysql.connector.Error as err:
        print(f"Error connecting to database: {err}")
        raise

# Test database connection on startup
try:
    connection = get_db_connection()
    print("Successfully connected to database!")
    connection.close()
except Exception as e:
    print(f"Failed to connect to database: {e}")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            token = token.split(' ')[1]  # Remove 'Bearer ' prefix
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['user_id']
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'message': 'Missing required fields'}), 400

    connection = get_db_connection()
    cursor = connection.cursor()
    try:
        hashed_password = generate_password_hash(password)
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
                      (username, email, hashed_password))
        connection.commit()
        
        # Get the user ID for the token
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_id = cursor.fetchone()[0]
        
        # Generate token
        token = jwt.encode({
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user_id': user_id,
            'username': username
        }), 201
    except mysql.connector.Error as err:
        if err.errno == 1062:  # Duplicate entry error
            return jsonify({'message': 'Username or email already exists'}), 409
        return jsonify({'message': 'Registration failed'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if user and check_password_hash(user['password_hash'], password):
            token = jwt.encode({
                'user_id': user['id'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
            }, app.config['SECRET_KEY'])
            return jsonify({
                'token': token,
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email']
                }
            })

        return jsonify({'message': 'Invalid credentials'}), 401
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'message': 'An error occurred during login'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/create_poll', methods=['POST'])
@token_required
def create_poll(current_user_id):
    data = request.json
    question = data.get('question')
    options = data.get('options', [])

    if not question or not options:
        return jsonify({'message': 'Missing required fields'}), 400

    connection = get_db_connection()
    cursor = connection.cursor()
    share_token = secrets.token_urlsafe(32)
    
    try:
        cursor.execute("INSERT INTO polls (question, user_id, share_token) VALUES (%s, %s, %s)",
                      (question, current_user_id, share_token))
        poll_id = cursor.lastrowid

        for option in options:
            cursor.execute("INSERT INTO options (poll_id, option_text) VALUES (%s, %s)",
                          (poll_id, option))

        connection.commit()
        
        return jsonify({
            "poll_id": poll_id,
            "share_token": share_token,
            "share_url": f"/poll/{share_token}"
        }), 201
    except Exception as e:
        connection.rollback()
        return jsonify({'message': 'Failed to create poll'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/polls', methods=['GET'])
@token_required
def get_all_polls(current_user_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT p.*, COUNT(o.id) as option_count, SUM(o.votes) as total_votes 
            FROM polls p 
            LEFT JOIN options o ON p.id = o.poll_id 
            WHERE p.user_id = %s 
            GROUP BY p.id
            ORDER BY p.created_at DESC
        """, (current_user_id,))
        polls = cursor.fetchall()
        return jsonify(polls)
    except Exception as e:
        return jsonify({'message': 'Failed to fetch polls'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/poll/<string:share_token>', methods=['GET'])
def get_poll_by_token(share_token):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        # Get poll details with total votes
        cursor.execute("""
            SELECT p.*, u.username as creator_name,
                   COUNT(DISTINCT v.id) as total_votes
            FROM polls p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN votes v ON p.id = v.poll_id
            WHERE p.share_token = %s
            GROUP BY p.id
        """, (share_token,))
        poll = cursor.fetchone()

        if not poll:
            return jsonify({"message": "Poll not found"}), 404

        # Get options with vote counts
        cursor.execute("""
            SELECT o.id, o.option_text, o.votes,
                   COUNT(v.id) as vote_count
            FROM options o
            LEFT JOIN votes v ON o.id = v.option_id
            WHERE o.poll_id = %s
            GROUP BY o.id, o.option_text, o.votes
        """, (poll['id'],))
        options = cursor.fetchall()

        # Calculate percentages
        total_votes = sum(option['vote_count'] for option in options)
        for option in options:
            option['percentage'] = round((option['vote_count'] / total_votes * 100) if total_votes > 0 else 0, 1)

        return jsonify({
            "poll": poll,
            "options": options,
            "total_votes": total_votes
        })
    except Exception as e:
        return jsonify({"message": "Failed to fetch poll data"}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/poll_details/<int:poll_id>', methods=['GET'])
@token_required
def get_poll_details(current_user_id, poll_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    
    try:
        # Get poll details
        cursor.execute("""
            SELECT p.*, u.username as creator_name 
            FROM polls p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.id = %s AND p.user_id = %s
        """, (poll_id, current_user_id))
        
        poll = cursor.fetchone()
        if not poll:
            return jsonify({'message': 'Poll not found'}), 404
            
        # Get options with vote counts
        cursor.execute("""
            SELECT o.id, o.option_text, COUNT(v.id) as votes
            FROM options o
            LEFT JOIN votes v ON o.id = v.option_id
            WHERE o.poll_id = %s
            GROUP BY o.id, o.option_text
        """, (poll_id,))
        
        options = cursor.fetchall()
        
        # Calculate total votes
        total_votes = sum(option['votes'] for option in options)
        
        return jsonify({
            'id': poll['id'],
            'question': poll['question'],
            'creator_name': poll['creator_name'],
            'created_at': poll['created_at'].isoformat(),
            'options': options,
            'total_votes': total_votes
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/vote/<string:share_token>', methods=['POST'])
def submit_vote(share_token):
    data = request.json
    option_id = data.get('option_id')
    voter_name = data.get('voter_name')
    voter_email = data.get('voter_email')
    ip_address = request.remote_addr

    if not all([option_id, voter_name, voter_email]):
        return jsonify({"message": "Missing required fields"}), 400

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    
    # Get poll_id from share_token
    cursor.execute("SELECT id FROM polls WHERE share_token = %s", (share_token,))
    poll = cursor.fetchone()
    if not poll:
        cursor.close()
        connection.close()
        return jsonify({"message": "Poll not found"}), 404

    poll_id = poll['id']

    try:
        # Check if user has already voted
        cursor.execute("""
            SELECT id FROM votes 
            WHERE poll_id = %s AND voter_email = %s
        """, (poll_id, voter_email))
        if cursor.fetchone():
            return jsonify({"message": "You have already voted on this poll"}), 400

        # Record the vote
        cursor.execute("""
            INSERT INTO votes (poll_id, option_id, voter_name, voter_email, ip_address)
            VALUES (%s, %s, %s, %s, %s)
        """, (poll_id, option_id, voter_name, voter_email, ip_address))

        # Update the vote count
        cursor.execute("UPDATE options SET votes = votes + 1 WHERE id = %s", (option_id,))
        
        connection.commit()

        # Get updated poll data
        cursor.execute("""
            SELECT o.id, o.option_text, o.votes,
                   COUNT(v.id) as vote_count
            FROM options o
            LEFT JOIN votes v ON o.id = v.option_id
            WHERE o.poll_id = %s
            GROUP BY o.id, o.option_text, o.votes
        """, (poll_id,))
        updated_options = cursor.fetchall()

        return jsonify({"message": "Vote recorded successfully", "options": updated_options})
    except Exception as e:
        connection.rollback()
        return jsonify({"message": "Failed to record vote"}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/delete_poll/<int:poll_id>', methods=['DELETE'])
@token_required
def delete_poll(current_user_id, poll_id):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    # Verify poll ownership
    cursor.execute("SELECT user_id FROM polls WHERE id = %s", (poll_id,))
    poll = cursor.fetchone()
    if not poll or poll[0] != current_user_id:
        cursor.close()
        connection.close()
        return jsonify({"message": "Unauthorized or poll not found"}), 403

    try:
        # Delete votes first
        cursor.execute("DELETE FROM votes WHERE poll_id = %s", (poll_id,))
        # Delete options
        cursor.execute("DELETE FROM options WHERE poll_id = %s", (poll_id,))
        # Delete the poll
        cursor.execute("DELETE FROM polls WHERE id = %s", (poll_id,))
        connection.commit()
        return jsonify({"message": "Poll deleted successfully"})
    except Exception as e:
        connection.rollback()
        return jsonify({"message": "Failed to delete poll"}), 500
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(debug=True)
