import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Fade,
  Divider,
  useTheme
} from '@mui/material';
import { useAuth } from './context/AuthContext';
import io from 'socket.io-client';
import HowToVoteIcon from '@mui/icons-material/HowToVote';

const VotePage = () => {
  const { shareToken } = useParams();
  const [poll, setPoll] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [totalVotes, setTotalVotes] = useState(0);
  const { user, getAuthHeaders } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  const [socket, setSocket] = useState(null);
  const theme = useTheme();

  // Initialize socket connection
  useEffect(() => {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Handle real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.on('vote_update', (data) => {
      if (data.share_token === shareToken) {
        setOptions(data.options);
        setTotalVotes(data.total_votes);
      }
    });

    return () => {
      if (socket) {
        socket.off('vote_update');
      }
    };
  }, [socket, shareToken]);

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/polls/${shareToken}`, {
          headers: getAuthHeaders() // Using getAuthHeaders here
        });
        
        // Check if response is undefined
        if (!response) {
          throw new Error('No response from server');
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch poll');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setPoll(data.poll);
          setOptions(data.options);
          setTotalVotes(data.total_votes);
          // Check if current user is the creator
          setIsCreator(user && data.poll.user_id === user.id);
        } else {
          setError(data.message || 'Poll not found');
        }
      } catch (err) {
        console.error('Error fetching poll:', err);
        setError('Failed to load poll');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [shareToken, user, getAuthHeaders]); // Added getAuthHeaders to dependencies

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedOption) {
      setError('Please select an option');
      return;
    }

    if (!voterName.trim() || !voterEmail.trim()) {
      setError('Please enter your name and email');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/polls/${shareToken}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders() // Using getAuthHeaders here as well
        },
        body: JSON.stringify({
          voter_name: voterName.trim(),
          voter_email: voterEmail.trim(),
          selected_option: parseInt(selectedOption, 10),
        }),
      });

      // Check if response is undefined
      if (!response) {
        throw new Error('No response from server');
      }
      
      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Thank you for voting!');
        setOptions(data.options);
        setTotalVotes(data.total_votes);
      } else {
        // Handle specific error cases
        if (data.message === 'You have already voted in this poll' || 
            data.message === 'You have already voted on this poll') {
          setError('You have already voted on this poll. Each email address can only vote once.');
        } else if (data.message === 'This poll has ended') {
          setError('This poll has ended. Voting is no longer allowed.');
        } else {
          setError(data.message || 'Failed to submit vote');
        }
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      setError('Failed to connect to server. Please try again later.');
    }
  };

  const shouldShowResults = isCreator || (success && poll?.show_results_to_voters);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!poll) {
    return (
      <Container maxWidth="sm">
        <Alert severity="error" sx={{ mt: 4 }}>
          Poll not found
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <HowToVoteIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
              {poll.question}
            </Typography>
          </Box>
          <Typography variant="subtitle1" color="textSecondary" gutterBottom>
            Created by {poll.creator_name}
          </Typography>
          {poll.end_date && (
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Ends on: {new Date(poll.end_date).toLocaleDateString()} at 11:59 PM
            </Typography>
          )}
          {shouldShowResults && (
            <Box sx={{ backgroundColor: theme.palette.background.default, p: 1, borderRadius: 1, mt: 1, mb: 2 }}>
              <Typography variant="subtitle2" color="textSecondary">
                Total Votes: <strong>{totalVotes}</strong>
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {error && (
            <Fade in={!!error}>
              <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
                {error}
              </Alert>
            </Fade>
          )}
          {success && !poll.show_results_to_voters && !isCreator && (
            <Fade in={!!success}>
              <Alert severity="info" sx={{ mb: 2, mt: 2 }}>
                Thank you for voting! The poll creator has chosen to keep the results private.
              </Alert>
            </Fade>
          )}
          {success && (poll.show_results_to_voters || isCreator) && (
            <Fade in={!!success}>
              <Alert severity="success" sx={{ mb: 2, mt: 2 }}>
                Thank you for voting! You can see the current results below.
              </Alert>
            </Fade>
          )}

          <form onSubmit={handleSubmit}>
            <RadioGroup
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              {options.map((option) => (
                <Box key={option.id} sx={{ mb: 3, p: 1, borderRadius: 1, '&:hover': { backgroundColor: theme.palette.background.default } }}>
                  <FormControlLabel
                    value={option.id.toString()}
                    control={<Radio color="primary" />}
                    label={<Typography fontWeight={500}>{option.option_text}</Typography>}
                  />
                  {shouldShowResults && (
                    <Fade in={shouldShowResults} timeout={800}>
                      <Box sx={{ mt: 1 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            {option.votes} votes ({option.percentage}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={option.percentage}
                          sx={{ 
                            mt: 0.5, 
                            height: 10, 
                            borderRadius: 5,
                            backgroundColor: theme.palette.grey[200],
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 5,
                              backgroundColor: theme.palette.primary.main,
                            }
                          }}
                        />
                      </Box>
                    </Fade>
                  )}
                </Box>
              ))}
            </RadioGroup>

            {!success && (
              <Fade in={!success}>
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Your Name"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    margin="normal"
                    required
                    variant="outlined"
                  />
                  <TextField
                    fullWidth
                    label="Your Email"
                    type="email"
                    value={voterEmail}
                    onChange={(e) => setVoterEmail(e.target.value)}
                    margin="normal"
                    required
                    variant="outlined"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    sx={{ mt: 3, mb: 2, py: 1.2 }}
                  >
                    Submit Vote
                  </Button>
                </Box>
              </Fade>
            )}
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default VotePage;