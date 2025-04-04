import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Poll from '../Poll';
import { AuthProvider } from '../context/AuthContext';

// Mock axios
jest.mock('axios', () => {
  return {
    get: jest.fn(),
    post: jest.fn()
  };
});

// Import axios after mocking
import axios from 'axios';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ pollId: '1' })
}));

// Mock window.alert
window.alert = jest.fn();

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: () => ({
    getAuthHeaders: () => ({
      'Authorization': 'Bearer fake_token'
    }),
    isAuthenticated: true,
    user: { username: 'testuser' }
  })
}));

describe('Poll Component', () => {
  const mockPoll = {
    question: {
      id: 1,
      question: 'What is your favorite color?'
    },
    options: [
      { id: 1, option_text: 'Red' },
      { id: 2, option_text: 'Blue' },
      { id: 3, option_text: 'Green' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', async () => {
    // Mock axios get to delay response
    axios.get.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(
      <AuthProvider>
        <Poll />
      </AuthProvider>
    );
    
    // Check for loading state
    expect(screen.getByText(/loading poll data/i)).toBeInTheDocument();
  });

  test('renders poll question and options', async () => {
    // Mock successful axios response
    axios.get.mockResolvedValueOnce({ data: mockPoll });
    
    render(
      <AuthProvider>
        <Poll />
      </AuthProvider>
    );
    
    // Wait for poll to load
    await waitFor(() => expect(screen.queryByText(/loading poll data/i)).not.toBeInTheDocument());
    
    // Check poll question is displayed
    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    
    // Check options are displayed
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    
    // Check submit button is displayed
    expect(screen.getByText('Vote')).toBeInTheDocument();
  });

  test('shows error when submitting without selecting an option', async () => {
    // Mock successful axios response
    axios.get.mockResolvedValueOnce({ data: mockPoll });
    
    render(
      <AuthProvider>
        <Poll />
      </AuthProvider>
    );
    
    // Wait for poll to load
    await waitFor(() => expect(screen.queryByText(/loading poll data/i)).not.toBeInTheDocument());
    
    // Submit without selecting an option
    fireEvent.click(screen.getByText('Vote'));
    
    // Check for error message
    expect(screen.getByText(/please select an option before voting/i)).toBeInTheDocument();
    
    // Verify axios post was not called
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('submits vote successfully', async () => {
    // Mock successful GET response
    axios.get.mockResolvedValueOnce({ data: mockPoll });
    
    // Mock successful POST response
    axios.post.mockResolvedValueOnce({});
    
    render(
      <AuthProvider>
        <Poll />
      </AuthProvider>
    );
    
    // Wait for poll to load
    await waitFor(() => expect(screen.queryByText(/loading poll data/i)).not.toBeInTheDocument());
    
    // Select an option (first radio button)
    const radioButtons = screen.getAllByRole('radio');
    fireEvent.click(radioButtons[0]); // Select "Red"
    
    // Submit the form
    fireEvent.click(screen.getByText('Vote'));
    
    // Check that alert was shown
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Vote submitted successfully!');
    });
    
    // Verify correct axios post call
    expect(axios.post).toHaveBeenCalledWith(
      `http://127.0.0.1:5000/api/polls/1/vote`, 
      { 
        selected_option: 1,
        voter_name: "Anonymous",
        voter_email: "anonymous@example.com"
      }
    );
    
    // Verify navigation to home page
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('handles vote submission error', async () => {
    // Mock successful GET response
    axios.get.mockResolvedValueOnce({ data: mockPoll });
    
    // Mock failed POST response
    axios.post.mockRejectedValueOnce(new Error('Failed to submit vote'));
    
    render(
      <AuthProvider>
        <Poll />
      </AuthProvider>
    );
    
    // Wait for poll to load
    await waitFor(() => expect(screen.queryByText(/loading poll data/i)).not.toBeInTheDocument());
    
    // Select an option (first radio button)
    const radioButtons = screen.getAllByRole('radio');
    fireEvent.click(radioButtons[0]); // Select "Red"
    
    // Submit the form
    fireEvent.click(screen.getByText('Vote'));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/error submitting vote/i)).toBeInTheDocument();
    });
    
    // Verify navigation was not called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
}); 