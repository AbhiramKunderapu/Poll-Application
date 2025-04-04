import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  LinearProgress,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const PollDetails = () => {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { getAuthHeaders } = useAuth();

  useEffect(() => {
    const socket = io('http://localhost:5000');
    let mounted = true;
    
    const fetchPollDetails = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/polls/${pollId}/details`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        
        if (!mounted) return;
        
        if (response.ok) {
          setPoll(data);
          setError('');
        } else {
          setError(data.message || 'Failed to load poll details');
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to connect to server');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchPollDetails();

    // Listen for real-time updates
    socket.on('vote_update', (data) => {
      if (data.poll_id === parseInt(pollId)) {
        setPoll(prevPoll => ({
          ...prevPoll,
          options: data.options,
          total_votes: data.total_votes
        }));
      }
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [pollId, getAuthHeaders]);

  const handleBack = () => {
    navigate('/polls');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4 }}>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={handleBack}>
                Back to Polls
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      </Container>
    );
  }

  if (!poll) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4 }}>
          <Alert 
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={handleBack}>
                Back to Polls
              </Button>
            }
          >
            Poll not found
          </Alert>
        </Box>
      </Container>
    );
  }

  const calculatePercentage = (votes) => {
    return poll.total_votes > 0 ? (votes / poll.total_votes) * 100 : 0;
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to Polls
        </Button>
        
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {poll.question}
          </Typography>
          
          <Typography variant="subtitle1" color="textSecondary" gutterBottom>
            Total Votes: {poll.total_votes}
          </Typography>

          <Box sx={{ mt: 4 }}>
            {poll.options.map((option) => (
              <Box key={option.id} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">
                    {option.option_text}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {option.votes} votes ({calculatePercentage(option.votes).toFixed(1)}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculatePercentage(option.votes)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="textSecondary">
              Created: {new Date(poll.created_at).toLocaleString()}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default PollDetails; 