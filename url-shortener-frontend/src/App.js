import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  TextField,
  Button,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoIcon from '@mui/icons-material/Info';

const BACKEND_BASE_URL = 'http://localhost:5000';

const loggingMiddleware = (logData) => {
  console.log("[FRONTEND LOGGING MIDDLEWARE]:", logData);
};

const CustomAlertDialog = ({ open, title, message, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

function App() {
  const [activePage, setActivePage] = useState('shortener');
  const [urlsToShorten, setUrlsToShorten] = useState([{ id: 1, url: '', validity: '', shortcode: '' }]);
  const [shortenedResults, setShortenedResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [statsData, setStatsData] = useState([]);
  const [selectedShortcodeForStats, setSelectedShortcodeForStats] = useState(null);
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '', message: '' });

  const showAlertDialog = (title, message) => {
    setAlertDialog({ open: true, title, message });
  };

  const closeAlertDialog = () => {
    setAlertDialog({ open: false, title: '', message: '' });
  };

  const handleUrlInputChange = (id, field, value) => {
    setUrlsToShorten(prevUrls =>
      prevUrls.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addUrlInput = () => {
    if (urlsToShorten.length < 5) {
      setUrlsToShorten(prevUrls => [
        ...prevUrls,
        { id: prevUrls.length + 1, url: '', validity: '', shortcode: '' }
      ]);
    } else {
      showAlertDialog('Limit Reached', 'You can shorten up to 5 URLs concurrently.');
    }
  };

  const validateInput = (url, validity) => {
    if (!url) {
      return 'URL cannot be empty.';
    }
    try {
      new URL(url);
    } catch (_) {
      return 'Invalid URL format.';
    }

    if (validity !== '' && (isNaN(validity) || parseInt(validity) <= 0)) {
      return 'Validity must be a positive integer in minutes.';
    }
    return null;
  };

  const handleShortenUrl = async (urlItem) => {
    const { url, validity, shortcode } = urlItem;
    const validationError = validateInput(url, validity);

    if (validationError) {
      showAlertDialog('Validation Error', validationError);
      loggingMiddleware({ event: "Client-side validation failed", error: validationError, urlItem });
      return;
    }

    setLoading(true);
    loggingMiddleware({ event: "Attempting to shorten URL", original_url: url, validity, shortcode });

    try {
      const payload = {
        url: url,
        ...(validity && { validity: parseInt(validity) }),
        ...(shortcode && { shortcode: shortcode }),
      };

      const response = await fetch(`${BACKEND_BASE_URL}/shorturls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setShortenedResults(prevResults => [...prevResults, {
          originalUrl: url,
          shortLink: data.shortLink,
          expiry: data.expiry,
          id: urlItem.id
        }]);
        setSnackbarMessage('URL shortened successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        loggingMiddleware({ event: "URL shortened successfully", response: data });
      } else {
        showAlertDialog('Error Shortening URL', data.detail || data.error || 'An unknown error occurred.');
        setSnackbarMessage(`Error: ${data.detail || data.error || 'Unknown error'}`);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        loggingMiddleware({ event: "Error shortening URL", response: data });
      }
    } catch (error) {
      showAlertDialog('Network Error', 'Could not connect to the backend service.');
      setSnackbarMessage('Network error: Could not connect to backend.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      loggingMiddleware({ event: "Network error during URL shortening", error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const copyToClipboard = (text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setSnackbarMessage('Copied to clipboard!');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
      loggingMiddleware({ event: "Copied to clipboard", text });
    } catch (err) {
      showAlertDialog('Copy Error', 'Failed to copy text. Please copy manually.');
      loggingMiddleware({ event: "Failed to copy to clipboard", error: err.message });
    }
  };

  const fetchAllShortenedUrls = async () => {
    setLoading(true);
    loggingMiddleware({ event: "Fetching all shortened URLs for statistics" });
    try {
      const actualStatsPromises = shortenedResults.map(async (result) => {
        const shortcode = result.shortLink.split('/').pop();
        try {
          const response = await fetch(`${BACKEND_BASE_URL}/shorturls/${shortcode}`);
          if (response.ok) {
            const data = await response.json();
            return data;
          } else {
            loggingMiddleware({ event: "Error fetching stats for shortcode", shortcode, status: response.status, error: await response.json() });
            return null;
          }
        } catch (error) {
          loggingMiddleware({ event: "Network error fetching stats for shortcode", shortcode, error: error.message });
          return null;
        }
      });

      const fetchedStats = (await Promise.all(actualStatsPromises)).filter(Boolean);
      setStatsData(fetchedStats);
      loggingMiddleware({ event: "Statistics fetched", count: fetchedStats.length });

    } catch (error) {
      showAlertDialog('Error Fetching Statistics', 'Could not fetch statistics from the backend.');
      loggingMiddleware({ event: "Error fetching all shortened URLs", error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePage === 'statistics') {
      fetchAllShortenedUrls();
    }
  }, [activePage]);

  const renderShortenerPage = () => (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: 'primary.main' }}>
        URL Shortener
      </Typography>

      {urlsToShorten.map((item, index) => (
        <Paper key={item.id} elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
            <TextField
              label="Original URL"
              variant="outlined"
              fullWidth
              value={item.url}
              onChange={(e) => handleUrlInputChange(item.id, 'url', e.target.value)}
              sx={{ flex: 3 }}
            />
            <TextField
              label="Validity (minutes, optional)"
              variant="outlined"
              type="number"
              fullWidth
              value={item.validity}
              onChange={(e) => handleUrlInputChange(item.id, 'validity', e.target.value)}
              sx={{ flex: 1 }}
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Custom Shortcode (optional)"
              variant="outlined"
              fullWidth
              value={item.shortcode}
              onChange={(e) => handleUrlInputChange(item.id, 'shortcode', e.target.value)}
              sx={{ flex: 1.5 }}
            />
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleShortenUrl(item)}
            disabled={loading}
            fullWidth
            sx={{ mt: 1, py: 1.5, borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Shorten URL'}
          </Button>
        </Paper>
      ))}

      {urlsToShorten.length < 5 && (
        <Button
          variant="outlined"
          color="secondary"
          onClick={addUrlInput}
          fullWidth
          sx={{ mt: 2, py: 1, borderRadius: 2 }}
        >
          Add Another URL
        </Button>
      )}

      {shortenedResults.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Typography variant="h5" component="h2" gutterBottom align="center" sx={{ mb: 3, color: 'primary.dark' }}>
            Shortened Links
          </Typography>
          <List component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
            {shortenedResults.map((result, index) => (
              <ListItem
                key={index}
                divider={index < shortenedResults.length - 1}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  py: 2,
                  px: 3
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      Original: <a href={result.originalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{result.originalUrl}</a>
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Short Link: <a href={result.shortLink} target="_blank" rel="noopener noreferrer">{result.shortLink}</a>
                        <IconButton
                          aria-label="copy"
                          onClick={() => copyToClipboard(result.shortLink)}
                          size="small"
                          sx={{ ml: 1 }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Expires: {new Date(result.expiry).toLocaleString()}
                      </Typography>
                    </Box>
                  }
                  sx={{ flexGrow: 1, mb: { xs: 1, sm: 0 } }}
                />
                <Button
                  variant="outlined"
                  color="info"
                  size="small"
                  startIcon={<InfoIcon />}
                  onClick={() => {
                    setSelectedShortcodeForStats(result.shortLink.split('/').pop());
                    setActivePage('statistics');
                  }}
                  sx={{ ml: { sm: 2 }, mt: { xs: 1, sm: 0 }, borderRadius: 1 }}
                >
                  View Stats
                </Button>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Container>
  );

  const renderStatisticsPage = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: 'primary.main' }}>
        URL Statistics
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading Statistics...</Typography>
        </Box>
      ) : statsData.length === 0 ? (
        <Typography variant="h6" align="center" color="text.secondary" sx={{ mt: 5 }}>
          No shortened URLs found in this session or available for statistics.
        </Typography>
      ) : (
        <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
          <Table aria-label="shortened URL statistics table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.light' }}>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Short Link</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Original URL</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Expires On</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Total Clicks</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>Detailed Clicks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {statsData.map((row) => (
                <TableRow key={row.shortcode} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    <a href={`${BACKEND_BASE_URL}/${row.shortcode}`} target="_blank" rel="noopener noreferrer">
                      {`${BACKEND_BASE_URL}/${row.shortcode}`}
                    </a>
                  </TableCell>
                  <TableCell>{row.original_url}</TableCell>
                  <TableCell>{new Date(row.creation_date).toLocaleString()}</TableCell>
                  <TableCell>{new Date(row.expiry_date).toLocaleString()}</TableCell>
                  <TableCell align="right">{row.total_clicks}</TableCell>
                  <TableCell>
                    {row.detailed_clicks && row.detailed_clicks.length > 0 ? (
                      <List dense disablePadding>
                        {row.detailed_clicks.map((click, idx) => (
                          <ListItem key={idx} disablePadding>
                            <ListItemText
                              primary={`Time: ${new Date(click.timestamp).toLocaleString()}`}
                              secondary={`Source: ${click.source}, Location: ${click.location}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No clicks yet.</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            URL Shortener App
          </Typography>
          <Button color="inherit" onClick={() => setActivePage('shortener')}>
            Shorten URL
          </Button>
          <Button color="inherit" onClick={() => setActivePage('statistics')}>
            Statistics
          </Button>
        </Toolbar>
      </AppBar>

      {activePage === 'shortener' ? renderShortenerPage() : renderStatisticsPage()}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <CustomAlertDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={closeAlertDialog}
      />
    </Box>
  );
}

export default App;
