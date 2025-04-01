# Poll Application

A full-stack polling application built with Flask and React.

## Features

- User authentication (register/login)
- Create and manage polls
- Share polls via unique links
- Real-time vote tracking
- Responsive design

## Tech Stack

### Backend
- Python 3.9
- Flask
- MySQL
- JWT Authentication

### Frontend
- React
- Material-UI
- Axios
- React Router

## Setup

### Prerequisites
- Python 3.9+
- Node.js 16+
- MySQL 8.0+

### Backend Setup
1. Create a virtual environment:
```bash
cd poll_backend
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up the database:
```bash
python setup_db.py
```

4. Run the server:
```bash
python app.py
```

### Frontend Setup
1. Install dependencies:
```bash
cd poll_frontend
npm install
```

2. Start the development server:
```bash
npm start
```

## Testing

### Backend Tests
```bash
cd poll_backend
python -m pytest tests/
```

### Frontend Tests
```bash
cd poll_frontend
npm test
```

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment. The pipeline includes:

- Code linting (flake8 for Python, ESLint for JavaScript)
- Unit tests for both backend and frontend
- Frontend build verification
- Automated deployment (when configured)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 