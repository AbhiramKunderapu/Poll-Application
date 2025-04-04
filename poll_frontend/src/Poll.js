import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function Poll() {
  const { pollId } = useParams(); // Get pollId from URL parameters
  const navigate = useNavigate(); // Hook for navigation
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Fetch poll data from backend
    axios.get(`http://127.0.0.1:5000/api/polls/${pollId}`)
      .then(res => setPoll(res.data))
      .catch(err => console.error("Error fetching poll:", err));
  }, [pollId]);

  if (!poll) {
    return <div>Loading poll data...</div>;
  }

  const submitVote = () => {
    if (!selectedOption) {
      setMessage("Please select an option before voting!");
      return;
    }

    axios.post(`http://127.0.0.1:5000/api/polls/${pollId}/vote`, { 
      selected_option: selectedOption,
      voter_name: "Anonymous",
      voter_email: "anonymous@example.com"
    })
      .then(() => {
        alert('Vote submitted successfully!');
        navigate('/'); // Redirect to home page (All Polls)
      })
      .catch(err => {
        console.error("Error submitting vote:", err);
        setMessage('Error submitting vote.');
      });
  };

  return (
    <div className="poll-vote">
      <h2>{poll.question.question}</h2>
      {poll.options.map(option => (
        <div key={option.id}>
          <input
            type="radio"
            name="option"
            onChange={() => setSelectedOption(option.id)}
          />
          {option.option_text}
        </div>
      ))}
      <button onClick={submitVote}>Vote</button>
      <p>{message}</p>
    </div>
  );
}

export default Poll;
