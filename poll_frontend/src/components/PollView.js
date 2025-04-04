import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Container,
  Paper,
  Typography,
  Box,
  LinearProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
}));

const ProgressBar = styled(LinearProgress)(({ theme }) => ({
  height: 20,
  borderRadius: 10,
  [`&.MuiLinearProgress-colorPrimary`]: {
    backgroundColor: theme.palette.grey[200],
  },
  [`& .MuiLinearProgress-bar`]: {
    borderRadius: 10,
  },
}));

const PollView = () => {
  const { shareToken } = useParams();
  const [poll, setPoll] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    const fetchPollData = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/polls/${shareToken}`);
        const data = await response.json();

        if (response.ok) {
          setPoll(data.poll);
          setOptions(data.options);
          setTotalVotes(data.total_votes);
        } else {
          setError(data.message || 'Failed to load poll');
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchPollData();

    // Listen for real-time updates
    socket.on('vote_update', (data) => {
      if (data.share_token === shareToken) {
        setOptions(data.options);
        setTotalVotes(data.options.reduce((sum, opt) => sum + opt.vote_count, 0));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [shareToken]);

  const handleVote = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedOption) {
      setError('Please select an option');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/polls/${shareToken}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_option: selectedOption,
          voter_name: voterName,
          voter_email: voterEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);
        setOptions(data.options);
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
      <Container maxWidth="md">
        <Alert severity="error" sx={{ mt: 4 }}>
          Poll not found
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Typography variant="h4" gutterBottom>
          {poll.question}
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" gutterBottom>
          Created by {poll.creator_name}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          Total Votes: {totalVotes}
        </Typography>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!hasVoted ? (
          <form onSubmit={handleVote}>
            <RadioGroup
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              {options.map((option) => (
                <FormControlLabel
                  key={option.id}
                  value={option.id.toString()}
                  control={<Radio />}
                  label={option.option_text}
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
              />
              <TextField
                fullWidth
                label="Your Email"
                type="email"
                value={voterEmail}
                onChange={(e) => setVoterEmail(e.target.value)}
                margin="normal"
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                sx={{ mt: 2 }}
              >
                Submit Vote
              </Button>
            </Box>
          </form>
        ) : (
          <Box sx={{ mt: 3 }}>
            {options.map((option) => (
              <Box key={option.id} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>{option.option_text}</Typography>
                  <Typography>
                    {option.vote_count} votes ({option.percentage}%)
                  </Typography>
                </Box>
                <ProgressBar
                  variant="determinate"
                  value={option.percentage}
                  sx={{
                    backgroundColor: 'grey.200',
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </StyledPaper>
    </Container>
  );
};

export default PollView; 