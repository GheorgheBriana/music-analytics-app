import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

function SpotifyLivePage() {
    const [topTracks, setTopTracks] = useState([])
    const [topArtists, setTopArtists] = useState([])
    const [recentTracks, setRecentTracks] = useState([])

    const [timeRange, setTimeRange] = useState('long_term')
    const [activeTab, setActiveTab] = useState('tracks')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
   
    const { user } = useAuth()
    const activeUserId = user?.id || localStorage.getItem('userId')
    const authType = localStorage.getItem('authType')
    const isSpotifyMode = authType === 'spotify' || (user?.spotifyUserId && user.spotifyUserId.trim() !== '')

    useEffect(() => {
        async function loadSpotifyLiveData() {
            if (!activeUserId) {
                setError('No logged-in user was found.')
                setLoading(false)
                return
            }

            if (!isSpotifyMode) {
                setError('Spotify Live is available only for Spotify-connected accounts.')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError('')

                const [tracksResponse, artistsResponse, recentResponse] = await Promise.all([
                    fetch(`http://localhost:8080/api/spotify-data/${activeUserId}/top-tracks?timeRange=${timeRange}`),
                    fetch(`http://localhost:8080/api/spotify-data/${activeUserId}/top-artists?timeRange=${timeRange}`),
                    fetch(`http://localhost:8080/api/spotify-data/${activeUserId}/recently-played`)
                ])

                if (!tracksResponse.ok || !artistsResponse.ok || !recentResponse.ok) {
                    throw new Error('Could not load Spotify live data.')
                }

                const tracksData = await tracksResponse.json()
                const artistsData = await artistsResponse.json()
                const recentData = await recentResponse.json()

                setTopTracks(tracksData.items || [])
                setTopArtists(artistsData.items || [])

                const recentlyPlayedTracks = recentData.items
                    ? recentData.items.map((item) => item.track)
                    : []

                setRecentTracks(recentlyPlayedTracks)
            } catch (error) {
                setError('Spotify live data could not be loaded. Please reconnect with Spotify if the token expired.')
                setTopTracks([])
                setTopArtists([])
                setRecentTracks([])
            } finally {
                setLoading(false)
            }
        }

        loadSpotifyLiveData()
    }, [activeUserId, timeRange, isSpotifyMode])

    function getSpotifyArtists(track) {
        return track?.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist'
    }

    function renderEmptyMessage(message) {
        return (
            <p className="empty-stats-message">
                {message}
            </p>
        )
    }

    function renderTracks() {
        if (topTracks.length === 0) {
            return renderEmptyMessage('No Spotify top tracks available yet.')
        }

        return (
            <div className="ranking-list">
                {topTracks.map((track, index) => (
                    <div className="ranking-item" key={`${track.id}-${index}`}>
                        <span>{index + 1}</span>

                        <div>
                            <strong>{track.name}</strong>
                            <p>{getSpotifyArtists(track)}</p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    function renderArtists() {
        if (topArtists.length === 0) {
            return renderEmptyMessage('No Spotify top artists available yet.')
        }

        return (
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
        )
    }

    function renderRecentlyPlayed() {
        if (recentTracks.length === 0) {
            return renderEmptyMessage('No recently played tracks available yet.')
        }

        return (
            <div className="ranking-list">
                {recentTracks.map((track, index) => (
                    <div className="ranking-item" key={`${track.id}-${index}`}>
                        <span>{index + 1}</span>

                        <div>
                            <strong>{track.name}</strong>
                            <p>{getSpotifyArtists(track)}</p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    function renderActiveTab() {
        if (activeTab === 'tracks') {
            return renderTracks()
        }

        if (activeTab === 'artists') {
            return renderArtists()
        }

        if (activeTab === 'recent') {
            return renderRecentlyPlayed()
        }

        return renderTracks()
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Spotify Live</h2>
                <p className="empty-stats-message">
                    Loading live Spotify data...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Spotify Live</h2>
                <p className="date-filter-error">
                    {error}
                </p>
            </div>
        )
    }

    const topTrack = topTracks[0]
    const topArtist = topArtists[0]
    const recentTrack = recentTracks[0]

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Spotify Live</h2>
                    <p>
                        Data loaded directly from Spotify API for your connected account.
                    </p>
                    <p className="period-label">
                        Current Spotify range: {timeRange}
                    </p>
                </div>

                <div className="all-time-summary">
                    <strong>{topTracks.length}</strong>
                    <span>tracks loaded</span>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-box">
                    <span className="stat-label">Top Spotify track</span>
                    <strong>{topTrack ? topTrack.name : 'Not available yet'}</strong>
                    <small>{getSpotifyArtists(topTrack)}</small>
                </div>

                <div className="stat-box">
                    <span className="stat-label">Top Spotify artist</span>
                    <strong>{topArtist ? topArtist.name : 'Not available yet'}</strong>
                </div>

                <div className="stat-box">
                    <span className="stat-label">Recently played</span>
                    <strong>{recentTrack ? recentTrack.name : 'Not available yet'}</strong>
                    <small>{getSpotifyArtists(recentTrack)}</small>
                </div>

                <div className="stat-box">
                    <span className="stat-label">Main genre</span>
                    <strong>{topArtist?.genres?.[0] || 'Not available yet'}</strong>
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
                    className={activeTab === 'tracks' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('tracks')}
                >
                    Top Tracks
                </button>

                <button
                    className={activeTab === 'artists' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('artists')}
                >
                    Top Artists
                </button>

                <button
                    className={activeTab === 'recent' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('recent')}
                >
                    Recently Played
                </button>
            </div>

            <div className="ranking-section">
                {activeTab === 'tracks' && <h2>Top Tracks from Spotify</h2>}
                {activeTab === 'artists' && <h2>Top Artists from Spotify</h2>}
                {activeTab === 'recent' && <h2>Recently Played</h2>}

                {renderActiveTab()}
            </div>
        </div>
    )
}

export default SpotifyLivePage