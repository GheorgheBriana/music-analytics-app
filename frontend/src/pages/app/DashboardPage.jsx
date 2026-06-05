import { useEffect, useState } from 'react'
import { getUserStats } from '../../api/statsApi'
import { useAuth } from '../../contexts/AuthContext'

function DashboardPage() {
    const { user } = useAuth()
    const activeUserId = user?.id || localStorage.getItem('userId')
    const [importedStats, setImportedStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

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
                    No imported Spotify history found yet. Go to Import ZIP and upload your file.
                </p>
            </div>
        )
    }

    const topArtist = importedStats.top10Artists?.[0]
    const topTrack = importedStats.top10Tracks?.[0]
    const topAlbum = importedStats.top10Albums?.[0]

    const insight = buildInsight(importedStats, topArtist, topTrack)

    return (
        <div className="all-time-section">
            <div className="dashboard-header">
                <div>
                    <h2>Dashboard</h2>
                    <p className="dashboard-sub">
                        A short overview of your imported Spotify listening history.
                    </p>
                </div>
                
                {/* Repus contorul mare de plays în dreapta-sus */}
                <div className="all-time-summary">
                    <strong>{importedStats.totalPlays?.toLocaleString()}</strong>
                    <span>plays</span>
                </div>
            </div>

            {/* ── STATS GRID (4 carduri egale, aliniate la stânga) ── */}
            <div className="dashboard-grid">
                <div className="dash-card">
                    <span className="dash-label">Listening time</span>
                    <strong className="dash-value">{importedStats.totalHoursPlayed} hours</strong>
                </div>

                <div className="dash-card" title={topArtist?.artistName || 'No data'}>
                    <span className="dash-label">Top artist</span>
                    <strong className="dash-value">{topArtist?.artistName || '—'}</strong>
                </div>

                <div className="dash-card" title={topTrack?.trackName || 'No data'}>
                    <span className="dash-label">Top track</span>
                    <strong className="dash-value">{topTrack?.trackName || '—'}</strong>
                </div>

                <div className="dash-card" title={topAlbum?.albumName || 'No data'}>
                    <span className="dash-label">Top album</span>
                    <strong className="dash-value">{topAlbum?.albumName || '—'}</strong>
                </div>
            </div>

            {/* ── INSIGHT DINAMIC ── */}
            <div className="all-time-panel dashboard-insight">
                <h3>Your music insight</h3>
                <strong className="insight-title">{insight.title}</strong>
                <p className="insight-body">{insight.body}</p>
            </div>

            <style>{`
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .dashboard-sub {
                    color: #8a90a6;
                    font-size: 13.5px;
                    margin: 4px 0 0;
                }
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    align-items: stretch;
                    gap: 14px;
                    margin-bottom: 24px;
                }
                @media (max-width: 950px) {
                    .dashboard-grid { 
                        grid-template-columns: repeat(2, 1fr); 
                    }
                }
                @media (max-width: 550px) {
                    .dashboard-grid { 
                        grid-template-columns: 1fr; 
                    }
                }
                .dash-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    padding: 18px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    height: 100%;
                    box-sizing: border-box;
                    transition: transform 0.25s ease, border-color 0.25s ease;
                }
                .dash-card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(29, 185, 84, 0.2);
                    background: rgba(255, 255, 255, 0.03);
                }
                .dash-label {
                    color: #8a90a6;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: .5px;
                    font-weight: 700;
                }
                .dash-value {
                    color: #fff;
                    font-size: 18px;
                    font-weight: 700;
                    word-break: break-word;
                    line-height: 1.3;
                }
                .dashboard-insight {
                    margin-top: 8px;
                    border-left: 4px solid #1db954;
                    padding-left: 20px;
                }
                .insight-title {
                    display: block;
                    font-size: 16px;
                    color: #1db954;
                    margin-bottom: 8px;
                    font-family: 'Outfit', sans-serif;
                }
                .insight-body {
                    margin: 0;
                    font-size: 14px;
                    color: #aeb3c5;
                    line-height: 1.6;
                }
            `}</style>
        </div>
    )
}

function buildInsight(stats, topArtist, topTrack) {
    const plays = stats.totalPlays || 0
    const hours = stats.totalHoursPlayed || 0

    const artistPlays = topArtist?.playCount
    const artistPct = artistPlays && plays > 0
        ? Math.round((artistPlays / plays) * 100)
        : null

    if (artistPct && artistPct >= 5) {
        return {
            title: `${artistPct}% of your total plays belong to ${topArtist.artistName}`,
            body: `Out of your ${plays.toLocaleString()} total streams, ${artistPlays.toLocaleString()} are tracks by ${topArtist.artistName}. ${hours > 100 ? `You have spent more than ${Math.round(hours)} hours listening to music overall.` : ''}`
        }
    }

    if (topTrack?.trackName && topArtist?.artistName) {
        return {
            title: `${topTrack.trackName} is your signature song`,
            body: `Alongside your favorite artist ${topArtist.artistName}, this song defines your music story. You have registered ${plays.toLocaleString()} plays and ${Math.round(hours)} hours of music.`
        }
    }

    return {
        title: 'Your music history is successfully loaded',
        body: `${plays.toLocaleString()} plays imported. Head to the Evolution and Stats tabs to see your taste developments over time.`
    }
}

export default DashboardPage