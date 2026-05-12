import { useEffect, useState } from 'react'
import { getUserStats } from '../../api/statsApi'

function AnalyticsPage() {
    const [importedStats, setImportedStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState('tracks')

    const activeUserId = localStorage.getItem('userId')

    useEffect(() => {
        async function loadAnalyticsStats() {
            if (!activeUserId) {
                setError('No logged-in user was found.')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError('')

                const data = await getUserStats(activeUserId)
                setImportedStats(data)
            } catch (error) {
                setError('Analytics statistics could not be loaded.')
                setImportedStats(null)
            } finally {
                setLoading(false)
            }
        }

        loadAnalyticsStats()
    }, [activeUserId])

    function formatMinutes(msPlayed) {
        if (!msPlayed) {
            return 0
        }

        return Math.round(msPlayed / 1000 / 60)
    }

    function renderEmptyMessage(message) {
        return (
            <p className="empty-stats-message">
                {message}
            </p>
        )
    }

    function renderTracks() {
        const tracks = importedStats?.top10Tracks || []

        if (tracks.length === 0) {
            return renderEmptyMessage('No tracks found yet.')
        }

        return (
            <div className="compact-ranking-list">
                {tracks.map((track, index) => (
                    <div
                        className="compact-ranking-item"
                        key={`${track.trackName}-${track.artistName}-${index}`}
                    >
                        <span>{index + 1}</span>

                        <div>
                            <strong>{track.trackName}</strong>
                            <p>
                                {track.artistName} · {track.playCount} plays · {formatMinutes(track.totalMsPlayed)} min
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    function renderArtists() {
        const artists = importedStats?.top10Artists || []

        if (artists.length === 0) {
            return renderEmptyMessage('No artists found yet.')
        }

        return (
            <div className="compact-ranking-list">
                {artists.map((artist, index) => (
                    <div
                        className="compact-ranking-item"
                        key={`${artist.artistName}-${index}`}
                    >
                        <span>{index + 1}</span>

                        <div>
                            <strong>{artist.artistName}</strong>
                            <p>
                                {artist.playCount} plays · {formatMinutes(artist.totalMsPlayed)} min
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    function renderAlbums() {
        const albums = importedStats?.top10Albums || []

        if (albums.length === 0) {
            return renderEmptyMessage('No albums found yet.')
        }

        return (
            <div className="compact-ranking-list">
                {albums.map((album, index) => (
                    <div
                        className="compact-ranking-item"
                        key={`${album.albumName}-${album.artistName}-${index}`}
                    >
                        <span>{index + 1}</span>

                        <div>
                            <strong>{album.albumName}</strong>
                            <p>
                                {album.artistName} · {album.playCount} plays · {formatMinutes(album.totalMsPlayed)} min
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    function renderArtistsByYear() {
        const artistsByYear = importedStats?.topArtistsByYear || []

        if (artistsByYear.length === 0) {
            return renderEmptyMessage('No yearly artist statistics found yet.')
        }

        return (
            <div className="compact-ranking-list">
                {artistsByYear.map((artist, index) => (
                    <div
                        className="compact-ranking-item"
                        key={`${artist.year}-${artist.artistName}-${index}`}
                    >
                        <span>{index + 1}</span>

                        <div>
                            <strong>{artist.year} · {artist.artistName}</strong>
                            <p>
                                {artist.playCount} plays · {formatMinutes(artist.totalMsPlayed)} min
                            </p>
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

        if (activeTab === 'albums') {
            return renderAlbums()
        }

        if (activeTab === 'artistsByYear') {
            return renderArtistsByYear()
        }

        return renderTracks()
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Analytics</h2>
                <p className="empty-stats-message">
                    Loading your music analytics...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Analytics</h2>
                <p className="date-filter-error">
                    {error}
                </p>
            </div>
        )
    }

    if (!importedStats) {
        return (
            <div className="all-time-section">
                <h2>Analytics</h2>
                <p className="empty-stats-message">
                    No imported Spotify history found yet. Go to Profile / Import and upload your ZIP file.
                </p>
            </div>
        )
    }

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Analytics</h2>
                    <p>
                        Detailed rankings generated from your imported Spotify listening history.
                    </p>
                    <p className="period-label">
                        Current period: All time
                    </p>
                </div>

                <div className="all-time-summary">
                    <strong>{importedStats.totalPlays}</strong>
                    <span>plays analyzed</span>
                </div>
            </div>

            <div className="section-tabs">
                <button
                    className={activeTab === 'tracks' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('tracks')}
                >
                    Tracks
                </button>

                <button
                    className={activeTab === 'artists' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('artists')}
                >
                    Artists
                </button>

                <button
                    className={activeTab === 'albums' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('albums')}
                >
                    Albums
                </button>

                <button
                    className={activeTab === 'artistsByYear' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setActiveTab('artistsByYear')}
                >
                    Artists by Year
                </button>
            </div>

            <div className="accordion-content">
                {renderActiveTab()}
            </div>
        </div>
    )
}

export default AnalyticsPage