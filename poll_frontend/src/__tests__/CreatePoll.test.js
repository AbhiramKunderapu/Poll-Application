import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import CreatePoll from '../CreatePoll';

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

describe('CreatePoll Component', () => {
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
  });

  test('renders create poll form', () => {
    renderWithAuth(<CreatePoll />);
    
    // Check if all form elements are present
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByText(/add option/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/allow voters to see results/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create poll/i })).toBeInTheDocument();
    
    // Check for initial option fields
    expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/option 2/i)).toBeInTheDocument();
  });

  test('allows adding and removing options', () => {
    renderWithAuth(<CreatePoll />);
    
    // Add a new option
    fireEvent.click(screen.getByText(/add option/i));
    expect(screen.getByLabelText(/option 3/i)).toBeInTheDocument();
    
    // Fill in the new option
    fireEvent.change(screen.getByLabelText(/option 3/i), {
      target: { value: 'Green' },
    });
    
    // Remove the option by finding the IconButton with the error color class
    const deleteButtons = screen.getAllByRole('button').filter(button => 
      button.classList.contains('MuiIconButton-colorError')
    );
    fireEvent.click(deleteButtons[0]);
    
    // Check that the option was removed
    expect(screen.queryByLabelText(/option 3/i)).not.toBeInTheDocument();
  });

  test('validates form before submission', async () => {
    renderWithAuth(<CreatePoll />);
    
    // Submit form without filling it
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Check for validation messages
    await waitFor(() => {
      expect(screen.getByText(/please enter a title/i)).toBeInTheDocument();
    });
    
    // Fill title but not question to test question validation
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    // Submit again to trigger question validation
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a question/i)).toBeInTheDocument();
    });
    
    // Fill question but not options to test options validation
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'What is your favorite color?' },
    });
    
    // Submit again to trigger options validation
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/please provide at least two options/i)).toBeInTheDocument();
    });
    
    // fetch should not have been called
    expect(fetch).not.toHaveBeenCalled();
  });

  test('submits the form with valid data', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, poll_id: 1, share_token: 'abc123' }),
    });
    
    renderWithAuth(<CreatePoll />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'What is your favorite color?' },
    });
    
    // Add options
    fireEvent.change(screen.getByLabelText(/option 1/i), {
      target: { value: 'Red' },
    });
    
    fireEvent.change(screen.getByLabelText(/option 2/i), {
      target: { value: 'Blue' },
    });
    
    // Set end date
    const endDateInput = screen.getByLabelText(/end date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    fireEvent.change(endDateInput, {
      target: { value: tomorrowStr },
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Check if fetch was called with correct parameters
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake_token',
        },
        body: JSON.stringify({
          title: 'Test Poll',
          question: 'What is your favorite color?',
          options: ['Red', 'Blue'],
          end_date: tomorrowStr,
          show_results_to_voters: false,
        }),
      });
    });
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/poll created successfully/i)).toBeInTheDocument();
    });
  });

  test('submits the form with valid data including show_results_to_voters', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, poll_id: 1, share_token: 'abc123' }),
    });
    
    renderWithAuth(<CreatePoll />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'What is your favorite color?' },
    });
    
    // Toggle show results switch
    fireEvent.click(screen.getByLabelText(/allow voters to see results/i));
    
    // Add options
    fireEvent.change(screen.getByLabelText(/option 1/i), {
      target: { value: 'Red' },
    });
    
    fireEvent.change(screen.getByLabelText(/option 2/i), {
      target: { value: 'Blue' },
    });
    
    // Set end date
    const endDateInput = screen.getByLabelText(/end date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    fireEvent.change(endDateInput, {
      target: { value: tomorrowStr },
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Check if fetch was called with correct parameters
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake_token',
        },
        body: JSON.stringify({
          title: 'Test Poll',
          question: 'What is your favorite color?',
          options: ['Red', 'Blue'],
          end_date: tomorrowStr,
          show_results_to_voters: true,
        }),
      });
    });
    
    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/poll created successfully/i)).toBeInTheDocument();
    });
  });

  test('displays error message on form submission failure', async () => {
    // Mock failed fetch response
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Failed to create poll' }),
    });
    
    renderWithAuth(<CreatePoll />);
    
    // Fill out the form with minimal valid data
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'What is your favorite color?' },
    });
    
    // Add options
    fireEvent.change(screen.getByLabelText(/option 1/i), {
      target: { value: 'Red' },
    });
    
    fireEvent.change(screen.getByLabelText(/option 2/i), {
      target: { value: 'Blue' },
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to create poll/i)).toBeInTheDocument();
    });
  });

  test('redirects to poll list after successful creation', async () => {
    // Mock successful fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, poll_id: 1, share_token: 'abc123' }),
    });
    
    renderWithAuth(<CreatePoll />);
    
    // Fill out form with minimal valid data
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'What is your favorite color?' },
    });
    
    // Add options
    fireEvent.change(screen.getByLabelText(/option 1/i), {
      target: { value: 'Red' },
    });
    
    fireEvent.change(screen.getByLabelText(/option 2/i), {
      target: { value: 'Blue' },
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/poll created successfully/i)).toBeInTheDocument();
    });
    
    // Click the Done button in the dialog
    fireEvent.click(screen.getByText(/done/i));
    
    // Check navigation
    expect(mockNavigate).toHaveBeenCalledWith('/polls');
  });

  test('handles API error gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Server error' }),
    });
    
    renderWithAuth(<CreatePoll />);
    
    // Fill minimum required fields
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Poll' },
    });
    
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: 'Test Question?' },
    });
    
    // Add options
    fireEvent.change(screen.getByLabelText(/option 1/i), {
      target: { value: 'Option 1' },
    });
    
    fireEvent.change(screen.getByLabelText(/option 2/i), {
      target: { value: 'Option 2' },
    });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /create poll/i }));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
}); 