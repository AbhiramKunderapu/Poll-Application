import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navbar from '../components/Navbar';
import { AuthProvider } from '../context/AuthContext';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// Mock AuthContext for different user states
jest.mock('../context/AuthContext', () => {
  const originalModule = jest.requireActual('../context/AuthContext');
  
  return {
    ...originalModule,
    useAuth: jest.fn(),
  };
});

describe('Navbar Component', () => {
  const renderWithAuth = (ui) => {
    return render(
      <AuthProvider>
        {ui}
      </AuthProvider>
    );
  };

  test('renders navbar with app title', () => {
    // Set up mock to return no user (logged out)
    const { useAuth } = require('../context/AuthContext');
    useAuth.mockReturnValue({
      user: null,
      logout: jest.fn()
    });
    
    renderWithAuth(<Navbar />);
    
    // Check for app title
    expect(screen.getByText(/poll app/i)).toBeInTheDocument();
  });

  test('renders login and register links when user is not logged in', () => {
    // Set up mock to return no user (logged out)
    const { useAuth } = require('../context/AuthContext');
    useAuth.mockReturnValue({
      user: null,
      logout: jest.fn()
    });
    
    renderWithAuth(<Navbar />);
    
    // Check for login and register links
    expect(screen.getByText(/login/i)).toBeInTheDocument();
    expect(screen.getByText(/register/i)).toBeInTheDocument();
    
    // Should not show logged-in content
    expect(screen.queryByText(/my polls/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create poll/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/logout/i)).not.toBeInTheDocument();
  });

  test('renders my polls, create poll and logout when user is logged in', () => {
    // Set up mock to return a logged in user
    const mockLogout = jest.fn();
    const { useAuth } = require('../context/AuthContext');
    useAuth.mockReturnValue({
      user: { id: 1, username: 'testuser' },
      logout: mockLogout
    });
    
    renderWithAuth(<Navbar />);
    
    // Check for logged-in menu items
    expect(screen.getByText(/my polls/i)).toBeInTheDocument();
    expect(screen.getByText(/create poll/i)).toBeInTheDocument();
    expect(screen.getByText(/logout/i)).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();
    
    // Should not show login or register
    expect(screen.queryByText(/^login$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^register$/i)).not.toBeInTheDocument();
  });

  test('calls logout and navigates when logout is clicked', () => {
    // Set up mock to return a logged in user
    const mockLogout = jest.fn();
    const { useAuth } = require('../context/AuthContext');
    useAuth.mockReturnValue({
      user: { id: 1, username: 'testuser' },
      logout: mockLogout
    });
    
    renderWithAuth(<Navbar />);
    
    // Click logout button
    fireEvent.click(screen.getByText(/logout/i));
    
    // Check if logout and navigate were called
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
}); 