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
} from '@mui/material';

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

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const response = await fetch(`http://localhost:5000/poll/${shareToken}`);
        const data = await response.json();
        
        if (response.ok) {
          setPoll(data.poll);
          setOptions(data.options);
        } else {
          setError('Poll not found');
        }
      } catch (err) {
        setError('Failed to load poll');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [shareToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedOption) {
      setError('Please select an option');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/vote/${shareToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          option_id: selectedOption,
          voter_name: voterName,
          voter_email: voterEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Thank you for voting!');
        // Refresh poll data to show updated votes
        const pollResponse = await fetch(`http://localhost:5000/poll/${shareToken}`);
        const pollData = await pollResponse.json();
        setOptions(pollData.options);
      } else {
        setError(data.message || 'Failed to submit vote');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

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
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {poll.question}
          </Typography>
          <Typography variant="subtitle1" color="textSecondary" gutterBottom>
            Created by {poll.creator_name}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <RadioGroup
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              {options.map((option) => (
                <FormControlLabel
                  key={option.id}
                  value={option.id.toString()}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography>
                        {option.option_text}
                        {success && (
                          <Typography
                            component="span"
                            color="textSecondary"
                            sx={{ ml: 2 }}
                          >
                            ({option.votes} votes)
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>

            <Box sx={{ mt: 3 }}>
              <TextField
                fullWidth
                label="Your Name"
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                margin="normal"
                required
                disabled={!!success}
              />
              <TextField
                fullWidth
                label="Your Email"
                type="email"
                value={voterEmail}
                onChange={(e) => setVoterEmail(e.target.value)}
                margin="normal"
                required
                disabled={!!success}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 2 }}
                disabled={!!success}
              >
                Submit Vote
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default VotePage; 