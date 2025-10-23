import React, { useState } from 'react';
import { Music, Loader, Download, Activity } from 'lucide-react';

const SpotifyAnalyzer = () => {
  const [trackUrl, setTrackUrl] = useState('');
  const [trackData, setTrackData] = useState(null);
  const [audioFeatures, setAudioFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const RAPIDAPI_KEY = '1321ebd11bmshf584ecfe6ea1e9ep1053b6jsne03ec8d12cb1';

  const extractTrackId = (url) => {
    // Remove whitespace
    url = url.trim();
    
    // Try different patterns
    const patterns = [
      /track\/([a-zA-Z0-9]+)/,           // Standard URL
      /spotify:track:([a-zA-Z0-9]+)/,    // Spotify URI
      /^([a-zA-Z0-9]{22})$/              // Just the ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const analyzeTrack = async () => {
    const trackId = extractTrackId(trackUrl);
    if (!trackId) {
      setError('Invalid Spotify track URL');
      return;
    }

    setLoading(true);
    setError(null);
    setTrackData(null);
    setAudioFeatures(null);

    try {
      // Get audio features from RapidAPI first
      const featuresResponse = await fetch(
        `https://spotify-audio-features-track-analysis.p.rapidapi.com/tracks/spotify_audio_features?spotify_track_id=${trackId}`,
        {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'spotify-audio-features-track-analysis.p.rapidapi.com'
          }
        }
      );

      if (!featuresResponse.ok) {
        throw new Error('Failed to fetch audio features. Check your RapidAPI subscription.');
      }

      const apiData = await featuresResponse.json();
      console.log('API Response:', apiData); // Debug log
      
      // The API returns data in audio_features object
      const features = apiData.audio_features || apiData;
      
      // Convert string values to numbers if needed
      const processedFeatures = {
        key: typeof features.key === 'string' ? features.key : features.key,
        mode: parseFloat(features.mode) || 0,
        tempo: parseFloat(features.tempo) || 0,
        time_signature: parseFloat(features.time_signature) || 4,
        loudness: parseFloat(features.loudness) || 0,
        energy: parseFloat(features.energy) || 0,
        danceability: parseFloat(features.danceability) || 0,
        valence: parseFloat(features.valence) || 0,
        acousticness: parseFloat(features.acousticness) || 0,
        instrumentalness: parseFloat(features.instrumentalness) || 0,
        liveness: parseFloat(features.liveness) || 0,
        speechiness: parseFloat(features.speechiness) || 0
      };
      
      setAudioFeatures(processedFeatures);

      // Get track metadata from RapidAPI downloader endpoint
      const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
      const metadataResponse = await fetch(
        `https://spotify-downloader12.p.rapidapi.com/Gettrack?spotify_url=${encodeURIComponent(spotifyUrl)}`,
        {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'spotify-downloader12.p.rapidapi.com'
          }
        }
      );

      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        console.log('Metadata response:', metadataData);
        
        // The API returns properly formatted track data already!
        if (metadataData && metadataData.name) {
          setTrackData(metadataData);
        } else {
          // Fallback: create basic track data
          setTrackData({
            id: trackId,
            name: 'Track ' + trackId,
            artists: [{ name: 'Unknown Artist' }],
            album: {
              name: 'Unknown Album',
              images: [],
              release_date: 'Unknown'
            },
            duration_ms: 0,
            popularity: 0,
            explicit: false,
            preview_url: null,
            external_urls: { spotify: `https://open.spotify.com/track/${trackId}` }
          });
        }
      } else {
        // Fallback: create basic track data
        setTrackData({
          id: trackId,
          name: 'Track ' + trackId,
          artists: [{ name: 'Unknown Artist' }],
          album: {
            name: 'Unknown Album',
            images: [],
            release_date: 'Unknown'
          },
          duration_ms: 0,
          popularity: 0,
          explicit: false,
          preview_url: null,
          external_urls: { spotify: `https://open.spotify.com/track/${trackId}` }
        });
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTrack = async () => {
    if (!trackData) return;
    
    setDownloading(true);
    
    try {
      // Get download link from RapidAPI
      const spotifyUrl = `https://open.spotify.com/track/${trackData.id}`;
      const response = await fetch(
        `https://spotify-downloader12.p.rapidapi.com/convert?urls=${encodeURIComponent(spotifyUrl)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'spotify-downloader12.p.rapidapi.com'
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const data = await response.json();
      console.log('Download API response:', data);
      
      if (!data.url) {
        throw new Error('No download URL available');
      }

      // Open download link in new tab (CORS prevents direct download)
      window.open(data.url, '_blank');
      
      // Create metadata text
      const metadata = `
═══════════════════════════════════════════
    SPOTIFY TRACK INFORMATION
═══════════════════════════════════════════

Track Details:
-------------
Title: ${trackData.name}
Artist: ${trackData.artists.map(a => a.name).join(', ')}
Album: ${trackData.album.name}
Release Date: ${trackData.album.release_date}
Duration: ${formatDuration(trackData.duration_ms)}
Popularity: ${trackData.popularity}/100
Explicit: ${trackData.explicit ? 'Yes' : 'No'}

Spotify Links:
--------------
Track ID: ${trackData.id}
Track URL: https://open.spotify.com/track/${trackData.id}
${trackData.external_urls?.spotify ? `Web Player: ${trackData.external_urls.spotify}` : ''}

${audioFeatures ? `
Audio Analysis:
--------------
Key: ${getKeyName(audioFeatures.key)} ${audioFeatures.mode === 1 ? 'Major' : 'Minor'}
Tempo: ${Math.round(audioFeatures.tempo)} BPM
Time Signature: ${audioFeatures.time_signature}/4
Loudness: ${audioFeatures.loudness?.toFixed(1)} dB

Musical Characteristics:
-----------------------
Energy: ${(audioFeatures.energy * 100).toFixed(0)}% - ${getEnergyDescription(audioFeatures.energy)}
Danceability: ${(audioFeatures.danceability * 100).toFixed(0)}% - ${getDanceabilityDescription(audioFeatures.danceability)}
Valence: ${(audioFeatures.valence * 100).toFixed(0)}% - ${getValenceDescription(audioFeatures.valence)}
Acousticness: ${(audioFeatures.acousticness * 100).toFixed(0)}%
Instrumentalness: ${(audioFeatures.instrumentalness * 100).toFixed(0)}%
Liveness: ${(audioFeatures.liveness * 100).toFixed(0)}%
Speechiness: ${(audioFeatures.speechiness * 100).toFixed(0)}%
` : ''}

═══════════════════════════════════════════
Downloaded: ${new Date().toLocaleString()}
Source: Spotify Analyzer with RapidAPI
═══════════════════════════════════════════
`;

      // Download metadata file
      const metadataBlob = new Blob([metadata], { type: 'text/plain' });
      const metadataUrl = URL.createObjectURL(metadataBlob);
      const metadataLink = document.createElement('a');
      metadataLink.href = metadataUrl;
      metadataLink.download = `${trackData.artists[0].name} - ${trackData.name} - Info.txt`;
      document.body.appendChild(metadataLink);
      metadataLink.click();
      document.body.removeChild(metadataLink);
      URL.revokeObjectURL(metadataUrl);

      alert('✅ Download started! Check your downloads folder for MP3 + metadata file.');
    } catch (err) {
      console.error('Download error:', err);
      alert(`❌ Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const getKeyName = (key) => {
    // API returns string keys like "D", "C#", etc.
    if (typeof key === 'string') {
      return key;
    }
    // Fallback for numeric keys
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keys[key] || 'Unknown';
  };

  const getEnergyDescription = (energy) => {
    if (energy > 0.8) return 'Very High Energy';
    if (energy > 0.6) return 'High Energy';
    if (energy > 0.4) return 'Moderate Energy';
    if (energy > 0.2) return 'Low Energy';
    return 'Very Low Energy';
  };

  const getDanceabilityDescription = (danceability) => {
    if (danceability > 0.8) return 'Extremely Danceable';
    if (danceability > 0.6) return 'Very Danceable';
    if (danceability > 0.4) return 'Moderately Danceable';
    if (danceability > 0.2) return 'Slightly Danceable';
    return 'Not Danceable';
  };

  const getValenceDescription = (valence) => {
    if (valence > 0.8) return 'Very Positive/Happy';
    if (valence > 0.6) return 'Positive/Upbeat';
    if (valence > 0.4) return 'Neutral';
    if (valence > 0.2) return 'Melancholic';
    return 'Very Sad/Dark';
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-green-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Music className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-5xl font-bold text-white mb-2">🎵 Spotify Analyzer</h1>
          <p className="text-gray-300 text-lg">Get key, tempo & download any Spotify track</p>
          <p className="text-xs text-gray-400 mt-2">No login required • Powered by RapidAPI</p>
        </div>

        {/* Input Section */}
        <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-green-500/20">
          <div className="flex gap-3">
            <input
              type="text"
              value={trackUrl}
              onChange={(e) => setTrackUrl(e.target.value)}
              placeholder="Paste Spotify track URL here..."
              className="flex-1 bg-black/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-sm"
              onKeyPress={(e) => e.key === 'Enter' && analyzeTrack()}
            />
            <button
              onClick={analyzeTrack}
              disabled={loading || !trackUrl}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black font-bold px-8 py-3 rounded-lg transition-all"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-12 border border-green-500/20 text-center">
            <Loader className="w-16 h-16 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-xl">Analyzing track...</p>
          </div>
        )}

        {/* Results */}
        {trackData && audioFeatures && !loading && (
          <div className="space-y-6">
            {/* Track Info Card */}
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-6 border border-green-500/20">
              <div className="flex gap-6">
                {trackData.album.images[0] && (
                  <img 
                    src={trackData.album.images[0].url} 
                    alt={trackData.name}
                    className="w-40 h-40 rounded-lg shadow-2xl"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-white mb-2">{trackData.name}</h2>
                  <p className="text-xl text-gray-300 mb-2">{trackData.artists.map(a => a.name).join(', ')}</p>
                  <p className="text-gray-400 mb-4">{trackData.album.name}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span>Duration: {formatDuration(trackData.duration_ms)}</span>
                    <span>•</span>
                    <span>Popularity: {trackData.popularity}/100</span>
                    <span>•</span>
                    <span>{trackData.album.release_date}</span>
                  </div>
                  {trackData.preview_url && (
                    <audio controls className="mt-4 w-full">
                      <source src={trackData.preview_url} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              </div>
            </div>

            {/* Key & Tempo - Big Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key */}
              <div className="bg-gradient-to-br from-purple-600 to-purple-900 rounded-2xl p-8 border border-purple-400/20 text-center">
                <Activity className="w-12 h-12 text-white mx-auto mb-4 opacity-80" />
                <p className="text-purple-200 text-sm uppercase tracking-wider mb-2">Musical Key</p>
                <p className="text-7xl font-bold text-white mb-2">{getKeyName(audioFeatures.key)}</p>
                <p className="text-3xl text-purple-200">{audioFeatures.mode === 1 ? 'Major' : 'Minor'}</p>
              </div>

              {/* Tempo */}
              <div className="bg-gradient-to-br from-green-600 to-green-900 rounded-2xl p-8 border border-green-400/20 text-center">
                <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <div className="w-8 h-8 bg-white rounded-full animate-pulse"></div>
                </div>
                <p className="text-green-200 text-sm uppercase tracking-wider mb-2">Tempo</p>
                <p className="text-7xl font-bold text-white mb-2">{Math.round(audioFeatures.tempo)}</p>
                <p className="text-3xl text-green-200">BPM</p>
              </div>
            </div>

            {/* Audio Characteristics */}
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-6 border border-green-500/20">
              <h3 className="text-2xl font-bold text-white mb-4">Audio Characteristics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Energy</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full" style={{ width: `${audioFeatures.energy * 100}%` }}></div>
                    </div>
                    <span className="text-white font-bold">{(audioFeatures.energy * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{getEnergyDescription(audioFeatures.energy)}</p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Danceability</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full" style={{ width: `${audioFeatures.danceability * 100}%` }}></div>
                    </div>
                    <span className="text-white font-bold">{(audioFeatures.danceability * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{getDanceabilityDescription(audioFeatures.danceability)}</p>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Valence (Mood)</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-yellow-500 h-full" style={{ width: `${audioFeatures.valence * 100}%` }}></div>
                    </div>
                    <span className="text-white font-bold">{(audioFeatures.valence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{getValenceDescription(audioFeatures.valence)}</p>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="bg-black/50 backdrop-blur-lg rounded-2xl p-6 border border-green-500/20">
              <h3 className="text-2xl font-bold text-white mb-4">Technical Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-300">
                <div>
                  <p className="text-gray-400 text-sm">Time Signature</p>
                  <p className="text-xl font-bold text-white">{audioFeatures.time_signature}/4</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Loudness</p>
                  <p className="text-xl font-bold text-white">{audioFeatures.loudness?.toFixed(1)} dB</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Acousticness</p>
                  <p className="text-xl font-bold text-white">{(audioFeatures.acousticness * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Instrumentalness</p>
                  <p className="text-xl font-bold text-white">{(audioFeatures.instrumentalness * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Liveness</p>
                  <p className="text-xl font-bold text-white">{(audioFeatures.liveness * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Speechiness</p>
                  <p className="text-xl font-bold text-white">{(audioFeatures.speechiness * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={downloadTrack}
              disabled={downloading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 disabled:from-gray-600 disabled:to-gray-800 text-white font-bold py-4 px-8 rounded-lg transition-all flex items-center justify-center gap-3 text-lg"
            >
              <Download className="w-6 h-6" />
              {downloading ? 'Downloading...' : 'Download MP3 + Metadata'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Downloads both the audio file and a detailed info file with all analysis data
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyAnalyzer;
