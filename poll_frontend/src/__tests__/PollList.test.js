import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PollList from '../PollList';

// Mock fetch globally
global.fetch = jest.fn();

// Create a function to render with all necessary providers
const renderWithAuth = (ui) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </BrowserRouter>
  );
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: () => ({
    getAuthHeaders: () => ({
      'Authorization': 'Bearer fake_token'
    })
  })
}));

describe('PollList Component', () => {
  beforeEach(() => {
    // Reset mock implementations and localStorage
    fetch.mockReset();
    mockNavigate.mockReset();
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'user') {
        return JSON.stringify({ 
          user_id: 1, 
          username: 'testuser', 
          token: 'fake_token' 
        });
      }
      return null;
    });
    
    // Set up mock polls
    const mockPolls = [
      {
        id: 1,
        title: 'Test Poll 1',
        question: 'What is your favorite color?',
        end_date: '2023-12-31',
        share_token: 'abc123'
      },
      {
        id: 2,
        title: 'Test Poll 2',
        question: 'What is your favorite food?',
        end_date: '2023-12-31',
        share_token: 'def456'
      }
    ];
    
    // Mock successful fetch for polls list
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, polls: mockPolls }),
    });
  });

  test('renders loading state initially', async () => {
    renderWithAuth(<PollList />);
    
    // Check for loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  test('renders polls after loading', async () => {
    renderWithAuth(<PollList />);
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if polls are displayed
    expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    expect(screen.getByText('Test Poll 2')).toBeInTheDocument();
    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    expect(screen.getByText('What is your favorite food?')).toBeInTheDocument();
  });

  test('shows empty state when no polls exist', async () => {
    // Override the mock to return empty array
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, polls: [] }),
    });
    
    renderWithAuth(<PollList />);
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for empty state message
    expect(screen.getByText(/you haven't created any polls yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first poll/i)).toBeInTheDocument();
  });

  test('shows error state when fetch fails', async () => {
    // Override the mock to return error
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Failed to fetch polls' }),
    });
    
    renderWithAuth(<PollList />);
    
    // Wait for the error to appear
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for error message
    expect(screen.getByText(/failed to fetch polls/i)).toBeInTheDocument();
  });

  test('deletes a poll successfully', async () => {
    // Setup delete response
    fetch
      // First fetch returns the polls list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          polls: [
            {
              id: 1,
              title: 'Test Poll 1',
              question: 'What is your favorite color?',
              end_date: '2023-12-31',
              share_token: 'abc123'
            }
          ]
        }),
      })
      // Second fetch is the delete request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Poll deleted successfully' }),
      })
      // Third fetch returns empty polls after deletion
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, polls: [] }),
      });
    
    renderWithAuth(<PollList />);
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find and click the delete button for the first poll
    const deleteButtons = screen.getAllByRole('button', { name: /delete poll/i });
    fireEvent.click(deleteButtons[0]);
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/poll deleted successfully/i)).toBeInTheDocument();
    });
  });

  test('copies share link to clipboard', async () => {
    renderWithAuth(<PollList />);
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find and click the share button for the first poll
    const shareButtons = screen.getAllByRole('button', { name: /share poll/i });
    fireEvent.click(shareButtons[0]);
    
    // Check if clipboard.writeText was called with the correct link
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('abc123')
    );
  });

  test('navigates to poll details on view button click', async () => {
    renderWithAuth(<PollList />);
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find and click the view details button for the first poll
    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    fireEvent.click(viewButtons[0]);
    
    // Check navigation
    expect(mockNavigate).toHaveBeenCalledWith('/poll-details/1');
  });
}); 