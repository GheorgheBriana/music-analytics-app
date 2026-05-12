import { useEffect, useState } from 'react'

const API_BASE_URL = 'http://localhost:8080'

function PredictionsPage() {
    const [predictions, setPredictions] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [shareStatus, setShareStatus] = useState('')

    const activeUserId = localStorage.getItem('userId')

    useEffect(() => {
        async function loadPredictions() {
            if (!activeUserId) {
                setError('No logged-in user was found.')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError('')

                const response = await fetch(
                    `${API_BASE_URL}/api/predictions/user/${activeUserId}`
                )

                if (!response.ok) {
                    throw new Error('Failed to load predictions.')
                }

                const data = await response.json()
                setPredictions(data)
            } catch (err) {
                setError('Predictions could not be loaded.')
            } finally {
                setLoading(false)
            }
        }

        loadPredictions()
    }, [activeUserId])

    function formatHour(hour) {
        if (hour === null || hour === undefined) return 'No data'
        if (hour === 0) return '12:00 AM'
        if (hour < 12) return `${hour}:00 AM`
        if (hour === 12) return '12:00 PM'
        return `${hour - 12}:00 PM`
    }

    function getTrendColor(trend) {
        if (trend === 'INCREASING') return '#1db954'
        if (trend === 'DECREASING') return '#ff4d6d'
        return '#c7c7d1'
    }

    function getTrendIcon(trend) {
        if (trend === 'INCREASING') return '↑'
        if (trend === 'DECREASING') return '↓'
        return '→'
    }

    function getTrendLabel(trend) {
        if (trend === 'INCREASING') return 'Increasing'
        if (trend === 'DECREASING') return 'Decreasing'
        return 'Stable'
    }

    async function handleSharePredictions() {
        if (!predictions) return

        const shareText = `My All-Time Wrapped predictions:
Predicted top artist: ${predictions.predictedTopArtist}
Most likely listening day: ${predictions.mostActiveDayOfWeek}
Predicted peak listening time: ${formatHour(predictions.mostActiveHour)}
Most likely active month: ${predictions.mostActiveMonth}
Listening trend: ${getTrendLabel(predictions.listeningTrend)}

Generated with All-Time Wrapped.`

        try {
            await navigator.clipboard.writeText(shareText)
            setShareStatus('Summary copied! You can now share your predictions.')
        } catch (err) {
            setShareStatus('The summary could not be copied automatically.')
        }
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Predictions</h2>
                <p className="empty-stats-message">
                    Analyzing your listening behavior...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Predictions</h2>
                <p className="date-filter-error">{error}</p>
            </div>
        )
    }

    if (!predictions || predictions.predictedTopArtist === 'No data yet') {
        return (
            <div className="all-time-section">
                <h2>Predictions</h2>
                <p className="empty-stats-message">
                    No imported Spotify history found yet. Go to Profile / Import and upload your ZIP file.
                </p>
            </div>
        )
    }

    const trendColor = getTrendColor(predictions.listeningTrend)
    const trendIcon = getTrendIcon(predictions.listeningTrend)
    const trendLabel = getTrendLabel(predictions.listeningTrend)
    const changePercent = predictions.listeningChangePercent ?? 0

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Predictions</h2>

                    <p>
                        Personalized predictions generated from your imported listening history.
                    </p>

                    <p className="period-label">
                        Based on historical listening patterns and recent activity.
                    </p>
                </div>

                <div className="all-time-summary" style={{ color: trendColor }}>
                    <strong style={{ fontSize: '36px' }}>{trendIcon}</strong>
                    <span>{trendLabel}</span>
                </div>
            </div>

            <div className="overview-grid" style={{ marginBottom: '24px' }}>
                <div className="overview-card">
                    <span>Predicted top artist</span>

                    <strong>{predictions.predictedTopArtist}</strong>

                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        Based on the last 3 months available in your history
                    </small>
                </div>

                <div className="overview-card">
                    <span>Most likely listening day</span>

                    <strong>{predictions.mostActiveDayOfWeek}</strong>

                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        Predicted from your weekly listening pattern
                    </small>
                </div>

                <div className="overview-card">
                    <span>Predicted peak listening time</span>

                    <strong>{formatHour(predictions.mostActiveHour)}</strong>

                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        The hour when you are most likely to listen
                    </small>
                </div>

                <div className="overview-card">
                    <span>Most likely active month</span>

                    <strong>{predictions.mostActiveMonth}</strong>

                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        Predicted from your activity across all years
                    </small>
                </div>
            </div>

            <div className="all-time-panel" style={{ marginBottom: '18px' }}>
                <h3>Listening Trend</h3>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        marginTop: '12px'
                    }}
                >
                    <span
                        style={{
                            fontSize: '48px',
                            color: trendColor,
                            lineHeight: 1
                        }}
                    >
                        {trendIcon}
                    </span>

                    <div>
                        <strong style={{ fontSize: '20px', color: trendColor }}>
                            {trendLabel}
                        </strong>

                        <p style={{ margin: '6px 0 0', color: '#c7c7d1', fontSize: '15px' }}>
                            {changePercent === 0
                                ? 'Your listening activity is similar to the previous comparable year.'
                                : changePercent > 0
                                    ? `You are listening ${Math.abs(changePercent)}% more than the previous comparable year. Your music engagement is growing.`
                                    : `You are listening ${Math.abs(changePercent)}% less than the previous comparable year.`
                            }
                        </p>
                    </div>
                </div>
            </div>

            <div className="all-time-panel dashboard-insight" style={{ marginBottom: '18px' }}>
                <h3>Behavior Insight</h3>

                <strong>
                    You are most likely to listen to music on {predictions.mostActiveDayOfWeek}s
                </strong>

                <p>
                    Based on your listening history, your peak activity usually happens on{' '}
                    {predictions.mostActiveDayOfWeek}s around {formatHour(predictions.mostActiveHour)}.
                    Your most active month across the imported history is {predictions.mostActiveMonth},
                    and your predicted top artist for the coming period is{' '}
                    <strong>{predictions.predictedTopArtist}</strong>.
                </p>
            </div>

            <div className="all-time-panel">
                <h3>Shareable Summary</h3>

                <p>
                    Generate a short summary of your predictions that can be copied and shared.
                </p>

                <button className="primary-btn" onClick={handleSharePredictions}>
                    Share my predictions
                </button>

                {shareStatus && (
                    <p style={{ marginTop: '12px', color: '#c7c7d1', fontSize: '14px' }}>
                        {shareStatus}
                    </p>
                )}
            </div>
        </div>
    )
}

export default PredictionsPage