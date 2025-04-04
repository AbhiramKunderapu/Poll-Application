import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import PollView from '../components/PollView';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
}));

jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    disconnect: jest.fn(),
  };
  return jest.fn(() => mockSocket);
});

// Global mocks for fetch
global.fetch = jest.fn();

describe('PollView Component', () => {
  // Mock data
  const mockPoll = {
    id: '123',
    question: 'Test Question',
    creator_name: 'Test Creator',
  };
  
  const mockOptions = [
    { id: 1, option_text: 'Option 1', vote_count: 5, percentage: 50 },
    { id: 2, option_text: 'Option 2', vote_count: 5, percentage: 50 },
  ];

  const shareToken = 'test-share-token';
  const mockSocket = { on: jest.fn(), disconnect: jest.fn() };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    useParams.mockReturnValue({ shareToken });
    
    global.fetch.mockImplementation((url) => {
      if (url === `http://localhost:5000/api/polls/${shareToken}`) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            poll: mockPoll,
            options: mockOptions,
            total_votes: 10
          })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Not found' })
      });
    });
    
    io.mockReturnValue(mockSocket);
  });

  test('renders loading state initially', () => {
    render(<PollView />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays poll data when fetch is successful', async () => {
    render(<PollView />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Question')).toBeInTheDocument();
      expect(screen.getByText('Created by Test Creator')).toBeInTheDocument();
      expect(screen.getByText('Total Votes: 10')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });

  test('displays error when poll fetch fails', async () => {
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Poll not found' })
      })
    );
    
    render(<PollView />);
    
    await waitFor(() => {
      expect(screen.getByText('Poll not found')).toBeInTheDocument();
    });
  });

  test('handles network error during vote submission', async () => {
    // Setup for initial load
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          poll: mockPoll, 
          options: mockOptions,
          total_votes: 10
        })
      })
    );
    
    // Mock network failure on vote submission
    global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
    
    render(<PollView />);
    
    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByText('Test Question')).toBeInTheDocument();
    });
    
    // Select an option and fill in form
    fireEvent.click(screen.getByLabelText('Option 1'));
    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    
    // Submit form and expect error to appear
    await act(async () => {
      fireEvent.click(screen.getByText('Submit Vote'));
      // Allow some time for the error to appear
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
  });

  test('selects an option when radio button is clicked', async () => {
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByText('Option 1')).toBeInTheDocument());
    
    const option1Radio = screen.getByLabelText('Option 1');
    fireEvent.click(option1Radio);
    
    expect(option1Radio).toBeChecked();
  });

  test('updates form fields when user inputs data', async () => {
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument());
    
    const nameInput = screen.getByLabelText(/Your Name/i);
    const emailInput = screen.getByLabelText(/Your Email/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    expect(nameInput.value).toBe('Test User');
    expect(emailInput.value).toBe('test@example.com');
  });

  test('shows error when trying to submit without selecting an option', async () => {
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByText('Submit Vote')).toBeInTheDocument());
    
    // Fill in required fields but don't select an option
    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Vote'));
    
    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });

  test('successfully submits a vote', async () => {
    // Mock successful vote submission
    global.fetch.mockImplementation((url, options) => {
      if (url === `http://localhost:5000/api/polls/${shareToken}/vote`) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            options: [
              { id: 1, option_text: 'Option 1', vote_count: 6, percentage: 55 },
              { id: 2, option_text: 'Option 2', vote_count: 5, percentage: 45 },
            ]
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          poll: mockPoll,
          options: mockOptions,
          total_votes: 10
        })
      });
    });
    
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByLabelText('Option 1')).toBeInTheDocument());
    
    // Select an option and fill in form
    fireEvent.click(screen.getByLabelText('Option 1'));
    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Vote'));
    
    await waitFor(() => {
      // Check that results view is displayed
      expect(screen.getByText('6 votes (55%)')).toBeInTheDocument();
    });
  });

  test('handles error during vote submission', async () => {
    // Mock failed vote submission
    global.fetch.mockImplementation((url, options) => {
      if (url === `http://localhost:5000/api/polls/${shareToken}/vote`) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'You have already voted' })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          poll: mockPoll,
          options: mockOptions,
          total_votes: 10
        })
      });
    });
    
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByLabelText('Option 1')).toBeInTheDocument());
    
    // Select an option and fill in form
    fireEvent.click(screen.getByLabelText('Option 1'));
    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Vote'));
    
    await waitFor(() => {
      expect(screen.getByText('You have already voted')).toBeInTheDocument();
    });
  });

  test('handles network error during vote submission', async () => {
    // Setup for initial load
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          poll: mockPoll, 
          options: mockOptions,
          total_votes: 10
        })
      })
    );
    
    // Mock network failure on vote submission
    global.fetch.mockImplementationOnce(() => Promise.reject('Network error'));
    
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByLabelText('Option 1')).toBeInTheDocument());
    
    // Select an option and fill in form
    fireEvent.click(screen.getByLabelText('Option 1'));
    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Vote'));
    
    await waitFor(() => {
      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });
  });

  test('updates options when socket receives vote_update event', async () => {
    render(<PollView />);
    
    await waitFor(() => expect(screen.getByText('Test Question')).toBeInTheDocument());
    
    // Simulate socket update
    const mockSocketCallback = mockSocket.on.mock.calls.find(call => call[0] === 'vote_update')[1];
    
    act(() => {
      mockSocketCallback({
        share_token: shareToken,
        options: [
          { id: 1, option_text: 'Option 1', vote_count: 7, percentage: 70 },
          { id: 2, option_text: 'Option 2', vote_count: 3, percentage: 30 },
        ]
      });
    });
    
    // Verify that poll data was updated
    await waitFor(() => {
      expect(screen.getByText('Total Votes: 10')).toBeInTheDocument();
    });
  });

  test('disconnects socket on unmount', async () => {
    const { unmount } = render(<PollView />);
    
    await waitFor(() => expect(screen.getByText('Test Question')).toBeInTheDocument());
    
    unmount();
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});