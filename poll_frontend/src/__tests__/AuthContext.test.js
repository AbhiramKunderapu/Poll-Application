import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Create a test component that uses the AuthContext
const TestComponent = () => {
  const { user, login, logout, getAuthHeaders } = useAuth();
  
  return (
    <div>
      <h1>Auth Test</h1>
      {user ? (
        <>
          <p data-testid="user-info">User: {user.username}</p>
          <p data-testid="auth-headers">{JSON.stringify(getAuthHeaders())}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <p data-testid="no-user">No user logged in</p>
          <p data-testid="auth-headers">{JSON.stringify(getAuthHeaders())}</p>
          <button 
            onClick={() => login({ 
              id: 1, 
              username: 'testuser' 
            }, 'fake_token')}>
            Login
          </button>
        </>
      )}
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Reset mock implementations
    localStorage.getItem.mockReset();
    localStorage.setItem.mockReset();
    localStorage.removeItem.mockReset();
  });
  
  test('provides initial state with no user', () => {
    // Mock localStorage to return null (no user)
    localStorage.getItem.mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check initial state
    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    expect(screen.getByTestId('auth-headers')).toHaveTextContent('{"Content-Type":"application/json"}');
  });
  
  test('loads user from localStorage on mount', () => {
    // Mock localStorage to return a user and token
    const user = { id: 1, username: 'testuser' };
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'user') {
        return JSON.stringify(user);
      }
      if (key === 'token') {
        return 'fake_token';
      }
      return null;
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check that user is loaded
    expect(screen.getByTestId('user-info')).toHaveTextContent('User: testuser');
    expect(screen.getByTestId('auth-headers')).toHaveTextContent('Authorization');
    expect(screen.getByTestId('auth-headers')).toHaveTextContent('Bearer fake_token');
  });
  
  test('login updates state and localStorage', async () => {
    // Mock localStorage to return null initially
    localStorage.getItem.mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check initial state
    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    
    // Click login button
    fireEvent.click(screen.getByText('Login'));
    
    // Check that user is logged in
    expect(screen.getByTestId('user-info')).toHaveTextContent('User: testuser');
    
    // Check that localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ id: 1, username: 'testuser' })
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'token',
      'fake_token'
    );
  });
  
  test('logout clears state and localStorage', async () => {
    // Mock localStorage to return a user and token
    const user = { id: 1, username: 'testuser' };
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'user') {
        return JSON.stringify(user);
      }
      if (key === 'token') {
        return 'fake_token';
      }
      return null;
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check that user is loaded
    expect(screen.getByTestId('user-info')).toHaveTextContent('User: testuser');
    
    // Click logout button
    fireEvent.click(screen.getByText('Logout'));
    
    // Check that user is logged out
    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    
    // Check that localStorage was cleared
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });
  
  test('getAuthHeaders returns correct headers when user is logged in', () => {
    // Mock localStorage to return a token
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'token') {
        return 'fake_token';
      }
      return null;
    });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check auth headers
    const headers = screen.getByTestId('auth-headers');
    expect(headers).toHaveTextContent('"Content-Type":"application/json"');
    expect(headers).toHaveTextContent('"Authorization":"Bearer fake_token"');
  });
  
  test('getAuthHeaders returns object without Authorization when no token exists', () => {
    // Mock localStorage to return null for token
    localStorage.getItem.mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Check auth headers
    const headers = screen.getByTestId('auth-headers');
    expect(headers).toHaveTextContent('{"Content-Type":"application/json"}');
    expect(headers).not.toHaveTextContent('Authorization');
  });
  
  test('throws error when useAuth is used outside of AuthProvider', () => {
    // Suppress console.error for this test
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Define a test component that uses useAuth directly
    const ErrorComponent = () => {
      const { user } = useAuth();
      return <div>{user ? 'User' : 'No user'}</div>;
    };
    
    // Expect render to throw an error
    expect(() => {
      render(<ErrorComponent />);
    }).toThrow();
    
    // Restore console.error
    console.error = originalConsoleError;
  });
}); 