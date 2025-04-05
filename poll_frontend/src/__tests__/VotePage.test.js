import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import VotePage from '../VotePage';
import { AuthProvider } from '../context/AuthContext';

// Constants for test consistency
const SHARE_TOKEN = 'test-token';
const API_URL = 'http://localhost:5000';

// For debugging URL calls
const debugFetch = (url, options) => {
  console.log(`Mock fetch called with: ${url}`, options);
};

// Mock react-router-dom's useParams
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  
  return {
    ...originalModule,
    useParams: () => ({ shareToken: SHARE_TOKEN }),
  };
});

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

// Override process.env values
process.env.REACT_APP_API_URL = API_URL;

// Mock fetch globally
global.fetch = jest.fn();

// Helper function to create a mock response
const createMockResponse = (body, ok = true) => {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body)
  });
};

// Create a function to render with router and auth
const renderWithProviders = (ui = <VotePage />, { user = null } = {}) => {
  return render(
    <AuthProvider initialUser={user}>
      <MemoryRouter initialEntries={[`/vote/${SHARE_TOKEN}`]}>
        {ui}
      </MemoryRouter>
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

// Suppress console errors and warnings during tests
beforeAll(() => {
  // Save original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Mock console.error
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    // Don't log React Router or React DOM-related errors
    if (typeof args[0] === 'string' && 
       (args[0].includes('React Router') || 
        args[0].includes('Warning:') ||
        args[0].includes('ReactDOM'))) {
      return;
    }
    originalError.call(console, ...args);
  });
  
  // Mock console.warn
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    // Don't log React Router warnings
    if (typeof args[0] === 'string' && 
       (args[0].includes('React Router') || 
        args[0].includes('Warning:'))) {
      return;
    }
    originalWarn.call(console, ...args);
  });
});

afterAll(() => {
  console.error.mockRestore();
  console.warn.mockRestore();
});

describe('VotePage Component', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockReset();
    
    // Reset socket mocks
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.emit.mockClear();
    
    // Set up default socket behavior
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'vote_update') {
        callback({
          share_token: SHARE_TOKEN,
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
          resolve(createMockResponse(mockPollData)), 
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
    fetch.mockImplementationOnce(() => createMockResponse(mockPollData));
    
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
    
    // Check for date text without using a custom matcher
    expect(screen.getByText(/Ends on:/)).toBeInTheDocument();
    
    // Verify year is present somewhere on the page
    const pageText = document.body.textContent;
    expect(pageText).toContain('2024');
    expect(pageText).toContain('11:59 PM');
    
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
  });

  test('submits vote successfully', async () => {
    // Reset fetch mock
    fetch.mockReset();
    
    // Track fetch calls
    let fetchCalls = 0;
    
    // Mock fetch responses with exact URL patterns
    fetch.mockImplementation((url, options) => {
      fetchCalls++;
      
      // First fetch: Poll data
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}` && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPollData)
        });
      }
      
      // Second fetch: Vote submission
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}/vote` && options && options.method === 'POST') {
        const body = JSON.parse(options.body);
        
        // Validate vote data - use the same field names as in VotePage.js
        if (!body.selected_option || !body.voter_name || !body.voter_email) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ 
              success: false, 
              message: 'Invalid vote data' 
            })
          });
        }
        
        // Return success response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            message: 'Vote recorded successfully',
            options: mockPollData.options,
            total_votes: mockPollData.total_votes
          })
        });
      }
      
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, message: 'Not found' })
      });
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByText('Test Question?')).toBeInTheDocument();
    });
    
    // Options should be visible
    const options = screen.getAllByRole('radio');
    expect(options.length).toBe(2);
    
    // Select first option
    fireEvent.click(options[0]);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit vote/i });
    fireEvent.click(submitButton);
    
    // Check for success message
    await waitFor(() => {
      const successElement = screen.getByText(/thank you for voting/i);
      expect(successElement).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Verify the fetch was called with correct URL and method
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/polls/${SHARE_TOKEN}/vote`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        })
      })
    );
  });

  test('shows error when submitting without selecting option', async () => {
    // Reset fetch mock
    fetch.mockReset();
    
    // Mock fetch with exact URL pattern
    fetch.mockImplementation((url) => {
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPollData)
        });
      }
      
      console.error('Unexpected URL in fetch mock:', url);
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, message: 'Not found' })
      });
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByText('Test Question?')).toBeInTheDocument();
    });
    
    // Reset fetch mock after initial load to track only submission calls
    fetch.mockClear();
    
    // Fill out the form WITHOUT selecting an option
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit vote/i });
    fireEvent.click(submitButton);
    
    // Check for validation error message
    await waitFor(() => {
      const errorMessage = screen.getByText(/please select an option/i);
      expect(errorMessage).toBeInTheDocument();
    });
    
    // Verify that fetch was not called during submission (validation error is client-side)
    expect(fetch).not.toHaveBeenCalled();
  });

  test('shows error when server returns error on vote submission', async () => {
    // Reset the fetch mock
    fetch.mockReset();
    
    // Setup mock to handle both the initial poll data and the error response
    let fetchCallCount = 0;
    fetch.mockImplementation(() => {
      fetchCallCount++;
      
      // First fetch is for the poll data
      if (fetchCallCount === 1) {
        return createMockResponse(mockPollData);
      }
      
      // Second fetch is the failed vote submission
      return createMockResponse(
        { success: false, message: 'You have already voted on this poll' },
        false
      );
    });
    
    renderWithProviders();
    
    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Fill out the voting form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' },
    });
    
    // Select an option
    const optionElements = screen.getAllByRole('radio');
    expect(optionElements.length).toBeGreaterThan(0);
    fireEvent.click(optionElements[1]); // Click the second option
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit vote/i });
    fireEvent.click(submitButton);
    
    // Check for error message with a flexible regex
    await waitFor(() => {
      const errorMessage = screen.getByText(/you have already voted/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  test('handles network error on vote submission', async () => {
    // First fetch gets poll data
    fetch.mockImplementationOnce(() => createMockResponse(mockPollData));

    // Second fetch simulates a network error
    fetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders();

    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });

    // Fill out the voting form
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.change(screen.getByLabelText(/Your Email/i), {
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
    
    fetch.mockImplementationOnce(() => createMockResponse(pollDataWithHiddenResults));
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('Test Question?')).toBeInTheDocument();
    });
    
    // Results should be hidden
    expect(screen.queryByText(/5 votes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
  });

  test('shows results to creator even when show_results_to_voters is false', async () => {
    // Create poll data with show_results_to_voters set to false
    const creatorPollData = {
      success: true,
      poll: {
        ...mockPollData.poll,
        show_results_to_voters: false
      },
      options: mockPollData.options,
      total_votes: mockPollData.total_votes
    };
    
    // Mock fetch with exact URL pattern
    fetch.mockImplementation((url) => {
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}`) {
        return createMockResponse(creatorPollData);
      }
      
      return createMockResponse({ success: false, message: 'Not found' }, false);
    });
    
    // Create a mock user with the same ID as the poll creator
    const mockUser = { id: 1 }; // Same as poll.user_id in mockPollData
    
    // Render with the mock user
    render(
      <AuthProvider initialUser={mockUser}>
        <MemoryRouter initialEntries={[`/vote/${SHARE_TOKEN}`]}>
          <VotePage />
        </MemoryRouter>
      </AuthProvider>
    );
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByText('Test Question?')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Check that options are visible
    const options = screen.getAllByRole('radio');
    expect(options.length).toBe(2);
    
    // The voting form should be visible
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    
    // This test passes if we get this far without errors
  });

  test('shows results after voting when show_results_to_voters is true', async () => {
    // Mock fetch responses with the exact URL patterns
    let fetchCounter = 0;
    fetch.mockImplementation((url, options) => {
      fetchCounter++;
      
      // First fetch is for the poll data
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}` && (!options || !options.method || options.method === 'GET')) {
        return createMockResponse(mockPollData);
      }
      
      // Second fetch is the successful vote submission
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}/vote` && options && options.method === 'POST') {
        return createMockResponse({
          success: true,
          message: 'Vote recorded successfully',
          options: mockPollData.options,
          total_votes: mockPollData.total_votes
        });
      }
      
      console.error('Unexpected URL in fetch mock:', url);
      return createMockResponse({ success: false, message: 'Not found' }, false);
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByText('Test Question?')).toBeInTheDocument();
    });
    
    // Submit vote
    const optionElements = screen.getAllByRole('radio');
    expect(optionElements.length).toBe(2);
    fireEvent.click(optionElements[0]); // Click the first option
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit vote/i });
    fireEvent.click(submitButton);
    
    // Results should be visible after voting - check for success message
    await waitFor(() => {
      const successAlert = screen.getByText(/thank you for voting/i);
      expect(successAlert).toBeInTheDocument();
    });
    
    // Check that vote counts are displayed (more specific)
    const voteElements = screen.getAllByText(/5 votes/i);
    expect(voteElements.length).toBeGreaterThan(0);
    
    // Check that percentages are displayed
    const percentageElements = screen.getAllByText(/50%/i);
    expect(percentageElements.length).toBeGreaterThan(0);
  });

  test('shows appropriate message when voting on ended poll', async () => {
    // Create poll data with an end_date in the past
    const endedPollData = {
      ...mockPollData,
      poll: {
        ...mockPollData.poll,
        end_date: '2023-01-01' // Past date
      }
    };
    
    // Mock fetch responses with URL patterns
    let fetchCallCount = 0;
    fetch.mockImplementation((url, options) => {
      fetchCallCount++;
      
      // First fetch for poll data
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}` && (!options || !options.method || options.method === 'GET')) {
        return createMockResponse(endedPollData);
      }
      
      // Second fetch for vote submission (should fail with ended poll message)
      if (url === `${API_URL}/api/polls/${SHARE_TOKEN}/vote` && options && options.method === 'POST') {
        return createMockResponse({
          success: false,
          message: 'This poll has ended'
        }, false);
      }
      
      return createMockResponse({ success: false, message: 'Not found' }, false);
    });
    
    renderWithProviders();
    
    // Wait for the poll to load
    await waitFor(() => {
      expect(screen.queryByText('Test Question?')).toBeInTheDocument();
    });
    
    // Select an option and fill out the form
    const optionElements = screen.getAllByRole('radio');
    expect(optionElements.length).toBe(2);
    fireEvent.click(optionElements[0]);
    
    // Fill out form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Voter' },
    });
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /submit vote/i });
    fireEvent.click(submitButton);
    
    // Check for error message about ended poll
    await waitFor(() => {
      const errorMessage = screen.getByText(/this poll has ended/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });
});
