import React from 'react';
import { render, screen, fireEvent, waitFor, prettyDOM } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PollList from '../PollList';

// Mock fetch globally
global.fetch = jest.fn();

// Helper function for debugging
const logDOM = (container) => {
  console.log(prettyDOM(container, undefined, { highlight: false }));
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
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  
  // Add React Router future flags to suppress warnings
  const originalBrowserRouter = originalModule.BrowserRouter;
  const EnhancedBrowserRouter = ({ children, ...props }) => {
    return (
      <originalBrowserRouter
        {...props}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </originalBrowserRouter>
    );
  };
  
  return {
    ...originalModule,
    BrowserRouter: EnhancedBrowserRouter,
    useNavigate: () => mockNavigate,
  };
});

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
  // Increase Jest timeout for these tests
  jest.setTimeout(10000);
  
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
        share_token: 'abc123',
        option_count: 3,
        total_votes: 0,
        created_at: '2023-01-01'
      },
      {
        id: 2,
        title: 'Test Poll 2',
        question: 'What is your favorite food?',
        end_date: '2023-12-31',
        share_token: 'def456',
        option_count: 4,
        total_votes: 2,
        created_at: '2023-01-01'
      }
    ];

    // Create a proper Response-like object
    const createMockResponse = (body, ok = true) => {
      return Promise.resolve({
        ok,
        status: ok ? 200 : 400,
        json: () => Promise.resolve(body)
      });
    };

    // Mock successful fetch for polls list - this is the default behavior
    fetch.mockImplementation((url, options) => {
      // Default response for GET polls
      if (url === 'http://localhost:5000/api/polls' && (!options || !options.method || options.method === 'GET')) {
        return createMockResponse({ success: true, polls: mockPolls });
      }
      
      // For DELETE requests
      if (url.includes('/api/polls/') && options && options.method === 'DELETE') {
        return createMockResponse({ success: true, message: 'Poll deleted successfully' });
      }
      
      // Default fallback - return success with empty data instead of rejection
      // Suppressed warning via console.warn mock
      return createMockResponse({ success: false, message: 'Unmocked API call' }, false);
    });
  });

  test('renders loading state initially', async () => {
    // Mock fetch to be slow to ensure we see the loading state
    fetch.mockImplementationOnce(() => 
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, polls: [] })
          });
        }, 100); // Small delay
      })
    );
    
    // Don't use the enhanced renderWithAuth since we want to test the loading state
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Check for loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Wait for the polls to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  test('renders polls after loading', async () => {
    // Clear mocks
    jest.clearAllMocks();
    fetch.mockReset();
    
    // Mock fetch to return two polls
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          success: true, 
          polls: [
            {
              id: 1,
              title: 'Test Poll 1',
              question: 'What is your favorite color?',
              end_date: '2023-12-31',
              share_token: 'abc123',
              option_count: 3,
              total_votes: 0,
              created_at: '2023-01-01'
            },
            {
              id: 2,
              title: 'Test Poll 2',
              question: 'What is your favorite food?',
              end_date: '2023-12-31',
              share_token: 'def456',
              option_count: 4,
              total_votes: 2,
              created_at: '2023-01-01'
            }
          ] 
        })
      })
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for loading to complete
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
    // Clear all mocks and reset fetch
    jest.clearAllMocks();
    fetch.mockReset();
    
    // Create a mock that returns empty polls
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, polls: [] })
      })
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for the loading state to disappear
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Look for the empty state message text
    const emptyMessage = await screen.findByText(/haven't created any polls/i);
    expect(emptyMessage).toBeInTheDocument();
    
    // Look for the create button - use button role with partial text
    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).toBeInTheDocument();
  });

  test('shows error state when fetch fails', async () => {
    // Clear mocks
    jest.clearAllMocks();
    fetch.mockReset();
    
    // Override the mock to return error
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, message: 'Failed to fetch polls' })
      })
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for the loading state to disappear
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Check for error message
    expect(screen.getByText(/failed to fetch polls/i)).toBeInTheDocument();
  });

  test('deletes a poll successfully', async () => {
    // Clear mocks
    jest.clearAllMocks(); 
    fetch.mockReset();
    
    // Create poll for this test
    const mockPoll = {
      id: 1,
      title: 'Test Poll 1',
      question: 'What is your favorite color?',
      end_date: '2023-12-31',
      share_token: 'abc123',
      option_count: 3,
      total_votes: 0,
      created_at: '2023-01-01'
    };
    
    // Use a counter to track which fetch call is being made
    let fetchCounter = 0;
    
    // Mock fetch calls
    fetch.mockImplementation((url, options) => {
      // First fetch - getting polls
      if (fetchCounter === 0) {
        fetchCounter++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            success: true, 
            polls: [mockPoll] 
          })
        });
      }
      // Second fetch - deleting poll
      else if (url.includes('/api/polls/1') && options && options.method === 'DELETE') {
        fetchCounter++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            success: true, 
            message: 'Poll deleted successfully' 
          })
        });
      }
      // Any other fetch
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ 
          success: false, 
          message: 'Unexpected fetch call' 
        })
      });
    });
    
    // Render component
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for loading state to be done
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Verify poll is loaded
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find and verify the delete button
    const deleteButton = screen.getByTestId('delete-button-1');
    expect(deleteButton).toBeInTheDocument();
    
    // Click the delete button
    fireEvent.click(deleteButton);
    
    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/poll deleted successfully/i)).toBeInTheDocument();
    });
  });

  test('copies share link to clipboard', async () => {
    // Clear mocks
    jest.clearAllMocks();
    fetch.mockReset();
    navigator.clipboard.writeText.mockClear();
    
    // Mock fetch to return a poll with known share token
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          success: true, 
          polls: [{
            id: 1,
            title: 'Test Poll 1',
            question: 'What is your favorite color?',
            end_date: '2023-12-31',
            share_token: 'abc123',
            option_count: 3,
            total_votes: 0,
            created_at: '2023-01-01'
          }] 
        })
      })
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Wait for poll to appear
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find the share button using data-testid
    const shareButton = screen.getByTestId('share-button-1');
    expect(shareButton).toBeInTheDocument();
    
    // Click the share button
    fireEvent.click(shareButton);
    
    // Check if clipboard.writeText was called with the correct link
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('abc123')
    );
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    });
  });

  test('navigates to poll details on view button click', async () => {
    // Clear mocks
    jest.clearAllMocks();
    fetch.mockReset();
    mockNavigate.mockClear();
    
    // Mock fetch to return a poll
    fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          success: true, 
          polls: [{
            id: 1,
            title: 'Test Poll 1',
            question: 'What is your favorite color?',
            end_date: '2023-12-31',
            share_token: 'abc123',
            option_count: 3,
            total_votes: 0,
            created_at: '2023-01-01'
          }] 
        })
      })
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <PollList />
        </AuthProvider>
      </BrowserRouter>
    );
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    
    // Wait for poll to appear
    await waitFor(() => {
      expect(screen.getByText('Test Poll 1')).toBeInTheDocument();
    });
    
    // Find the view details button using data-testid
    const viewButton = screen.getByTestId('view-button-1');
    expect(viewButton).toBeInTheDocument();
    
    // Click the button
    fireEvent.click(viewButton);
    
    // Check navigation
    expect(mockNavigate).toHaveBeenCalledWith('/poll-details/1');
  });
});

// Global error handling to avoid unhandled promise rejections in tests
beforeAll(() => {
  // Suppress console.warn and console.error during tests to avoid cluttering the output
  jest.spyOn(console, 'warn').mockImplementation((msg) => {
    // Allow non-React Router warnings to show
    if (!msg.includes('React Router') && !msg.includes('Unmocked fetch call')) {
      console.log('Suppressed warning:', msg);
    }
  });
  
  jest.spyOn(console, 'error').mockImplementation((msg) => {
    // Allow seeing error messages during test development but suppressed in CI
    if (process.env.NODE_ENV !== 'test') {
      console.log('Suppressed error:', msg);
    }
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    console.log('Unhandled promise rejection in test:', event.reason);
  });
});

afterAll(() => {
  // Restore console functions
  console.warn.mockRestore();
  console.error.mockRestore();
});
