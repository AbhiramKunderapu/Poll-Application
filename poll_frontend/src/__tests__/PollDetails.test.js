// Create a mock socket instance that will be used throughout the tests
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
  emit: jest.fn(),
};

// Mock socket.io-client before any imports
jest.mock('socket.io-client', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockSocket),
    connect: jest.fn(() => mockSocket)
  };
});

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PollDetails from '../components/PollDetails';
import { AuthProvider } from '../context/AuthContext';
import io from 'socket.io-client';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ pollId: '1' }),
  useNavigate: () => mockNavigate,
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: () => ({
    getAuthHeaders: () => ({
      'Authorization': 'Bearer fake_token'
    })
  })
}));

describe('PollDetails Component', () => {
  const mockPollData = {
    id: 1,
    question: 'What is your favorite color?',
    created_at: '2023-01-01T12:00:00Z',
    total_votes: 10,
    options: [
      { id: 1, option_text: 'Red', votes: 5 },
      { id: 2, option_text: 'Blue', votes: 3 },
      { id: 3, option_text: 'Green', votes: 2 }
    ]
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    fetch.mockReset();
    mockNavigate.mockReset();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.disconnect.mockReset();
    mockSocket.emit.mockReset();
    
    // Reset socket state
    mockSocket.connected = true;
    
    // Reset io mock implementation
    io.mockImplementation(() => mockSocket);

    // Setup default fetch mock
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPollData)
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', async () => {
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders poll details after loading', async () => {
    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    // Wait for the poll question to appear
    await waitFor(() => {
      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    });

    // Check if all poll details are displayed
    expect(screen.getByText('Total Votes: 10')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText(/5 votes/)).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText(/3 votes/)).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText(/2 votes/)).toBeInTheDocument();

    // Verify socket connection was established
    expect(io).toHaveBeenCalledWith('http://localhost:5000');
    expect(mockSocket.on).toHaveBeenCalledWith('vote_update', expect.any(Function));
  });

  test('handles socket updates correctly', async () => {
    // Render component
    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    // Wait for initial render and socket setup
    await waitFor(() => {
      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
      expect(io).toHaveBeenCalledWith('http://localhost:5000');
      expect(mockSocket.on).toHaveBeenCalledWith('vote_update', expect.any(Function));
    });

    // Get the socket update callback
    const voteUpdateCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'vote_update'
    )[1];

    // Simulate vote update
    const updatedData = {
      poll_id: 1,
      options: [
        { id: 1, option_text: 'Red', votes: 6 },
        { id: 2, option_text: 'Blue', votes: 3 },
        { id: 3, option_text: 'Green', votes: 2 }
      ],
      total_votes: 11
    };

    // Trigger the update
    act(() => {
      voteUpdateCallback(updatedData);
    });

    // Wait for and verify the updates
    await waitFor(() => {
      // Verify total votes
      const totalVotes = screen.getByText((content) => {
        return content.includes('Total Votes') && content.includes('11');
      });
      expect(totalVotes).toBeInTheDocument();
    });

    // Verify individual options
    await waitFor(() => {
      // Red option
      const redBox = screen.getByText('Red').closest('div');
      expect(redBox).toHaveTextContent(/6 votes/);
      expect(redBox).toHaveTextContent(/54\.5%/);

      // Blue option
      const blueBox = screen.getByText('Blue').closest('div');
      expect(blueBox).toHaveTextContent(/3 votes/);
      expect(blueBox).toHaveTextContent(/27\.3%/);

      // Green option
      const greenBox = screen.getByText('Green').closest('div');
      expect(greenBox).toHaveTextContent(/2 votes/);
      expect(greenBox).toHaveTextContent(/18\.2%/);
    });

    // Verify progress bars
    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3);

      // Get progress bar values
      const values = progressBars.map(bar => 
        parseFloat(bar.getAttribute('aria-valuenow'))
      );

      // Log the actual values for debugging
      console.log('Actual progress bar values:', values);
      
      // Check that we have valid numbers
      values.forEach(value => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
      
      // Check that the values sum to approximately 100%
      const sum = values.reduce((acc, val) => acc + val, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(1);
    });
  });

  test('handles error state correctly', async () => {
    const errorMessage = 'Failed to load poll details';
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: errorMessage }),
    });

    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Check if back button is present in error state
    const backButton = screen.getByText('Back to Polls');
    expect(backButton).toBeInTheDocument();

    // Test navigation on back button click
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/polls');
  });

  test('handles network error correctly', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });
  });

  test('cleans up socket connection on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    // Wait for component to mount and setup socket
    await waitFor(() => {
      expect(io).toHaveBeenCalledWith('http://localhost:5000');
      expect(mockSocket.on).toHaveBeenCalled();
    });

    // Unmount the component
    unmount();
    
    // Verify cleanup
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test('handles back button navigation', async () => {
    render(
      <AuthProvider>
        <PollDetails />
      </AuthProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByText('Back to Polls');
    fireEvent.click(backButton);

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith('/polls');
  });
});