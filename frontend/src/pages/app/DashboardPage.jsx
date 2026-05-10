import { useEffect, useState } from 'react'
import { getUserStats } from '../../api/statsApi'

function DashboardPage() {
    const [importedStats, setImportedStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const activeUserId = localStorage.getItem('userId')

    useEffect(() => {
        async function loadDashboardStats() {
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
                setError('Dashboard statistics could not be loaded.')
                setImportedStats(null)
            } finally {
                setLoading(false)
            }
        }

        loadDashboardStats()
    }, [activeUserId])

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Dashboard</h2>
                <p className="empty-stats-message">
                    Loading your music overview...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Dashboard</h2>
                <p className="date-filter-error">
                    {error}
                </p>
            </div>
        )
    }

    if (!importedStats) {
        return (
            <div className="all-time-section">
                <h2>Dashboard</h2>
                <p className="empty-stats-message">
                    No imported Spotify history found yet. Go to Profile / Import and upload your ZIP file.
                </p>
            </div>
        )
    }

    const topArtist = importedStats.top10Artists?.[0]
    const topTrack = importedStats.top10Tracks?.[0]
    const topAlbum = importedStats.top10Albums?.[0]

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Dashboard</h2>
                    <p>
                        A short overview of your imported Spotify listening history.
                    </p>
                    <p className="period-label">
                        Current period: All time
                    </p>
                </div>

                <div className="all-time-summary">
                    <strong>{importedStats.totalPlays}</strong>
                    <span>plays</span>
                </div>
            </div>

            <div className="overview-grid">
                <div className="overview-card">
                    <span>Total plays</span>
                    <strong>{importedStats.totalPlays}</strong>
                </div>

                <div className="overview-card">
                    <span>Total listening time</span>
                    <strong>{importedStats.totalHoursPlayed} hours</strong>
                </div>

                <div className="overview-card">
                    <span>Top artist</span>
                    <strong>{topArtist?.artistName || 'No data'}</strong>
                </div>

                <div className="overview-card">
                    <span>Top track</span>
                    <strong>{topTrack?.trackName || 'No data'}</strong>
                </div>

                <div className="overview-card">
                    <span>Top album</span>
                    <strong>{topAlbum?.albumName || 'No data'}</strong>
                </div>
            </div>

            <div className="all-time-panel dashboard-insight">
                <h3>Your music insight</h3>

                <strong>
                    {topArtist
                        ? `You listen a lot to ${topArtist.artistName}`
                        : 'Waiting for more data'}
                </strong>

                <p>
                    {topArtist
                        ? `Your imported history shows a strong preference for ${topArtist.artistName}, based on your all-time listening activity.`
                        : 'Upload your Spotify history to generate a personalized listening insight.'}
                </p>
            </div>
        </div>
    )
}

export default DashboardPage