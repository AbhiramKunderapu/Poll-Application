import mysql.connector
from mysql.connector import errorcode

# Database configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'abhi20062010',
    'auth_plugin': 'mysql_native_password',
    'raise_on_warnings': True,
    'use_pure': True
}

def setup_database():
    try:
        # Connect to MySQL server
        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Create database if it doesn't exist
        cursor.execute(
            "CREATE DATABASE IF NOT EXISTS poll_app DEFAULT CHARACTER SET 'utf8'"
        )
        print("Database 'poll_app' created successfully!")

        # Switch to poll_app database
        cursor.execute("USE poll_app")

        # Create tables
        tables = {}
        tables['users'] = (
            "CREATE TABLE IF NOT EXISTS users ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  username VARCHAR(255) NOT NULL UNIQUE,"
            "  email VARCHAR(255) NOT NULL UNIQUE,"
            "  password_hash VARCHAR(255) NOT NULL,"
            "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ")"
        )

        tables['polls'] = (
            "CREATE TABLE IF NOT EXISTS polls ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  question TEXT NOT NULL,"
            "  user_id INT NOT NULL,"
            "  share_token VARCHAR(255) NOT NULL UNIQUE,"
            "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
            "  FOREIGN KEY (user_id) REFERENCES users(id)"
            ")"
        )

        tables['options'] = (
            "CREATE TABLE IF NOT EXISTS options ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  poll_id INT NOT NULL,"
            "  option_text TEXT NOT NULL,"
            "  votes INT DEFAULT 0,"
            "  FOREIGN KEY (poll_id) REFERENCES polls(id)"
            ")"
        )

        tables['votes'] = (
            "CREATE TABLE IF NOT EXISTS votes ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  poll_id INT NOT NULL,"
            "  option_id INT NOT NULL,"
            "  voter_name VARCHAR(255) NOT NULL,"
            "  voter_email VARCHAR(255) NOT NULL,"
            "  ip_address VARCHAR(45),"
            "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
            "  FOREIGN KEY (poll_id) REFERENCES polls(id),"
            "  FOREIGN KEY (option_id) REFERENCES options(id)"
            ")"
        )

        for table_name in tables:
            table_description = tables[table_name]
            try:
                print(f"Creating table {table_name}: ", end='')
                cursor.execute(table_description)
                print("OK")
            except mysql.connector.Error as err:
                if err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
                    print("already exists")
                else:
                    print(err.msg)

    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            print("Something is wrong with your user name or password")
        elif err.errno == errorcode.ER_BAD_DB_ERROR:
            print("Database does not exist")
        else:
            print(err)
    else:
        print("Database setup completed successfully!")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

if __name__ == "__main__":
    setup_database() 