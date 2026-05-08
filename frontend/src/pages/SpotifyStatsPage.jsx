import { useEffect, useState } from 'react'
import './SpotifyStatsPage.css'

function SpotifyStatsPage({ userId, onBackClick }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [uploadStatus, setUploadStatus] = useState('')

    const [topTracks, setTopTracks] = useState([])
    const [topArtists, setTopArtists] = useState([])
    const [recentTracks, setRecentTracks] = useState([])
    const [spotifyStatus, setSpotifyStatus] = useState('Loading Spotify data...')

    const [activeSection, setActiveSection] = useState('tracks')

    const [timeRange, setTimeRange] = useState('long_term')

    const [spotifyProfile, setSpotifyProfile] = useState(null)

    const [importedStats, setImportedStats] = useState(null)

    const activeUserId = localStorage.getItem('userId') || userId

    useEffect(() => {
        const fetchSpotifyData = async () => {
            if (!activeUserId) {
                setSpotifyStatus('No logged-in user was found.')
                return
            }

            try {
                const [tracksResponse, artistsResponse, recentResponse] = await Promise.all([
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/top-tracks?timeRange=${timeRange}`),
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/top-artists?timeRange=${timeRange}`),
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/recently-played`)
                ])

                if (!tracksResponse.ok || !artistsResponse.ok || !recentResponse.ok) {
                    throw new Error('Could not load Spotify data')
                }

                const tracksData = await tracksResponse.json()
                const artistsData = await artistsResponse.json()
                const recentData = await recentResponse.json()

                setTopTracks(tracksData.items || [])
                setTopArtists(artistsData.items || [])

                const recentTracksFromSpotify = recentData.items
                    ? recentData.items.map((item) => item.track)
                    : []

                setRecentTracks(recentTracksFromSpotify)
                setSpotifyStatus('')
            } catch (error) {
                setSpotifyStatus('Spotify data could not be loaded. Please log in with Spotify again.')
            }
        }

        const fetchSpotifyProfile = async () => {
            if (!activeUserId) {
                return
            }

            try {
                const response = await fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/profile`)

                if (!response.ok) {
                    return
                }

                const data = await response.json()
                setSpotifyProfile(data)
            } catch (error) {
                setSpotifyProfile(null)
            }
        }

        const fetchImportedStats = async () => {
            if (!activeUserId) {
                return
            }

            try {
                const response = await fetch(`http://127.0.0.1:8080/api/stats/user/${activeUserId}`)

                if (!response.ok) {
                    return
                }

                const data = await response.json()
                setImportedStats(data)
            } catch (error) {
                setImportedStats(null)
            }
        }

        fetchSpotifyData()
        fetchImportedStats()
        fetchSpotifyProfile()
    }, [activeUserId, timeRange])

    const handleFileChange = (event) => {
        const file = event.target.files[0]
        setSelectedFile(file)
        setUploadStatus('')
    }

    const handleUpload = async () => {
        if (!activeUserId) {
            setUploadStatus('No logged-in user was found. Please connect with Spotify again.')
            return
        }

        if (!selectedFile) {
            setUploadStatus('Please select a Spotify ZIP file first.')
            return
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        try {
            setUploadStatus('Importing your Spotify history...')

            const response = await fetch(
                `http://127.0.0.1:8080/api/import/spotify-zip?userId=${activeUserId}`,
                {
                    method: 'POST',
                    body: formData
                }
            )

            if (!response.ok) {
                throw new Error('Import failed')
            }

            const result = await response.text()
            setUploadStatus(result || 'Spotify history imported successfully.')

            const statsResponse = await fetch(`http://127.0.0.1:8080/api/stats/user/${activeUserId}`)
            const statsData = await statsResponse.json()
            setImportedStats(statsData)
        } catch (error) {
            setUploadStatus('Something went wrong while importing the ZIP file.')
        }
    }

    const topTrack = topTracks[0]
    const topArtist = topArtists[0]
    const recentTrack = recentTracks[0]

    const hasImportedHistory = importedStats && importedStats.totalPlays > 0

    return (
        <div className="stats-page">
            <div className="stats-card">
                <button className="back-btn" onClick={onBackClick}>
                    Back to landing page
                </button>

                <h1>Your Spotify Statistics</h1>

                <p className="stats-subtitle">
                    Spotify account connected successfully. User ID: {activeUserId}
                </p>

                {spotifyProfile && (
                    <div className="profile-card">
                        <h2>Connected Spotify Account</h2>

                        <div className="profile-grid">
                            <div>
                                <span>Username</span>
                                <strong>{spotifyProfile.username || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Email</span>
                                <strong>{spotifyProfile.email || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Country</span>
                                <strong>{spotifyProfile.spotifyCountry || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Account type</span>
                                <strong>{spotifyProfile.spotifyProduct || 'Not available'}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {spotifyStatus && (
                    <p className="stats-status">
                        {spotifyStatus}
                    </p>
                )}

                <div className="stats-grid">
                    <div className="stat-box">
                        <span className="stat-label">Top Spotify track</span>
                        <strong>{topTrack ? topTrack.name : 'Not available yet'}</strong>
                        <small>
                            {topTrack?.artists?.map((artist) => artist.name).join(', ')}
                        </small>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Top Spotify artist</span>
                        <strong>{topArtist ? topArtist.name : 'Not available yet'}</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Recently played</span>
                        <strong>{recentTrack ? recentTrack.name : 'Not available yet'}</strong>
                        <small>
                            {recentTrack?.artists?.map((artist) => artist.name).join(', ')}
                        </small>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Main genre</span>
                        <strong>{topArtist?.genres?.[0] || 'Not available yet'}</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">All-time plays</span>
                        <strong>{hasImportedHistory ? importedStats.totalPlays : 'Requires ZIP import'}</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">All-time listening time</span>
                        <strong>
                            {hasImportedHistory
                                ? `${importedStats.totalHoursPlayed} hours`
                                : 'Requires ZIP import'}
                        </strong>
                    </div>
                </div>

                <div className="time-range-tabs">
                    <button
                        className={timeRange === 'short_term' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setTimeRange('short_term')}
                    >
                        Last 4 weeks
                    </button>

                    <button
                        className={timeRange === 'medium_term' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setTimeRange('medium_term')}
                    >
                        Last 6 months
                    </button>

                    <button
                        className={timeRange === 'long_term' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setTimeRange('long_term')}
                    >
                        Long term
                    </button>
                </div>

                <div className="section-tabs">
                    <button
                        className={activeSection === 'tracks' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveSection('tracks')}
                    >
                        Show Top Tracks
                    </button>
                    <button
                        className={activeSection === 'artists' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveSection('artists')}
                    >
                        Show Top Artists
                    </button>

                    <button
                        className={activeSection === 'recent' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveSection('recent')}
                    >
                        Show Recently Played
                    </button>

                    <button
                        className={activeSection === 'upload' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveSection('upload')}
                    >
                        Upload ZIP
                    </button>
                </div>

                {activeSection === 'tracks' && topTracks.length > 0 && (
                    <div className="ranking-section">
                        <h2>Top Tracks from Spotify</h2>

                        <div className="ranking-list">
                            {topTracks.map((track, index) => (
                                <div className="ranking-item" key={`${track.id}-${index}`}>
                                    <span>{index + 1}</span>
                                    <div>
                                        <strong>{track.name}</strong>
                                        <p>
                                            {track.artists?.map((artist) => artist.name).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'artists' && topArtists.length > 0 && (
                    <div className="ranking-section">
                        <h2>Top Artists from Spotify</h2>

                        <div className="ranking-list">
                            {topArtists.map((artist, index) => (
                                <div className="ranking-item" key={`${artist.id}-${index}`}>
                                    <span>{index + 1}</span>
                                    <div>
                                        <strong>{artist.name}</strong>
                                        <p>
                                            {artist.genres?.length > 0
                                                ? artist.genres.join(', ')
                                                : 'No genre available'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'recent' && recentTracks.length > 0 && (
                    <div className="ranking-section">
                        <h2>Recently Played</h2>

                        <div className="ranking-list">
                            {recentTracks.map((track, index) => (
                                <div className="ranking-item" key={`${track.id}-${index}`}>
                                    <span>{index + 1}</span>
                                    <div>
                                        <strong>{track.name}</strong>
                                        <p>
                                            {track.artists?.map((artist) => artist.name).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'upload' && (
                    <div className="upload-section">
                        <h2>Upload your Spotify history</h2>

                        <p>
                            Spotify login provides recent and top Spotify data. Upload your Spotify ZIP export
                            to generate all-time statistics, yearly statistics and total listening time.
                        </p>

                        <input
                            type="file"
                            accept=".zip"
                            onChange={handleFileChange}
                        />

                        <button className="upload-btn" onClick={handleUpload}>
                            Upload Spotify ZIP
                        </button>

                        {uploadStatus && (
                            <p className="upload-status">
                                {uploadStatus}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default SpotifyStatsPage