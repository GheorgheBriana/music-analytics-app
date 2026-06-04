import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

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
Predicted top artist: ${predictions.predictedTopArtist?.name || 'No data'} (Confidence: ${(predictions.predictedTopArtist?.confidence * 100).toFixed(1)}%)
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

    if (!predictions || !predictions.predictedTopArtist || predictions.predictedTopArtist.name === 'No data yet') {
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
        <div className="all-time-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="all-time-header">
                <div>
                    <h2>Predictions</h2>
                    <p>
                        Advanced statistical predictions generated from your imported listening history in the Data Warehouse.
                    </p>
                    <p className="period-label">
                        Based on historical linear regressions, PMFs, and Z-score anomaly models.
                    </p>
                </div>

                <div className="all-time-summary" style={{ color: trendColor, background: 'rgba(255, 255, 255, 0.05)', padding: '16px 24px', borderRadius: '18px', border: '1px solid ' + trendColor + '33' }}>
                    <strong style={{ fontSize: '36px', display: 'block', lineHeight: 1 }}>{trendIcon}</strong>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{trendLabel}</span>
                </div>
            </div>

            <div className="overview-grid">
                <div className="overview-card" style={{ position: 'relative' }}>
                    <span>Predicted top artist</span>
                    <strong>{predictions.predictedTopArtist.name}</strong>
                    <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}
                        title="Calculated probability that this artist will remain your top artist, prioritizing your most recent listens."
                    >
                        <span style={{ fontSize: '11px', color: '#a8a8b8', borderBottom: '1px dotted #a8a8b8', cursor: 'help' }}>
                            Prediction confidence
                        </span>
                        <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: predictions.predictedTopArtist.confidenceLabel === 'HIGH' ? '#1db954' : predictions.predictedTopArtist.confidenceLabel === 'MEDIUM' ? '#ffc107' : '#ff4d6d' 
                        }}>
                            {(predictions.predictedTopArtist.confidence * 100).toFixed(1)}% ({
                                predictions.predictedTopArtist.confidenceLabel === 'HIGH' 
                                    ? 'High' 
                                    : predictions.predictedTopArtist.confidenceLabel === 'MEDIUM' 
                                        ? 'Medium' 
                                        : 'Low'
                            })
                        </span>
                    </div>
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

            {/* LINEAR REGRESSION TREND AND PROJECTION CHART */}
            {predictions.trend && predictions.trend.historicalSeries?.length > 0 && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Listening Evolution & Linear Regression</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a8a8b8' }}>
                                Least-squares regression fitted on monthly play counts. Solid line = actual, dashed = 3-month projection.
                            </p>
                        </div>
                        <span style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                            background: predictions.trend.confidenceLabel === 'HIGH' ? 'rgba(29,185,84,0.15)'
                                      : predictions.trend.confidenceLabel === 'MEDIUM' ? 'rgba(255,193,7,0.15)'
                                      : 'rgba(255,77,109,0.15)',
                            color: predictions.trend.confidenceLabel === 'HIGH' ? '#1db954'
                                 : predictions.trend.confidenceLabel === 'MEDIUM' ? '#ffc107' : '#ff4d6d',
                            border: '1px solid ' + (predictions.trend.confidenceLabel === 'HIGH' ? 'rgba(29,185,84,0.3)' : predictions.trend.confidenceLabel === 'MEDIUM' ? 'rgba(255,193,7,0.3)' : 'rgba(255,77,109,0.3)')
                        }}>
                            R² = {predictions.trend.rSquared.toFixed(3)} ({predictions.trend.confidenceLabel} FIT)
                        </span>
                    </div>

                    <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                                data={[
                                    ...predictions.trend.historicalSeries.map(p => ({...p, actual: p.actual === -1 ? null : p.actual})),
                                    ...predictions.trend.projectedSeries.map(p => ({...p, actual: null}))
                                ]}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="label" stroke="#a3a3a3" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#a3a3a3" tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} 
                                    formatter={(value, name) => [value === null || value === -1 ? 'N/A' : Math.round(value), name === 'actual' ? 'Actual Plays' : 'Fitted Regression']}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="actual" stroke="#1db954" strokeWidth={3} name="Actual Monthly Plays" dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} />
                                <Line type="monotone" dataKey="fitted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Linear Regression + 3mo Projection" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* FORECAST NEXT MONTH */}
            {predictions.nextMonthForecast && predictions.nextMonthForecast.predictedPlays > 0 && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ margin: 0 }}>Statistical Forecast: {predictions.nextMonthForecast.periodLabel}</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
                        <strong style={{ fontSize: '48px', color: '#1db954', lineHeight: 1 }}>
                            ~{predictions.nextMonthForecast.predictedPlays}
                        </strong>
                        <span style={{ color: '#a8a8b8', fontSize: '14px', fontWeight: 'bold' }}>predicted plays</span>
                    </div>
                    <p style={{ margin: 0, color: '#c7c7d1', fontSize: '14px' }}>
                        Calculated using the Standard Error of Estimate with a **95% Confidence Interval**:
                    </p>
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content', fontWeight: 'bold', fontSize: '15px' }}>
                        🔓 {predictions.nextMonthForecast.lowerBound} – {predictions.nextMonthForecast.upperBound} plays
                    </div>
                </div>
            )}

            {/* PROBABILITY DISTRIBUTIONS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {/* DAY OF WEEK PROBABILITY */}
                {predictions.dayOfWeekProbabilities && Object.keys(predictions.dayOfWeekProbabilities).length > 0 && (
                    <div className="all-time-panel" style={{ padding: '20px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <h3 style={{ margin: '0 0 12px' }}>Day of Week Distribution (PMF)</h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(predictions.dayOfWeekProbabilities).map(([day, prob]) => ({ day, prob: prob * 100 }))} margin={{ left: -25 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" stroke="#a3a3a3" tick={{ fontSize: 10 }} />
                                    <YAxis stroke="#a3a3a3" tick={{ fontSize: 10 }} unit="%" />
                                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                                    <Bar dataKey="prob" fill="#1db954" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* HOUR PROBABILITY */}
                {predictions.hourProbabilities && Object.keys(predictions.hourProbabilities).length > 0 && (
                    <div className="all-time-panel" style={{ padding: '20px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <h3 style={{ margin: '0 0 12px' }}>Hour of Day Distribution (PMF)</h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(predictions.hourProbabilities).map(([hour, prob]) => ({ hour: `${hour}:00`, prob: prob * 100 }))} margin={{ left: -25 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="hour" stroke="#a3a3a3" tick={{ fontSize: 9 }} interval={2} />
                                    <YAxis stroke="#a3a3a3" tick={{ fontSize: 10 }} unit="%" />
                                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => `${Number(v).toFixed(2)}%`} />
                                    <Bar dataKey="prob" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* ANOMALIES DETECTED VIA Z-SCORE */}
            {predictions.anomalies && predictions.anomalies.length > 0 && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ margin: '0 0 4px' }}>Detected Activity Anomalies (Z-Score &gt; 2.0)</h3>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#a8a8b8' }}>
                        Months displaying statistically significant deviations (peaks or drops) from your standard historical listening volume.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {predictions.anomalies.map((a, i) => (
                            <div key={i} style={{
                                padding: '12px 16px', 
                                background: 'rgba(255,255,255,0.02)',
                                borderLeft: `4px solid ${a.type === 'PEAK' ? '#1db954' : '#ff4d6d'}`,
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <strong style={{ fontSize: '15px', color: '#fff' }}>{a.periodLabel}</strong>
                                    <span style={{ marginLeft: '12px', fontSize: '13px', color: '#a3a3a3' }}>
                                        Plays analyzed: {Math.round(a.plays)}
                                    </span>
                                </div>
                                <span style={{ 
                                    padding: '4px 10px', 
                                    borderRadius: '12px', 
                                    fontSize: '12px', 
                                    fontWeight: 'bold',
                                    background: a.type === 'PEAK' ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 77, 109, 0.15)',
                                    color: a.type === 'PEAK' ? '#1db954' : '#ff4d6d'
                                }}>
                                    {a.type === 'PEAK' ? '▲ PEAK ACTIVITY' : '▼ DROP ACTIVITY'} (z = {a.zScore > 0 ? '+' + a.zScore : a.zScore})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* GENRE TRAJECTORIES */}
            {((predictions.risingGenres && predictions.risingGenres.length > 0) || 
              (predictions.fadingGenres && predictions.fadingGenres.length > 0)) && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ margin: '0 0 4px' }}>Genre Trajectories (Least-Squares Regression per Category)</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#a8a8b8' }}>
                        Multi-series slope calculations applied to individual genre listening histories to isolate emerging interests vs fading favorites.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <h4 style={{ color: '#1db954', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px' }}>
                                <span>↗</span> Rising Music DNA
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {predictions.risingGenres && predictions.risingGenres.length > 0 ? (
                                    predictions.risingGenres.map((g, i) => (
                                        <div key={i} style={{ padding: '12px', background: 'rgba(29, 185, 84, 0.06)', border: '1px solid rgba(29, 185, 84, 0.15)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong style={{ color: '#fff', fontSize: '14px' }}>{g.genreName}</strong>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a8a8b8' }}>Monthly avg: {g.currentMonthlyAvg} plays</p>
                                            </div>
                                            <span style={{ color: '#1db954', fontWeight: 'bold', fontSize: '13px' }}>+{g.slope} plays/mo</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="empty-stats-message">No rising genres detected.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 style={{ color: '#ff4d6d', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px' }}>
                                <span>↘</span> Fading Music DNA
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {predictions.fadingGenres && predictions.fadingGenres.length > 0 ? (
                                    predictions.fadingGenres.map((g, i) => (
                                        <div key={i} style={{ padding: '12px', background: 'rgba(255, 77, 109, 0.06)', border: '1px solid rgba(255, 77, 109, 0.15)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong style={{ color: '#fff', fontSize: '14px' }}>{g.genreName}</strong>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a8a8b8' }}>Monthly avg: {g.currentMonthlyAvg} plays</p>
                                            </div>
                                            <span style={{ color: '#ff4d6d', fontWeight: 'bold', fontSize: '13px' }}>{g.slope} plays/mo</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="empty-stats-message">No fading genres detected.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WRAPPED/TREND INSIGHT */}
            <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Behavioral Synthesis</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '48px', color: trendColor, lineHeight: 1 }}>{trendIcon}</span>
                    <div>
                        <strong style={{ fontSize: '20px', color: trendColor }}>
                            Listening behavior is {trendLabel.toLowerCase()}
                        </strong>
                        <p style={{ margin: '6px 0 0', color: '#c7c7d1', fontSize: '15px' }}>
                            {changePercent === 0
                                ? 'Your overall listening activity remains statistically steady compared to the previous recorded period.'
                                : changePercent > 0
                                    ? `You are listening ${Math.abs(changePercent)}% more than the previous comparable period. Your engagement with music is growing exponentially.`
                                    : `You are listening ${Math.abs(changePercent)}% less than the previous comparable period.`
                            }
                        </p>
                    </div>
                </div>
                <p style={{ margin: '8px 0 0 0', color: '#c7c7d1', fontSize: '14px', lineHeight: 1.5 }}>
                    Your peak listening density usually concentrates on **{predictions.mostActiveDayOfWeek}s** around **{formatHour(predictions.mostActiveHour)}**, showing a stable habit. 
                    Across your history, **{predictions.mostActiveMonth}** is your most active month, and your predicted top artist for the coming period is **{predictions.predictedTopArtist.name}**.
                </p>
            </div>

            {/* SHARE ACTION PANEL */}
            <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Copy My Summary</h3>
                <p style={{ margin: 0, color: '#a8a8b8', fontSize: '14px' }}>
                    Generate a formatted statistical summary of your predictions that can be copied directly to your clipboard.
                </p>
                <button className="primary-btn" onClick={handleSharePredictions} style={{ width: 'fit-content' }}>
                    Copy My Summary
                </button>
                {shareStatus && (
                    <p style={{ marginTop: '4px', color: '#1db954', fontSize: '14px', fontWeight: 'bold' }}>
                        {shareStatus}
                    </p>
                )}
            </div>
        </div>
    )
}

export default PredictionsPage