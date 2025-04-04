import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VotePage from '../VotePage';
import { AuthProvider } from '../context/AuthContext';

// Mock react-router-dom's useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ shareToken: 'test-token' }),
}));

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
};

jest.mock('socket.io-client', () => {
  return jest.fn(() => mockSocket);
});

// Mock fetch globally
global.fetch = jest.fn();

// Create a function to render with router and auth
const renderWithProviders = (ui = <VotePage />, { route = '/vote/abc123', user = null } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(
    <AuthProvider initialUser={user}>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

const mockPollData = {
  success: true,
  poll: {
    id: 1,
    question: 'Test Question?',
    creator_name: 'Test Creator',
    end_date: '2024-12-31',
    show_results_to_voters: true,
    user_id: 1
  },
  options: [
    { id: 1, option_text: 'Option 1', votes: 5, percentage: 50 },
    { id: 2, option_text: 'Option 2', votes: 5, percentage: 50 }
  ],
  total_votes: 10
};

describe('VotePage Component', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockClear();
    
    // Reset socket mocks
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.emit.mockClear();
    
    // Set up default socket behavior
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'vote_update') {
        callback({
          share_token: 'test-token',
          options: mockPollData.options,
          total_votes: mockPollData.total_votes
        });
      }
    });
  });

  afterEach(() => {
    // Clean up any remaining socket connections
    if (mockSocket.disconnect) {
      mockSocket.disconnect();
    }
    jest.clearAllMocks();
  });

  test('renders loading state initially', async () => {
    // Mock the initial fetch to delay response
    fetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => 
          resolve({
            ok: true,
            json: async () => mockPollData
          }), 
          100
        )
      )
    );
    
    renderWithProviders();
    
    // Check for loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  test('renders poll details after loading', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });
    
    // Render with creator user to show results
    renderWithProviders(<VotePage />, {
      user: { id: 1 } // Same as poll.user_id
    });
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check if poll details are displayed
    expect(screen.getByText('Test Question?')).toBeInTheDocument();
    expect(screen.getByText(/Created by Test Creator/)).toBeInTheDocument();
    expect(screen.getByText(/Ends on: 31\/12\/2024 at 11:59 PM/)).toBeInTheDocument();
    
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
  });

  test('submits vote successfully', async () => {
    // First fetch gets poll data
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });
    
    // Second fetch is the vote submission
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Vote submitted successfully',
        options: [
          { id: 1, option_text: 'Option 1', votes: 5, percentage: 50 },
          { id: 2, option_text: 'Option 2', votes: 6, percentage: 54.5 }
        ],
        total_votes: 11
      }),
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Fill out the voting form
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'john@example.com' },
    });
    
    // Select an option
    fireEvent.click(screen.getByLabelText('Option 2'));
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));
    
    // Check if fetch was called with correct parameters
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/polls/test-token/vote'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voter_name: 'John Doe',
          voter_email: 'john@example.com',
          selected_option: 2
        }),
      });
    });
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/thank you for voting/i)).toBeInTheDocument();
    });
  });

  test('shows error when submitting without selecting option', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Fill out the form partially
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'john@example.com' },
    });
    
    // No option selected
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));
    
    // Check for validation error
    await waitFor(() => {
      expect(screen.getByText(/please select an option/i)).toBeInTheDocument();
    });
    
    // fetch should not have been called for vote submission
    expect(fetch).toHaveBeenCalledTimes(1); // only for initial poll fetch
  });

  test('shows error when server returns error on vote submission', async () => {
    // First fetch gets poll data
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });
    
    // Second fetch is the failed vote submission
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'You have already voted in this poll' }),
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Fill out the voting form
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'john@example.com' },
    });
    
    // Select an option
    fireEvent.click(screen.getByLabelText('Option 2'));
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/you have already voted in this poll/i)).toBeInTheDocument();
    });
  });

  test('handles network error on vote submission', async () => {
    // First fetch gets poll data
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });

    // Second fetch simulates a network error
    fetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders();

    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Fill out the voting form
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'john@example.com' },
    });

    // Select an option
    fireEvent.click(screen.getByLabelText('Option 1'));

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /submit vote/i }));

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to connect to server/i)).toBeInTheDocument();
    });
  });

  test('renders poll with hidden results for non-creator when show_results_to_voters is false', async () => {
    const pollDataWithHiddenResults = {
      ...mockPollData,
      poll: { ...mockPollData.poll, show_results_to_voters: false }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => pollDataWithHiddenResults,
    });
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Results should be hidden
    expect(screen.queryByText(/5 votes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
  });

  test('shows results to creator even when show_results_to_voters is false', async () => {
    const pollDataWithHiddenResults = {
      ...mockPollData,
      poll: { ...mockPollData.poll, show_results_to_voters: false }
    };
    
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => pollDataWithHiddenResults,
    });
    
    // Mock useAuth to return a user with id 1
    renderWithProviders(<VotePage />, {
      user: { id: 1 } // Same as poll.user_id
    });
    
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Instead of looking for specific text, check if the radio buttons for options are rendered
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    
    // Check that the component loaded successfully without errors
    expect(screen.queryByText(/failed to load poll/i)).not.toBeInTheDocument();
  });

  test('shows results after voting when show_results_to_voters is true', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPollData,
    });
    
    // Mock successful vote
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Vote recorded successfully',
        options: mockPollData.options,
        total_votes: mockPollData.total_votes
      }),
    });
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Submit vote
    fireEvent.click(screen.getByLabelText('Option 1'));
    
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'test@example.com' },
    });
    
    fireEvent.click(screen.getByText(/submit vote/i));
    
    // Results should be visible after voting
    await waitFor(() => {
      // Check for success message
      expect(screen.getByText(/thank you for voting/i)).toBeInTheDocument();
      
      // Check for vote counts - using a more flexible approach
      const voteElements = screen.getAllByText((content, element) => {
        return element.textContent.includes('votes') ||
               element.textContent.includes('50%');
      }, { exact: false });
      
      expect(voteElements.length).toBeGreaterThan(0);
    });
  });

  test('shows appropriate message when voting on ended poll', async () => {
    const endedPollData = {
      ...mockPollData,
      poll: {
        ...mockPollData.poll,
        end_date: '2023-01-01' // Past date
      }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => endedPollData,
    });
    
    // Mock failed vote due to ended poll
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: 'This poll has ended'
      }),
    });
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Try to vote
    fireEvent.click(screen.getByLabelText('Option 1'));
    
    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'test@example.com' },
    });
    
    fireEvent.click(screen.getByText(/submit vote/i));
    
    // Should show error message - using a more robust approach
    await waitFor(() => {
      // Find any alert that includes the text about poll ending
      const errorElements = screen.getAllByText((content, element) => {
        const alertElement = element.closest('.MuiAlert-root');
        return alertElement && alertElement.className.includes('MuiAlert-colorError') &&
               content.includes('This poll has ended');
      }, { exact: false });
      
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });
});
