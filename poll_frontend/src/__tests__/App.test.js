import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';

// Mock react-router-dom
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ children }) => <div>{children}</div>,
    Link: ({ children }) => <a>{children}</a>,
    Navigate: () => null,
    Outlet: () => null,
  };
});

// Mock fetch globally
global.fetch = jest.fn();

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: () => ({
    isAuthenticated: true,
    user: { username: 'testuser' },
    logout: jest.fn(),
    getAuthHeaders: () => ({
      'Authorization': 'Bearer fake_token'
    })
  })
}));

// Mock the Router context
jest.mock('react-router', () => {
  const originalModule = jest.requireActual('react-router');
  return {
    ...originalModule,
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  };
});

describe('App Component', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    fetch.mockReset();
    
    // Setup default fetch mock
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders app without crashing', () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    expect(screen.getByText(/Poll App/i)).toBeInTheDocument();
  });

  test('renders navigation links when authenticated', () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    
    // Check for navigation links based on the actual rendered content
    expect(screen.getByText(/Poll App/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Poll/i)).toBeInTheDocument();
    expect(screen.getByText(/My Polls/i)).toBeInTheDocument();
    expect(screen.getByText(/Logout/i)).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();
  });

  test('handles logout correctly', async () => {
    const mockLogout = jest.fn();
    jest.spyOn(require('../context/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: true,
      user: { username: 'testuser' },
      logout: mockLogout,
      getAuthHeaders: () => ({
        'Authorization': 'Bearer fake_token'
      })
    }));

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    
    // Click logout button
    const logoutButton = screen.getByText(/Logout/i);
    fireEvent.click(logoutButton);
    
    // Verify logout function was called
    expect(mockLogout).toHaveBeenCalled();
  });

  test('renders login/register links when not authenticated', () => {
    // Mock unauthenticated state
    jest.spyOn(require('../context/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: false,
      user: null,
      logout: jest.fn(),
      getAuthHeaders: () => ({})
    }));

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
    
    // Check for login/register links based on the actual rendered content
    expect(screen.getByText(/Poll App/i)).toBeInTheDocument();
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
    expect(screen.getByText(/Register/i)).toBeInTheDocument();
  });
});