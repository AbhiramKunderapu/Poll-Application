import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuth } from './context/AuthContext';

const CreatePoll = () => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState('');
  const [shareDialog, setShareDialog] = useState({ open: false, url: '' });
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least two options');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/create_poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const shareUrl = `${window.location.origin}/poll/${data.share_token}`;
        setShareDialog({ open: true, url: shareUrl });
      } else {
        setError(data.message || 'Failed to create poll');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareDialog.url);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleCloseDialog = () => {
    setShareDialog({ open: false, url: '' });
    navigate('/polls');
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Create New Poll
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              margin="normal"
              required
            />

            {options.map((option, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  label={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  required
                />
                {options.length > 2 && (
                  <IconButton
                    color="error"
                    onClick={() => removeOption(index)}
                    sx={{ mt: 1 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addOption}
              sx={{ mb: 3 }}
            >
              Add Option
            </Button>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
            >
              Create Poll
            </Button>
          </form>
        </Paper>
      </Box>

      <Dialog open={shareDialog.open} onClose={handleCloseDialog}>
        <DialogTitle>Poll Created Successfully!</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Share this link with others to let them vote:
          </Typography>
          <TextField
            fullWidth
            value={shareDialog.url}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyShareUrl} edge="end">
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Done</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CreatePoll;
