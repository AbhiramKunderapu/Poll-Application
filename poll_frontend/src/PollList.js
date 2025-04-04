import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from './context/AuthContext';

const PollList = () => {
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { getAuthHeaders } = useAuth();

  const fetchPolls = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/polls', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPolls(data.polls || []);
      } else {
        setError(data.message || 'Failed to load polls');
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleDelete = async (pollId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/polls/${pollId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPolls(polls.filter(poll => poll.id !== pollId));
        setSnackbar({ open: true, message: 'Poll deleted successfully', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.message || 'Failed to delete poll', severity: 'error' });
      }
    } catch (err) {
      console.error('Error deleting poll:', err);
      setSnackbar({ open: true, message: 'Failed to connect to server', severity: 'error' });
    }
  };

  const handleShare = async (poll) => {
    const shareUrl = `${window.location.origin}/poll/${poll.share_token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackbar({ open: true, message: 'Share link copied to clipboard!', severity: 'success' });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
    }
  };

  const handleViewDetails = (pollId) => {
    navigate(`/poll-details/${pollId}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Polls
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {polls.length === 0 ? (
          <Box textAlign="center" mt={4}>
            <Typography variant="body1" color="textSecondary" gutterBottom>
              You haven't created any polls yet.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/create')}
              sx={{ mt: 2 }}
            >
              Create Your First Poll
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {polls.map((poll) => (
              <Grid item xs={12} key={poll.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {poll.title}
                        </Typography>
                        <Typography variant="body1" color="textSecondary" gutterBottom>
                          {poll.question}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Total Votes: {poll.total_votes || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Options: {poll.option_count}
                        </Typography>
                        {poll.end_date && (
                          <Typography variant="body2" color="textSecondary">
                            Ends: {new Date(poll.end_date).toLocaleDateString()} at 11:59 PM
                          </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary" display="block">
                          Created: {new Date(poll.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Tooltip title="View Details">
                          <IconButton onClick={() => handleViewDetails(poll.id)} color="primary">
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Share Poll">
                          <IconButton onClick={() => handleShare(poll)} color="primary">
                            <ShareIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Poll">
                          <IconButton onClick={() => handleDelete(poll.id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PollList;