import React, { useState } from 'react';
import { Music, Search, Copy, Check, Download, ExternalLink } from 'lucide-react';

const SpotifyAnalyzer = () => {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(null);

  const CLIENT_ID = '8e9e53c5e52f4af0bd5a946e85736742';
  const REDIRECT_URI = window.location.origin + '/callback';

  // Key mappings (Pitch Class notation)
  const keyMap = {
    0: 'C', 1: 'C♯/D♭', 2: 'D', 3: 'D♯/E♭', 4: 'E', 5: 'F',
    6: 'F♯/G♭', 7: 'G', 8: 'G♯/A♭', 9: 'A', 10: 'A♯/B♭', 11: 'B'
  };

  // PKCE helpers
  const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  // Authentication
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem('spotify_analyzer_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const code = urlParams.get('code');
    let storedToken = localStorage.getItem('spotify_analyzer_token');

    if (code && !storedToken) {
      const codeVerifier = localStorage.getItem('code_verifier');
      
      fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      })
        .then(response => response.json())
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('spotify_analyzer_token', data.access_token);
            setToken(data.access_token);
            window.history.replaceState({}, document.title, '/');
          }
        });
    } else if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLogin = async () => {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    localStorage.setItem('code_verifier', codeVerifier);

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', 'user-read-private');
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);

    window.location.href = authUrl.toString();
  };

  const extractTrackId = (url) => {
    // Extract track ID from various Spotify URL formats
    const patterns = [
      /track\/([a-zA-Z0-9]+)/,  // Standard URL
      /spotify:track:([a-zA-Z0-9]+)/  // URI format
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const analyzeTrack = async () => {
    if (!spotifyUrl.trim()) {
      setError('Please enter a Spotify link');
      return;
    }

    const trackId = extractTrackId(spotifyUrl);
    if (!trackId) {
      setError('Invalid Spotify link. Please use a track URL or URI.');
      return;
    }

    setLoading(true);
    setError('');
    setTrackData(null);

    try {
      // Fetch track info
      const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!trackResponse.ok) {
        throw new Error('Failed to fetch track info');
      }
      
      const track = await trackResponse.json();

      // Fetch audio features (tempo, key)
      const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!featuresResponse.ok) {
        throw new Error('Failed to fetch audio features');
      }
      
      const features = await featuresResponse.json();

      setTrackData({
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url,
        tempo: Math.round(features.tempo),
        key: keyMap[features.key] || 'Unknown',
        mode: features.mode === 1 ? 'Major' : 'Minor',
        timeSignature: features.time_signature,
        duration: Math.floor(track.duration_ms / 1000),
        energy: Math.round(features.energy * 100),
        danceability: Math.round(features.danceability * 100),
        valence: Math.round(features.valence * 100)
      });
    } catch (err) {
      setError(err.message || 'Failed to analyze track');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!trackData) return;
    
    const text = `TITLE: ${trackData.name}
ARTIST: ${trackData.artists}
KEY: ${trackData.key} ${trackData.mode}
BPM: ${trackData.tempo}
TAGS: 
WRITTEN BY: ${trackData.artists}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMetadata = () => {
    if (!trackData) return;
    
    const text = `TITLE: ${trackData.name}
ARTIST: ${trackData.artists}
KEY: ${trackData.key} ${trackData.mode}
BPM: ${trackData.tempo}
TAGS: 
WRITTEN BY: ${trackData.artists}

---
Album: ${trackData.album}
Duration: ${formatDuration(trackData.duration)}
Time Signature: ${trackData.timeSignature}/4
Energy: ${trackData.energy}%
Danceability: ${trackData.danceability}%`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackData.name} - Metadata.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSpotidown = () => {
    if (!spotifyUrl) return;
    window.open(`https://spotidown.app/?url=${encodeURIComponent(spotifyUrl)}`, '_blank');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-green-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Music className="w-20 h-20 mx-auto mb-6 text-green-500" />
          <h1 className="text-3xl font-bold text-white mb-4">Spotify Track Analyzer</h1>
          <p className="text-gray-400 mb-8">Extract song info, tempo, and musical key from any Spotify link</p>
          <button
            onClick={handleLogin}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full transition"
          >
            Connect Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Music className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h1 className="text-3xl font-bold mb-2">Spotify Track Analyzer</h1>
          <p className="text-gray-400">Paste any Spotify link to extract track details</p>
        </div>

        {/* Input */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && analyzeTrack()}
              placeholder="Paste Spotify link or URI (e.g., spotify:track:... or https://open.spotify.com/track/...)"
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={analyzeTrack}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}
        </div>

        {/* Results */}
        {trackData && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 shadow-2xl">
            <div className="flex items-start gap-6 mb-6">
              {trackData.albumArt && (
                <img
                  src={trackData.albumArt}
                  alt={trackData.album}
                  className="w-32 h-32 rounded-lg shadow-lg"
                />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{trackData.name}</h2>
                <p className="text-gray-400 text-lg mb-1">{trackData.artists}</p>
                <p className="text-gray-500 text-sm">{trackData.album}</p>
              </div>
              <button
                onClick={copyToClipboard}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                title="Copy Craft format"
              >
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
              <button
                onClick={downloadMetadata}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                title="Download metadata"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={openSpotidown}
                className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
                title="Download audio via Spotidown"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>

            {/* Primary Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Tempo</p>
                <p className="text-3xl font-bold text-green-500">{trackData.tempo}</p>
                <p className="text-gray-500 text-xs">BPM</p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Key</p>
                <p className="text-3xl font-bold text-blue-500">{trackData.key}</p>
                <p className="text-gray-500 text-xs">{trackData.mode}</p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Time</p>
                <p className="text-3xl font-bold text-purple-500">{trackData.timeSignature}/4</p>
                <p className="text-gray-500 text-xs">Signature</p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Duration</p>
                <p className="text-3xl font-bold text-orange-500">{formatDuration(trackData.duration)}</p>
                <p className="text-gray-500 text-xs">Minutes</p>
              </div>
            </div>

            {/* Audio Characteristics */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold mb-3">Audio Characteristics</h3>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Energy</span>
                  <span className="text-white">{trackData.energy}%</span>
                </div>
                <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: `${trackData.energy}%` }} />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Danceability</span>
                  <span className="text-white">{trackData.danceability}%</span>
                </div>
                <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${trackData.danceability}%` }} />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Positivity</span>
                  <span className="text-white">{trackData.valence}%</span>
                </div>
                <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full" style={{ width: `${trackData.valence}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyAnalyzer;
