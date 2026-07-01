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

    const rSquared = predictions.trend?.rSquared ?? 0
    const variancePercent = (rSquared * 100).toFixed(0)
    const fitLabel = rSquared >= 0.5 
        ? 'strong seasonal fit' 
        : rSquared >= 0.15 
            ? 'moderate seasonal fit' 
            : `explains ${variancePercent}% of variance`
    const fitColor = rSquared >= 0.5 ? '#1db954' : rSquared >= 0.15 ? '#ffc107' : '#a8a8b8'
    const fitBg = rSquared >= 0.5 ? 'rgba(29,185,84,0.1)' : rSquared >= 0.15 ? 'rgba(255,193,7,0.1)' : 'rgba(255,255,255,0.05)'
    const fitBorder = rSquared >= 0.5 ? 'rgba(29,185,84,0.2)' : rSquared >= 0.15 ? 'rgba(255,193,7,0.2)' : 'rgba(255,255,255,0.1)'

    // Compute weekly distribution spread to detect uniform distribution
    const dayProbs = predictions.dayOfWeekProbabilities || {}
    const dayProbValues = Object.values(dayProbs)
    const maxDayProb = dayProbValues.length > 0 ? Math.max(...dayProbValues) : 0
    const minDayProb = dayProbValues.length > 0 ? Math.min(...dayProbValues) : 0
    const isUniformDays = dayProbValues.length > 0 && (maxDayProb - minDayProb) < 0.05

    return (
        <div className="all-time-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="all-time-header">
                <div>
                    <h2>Predictions</h2>
                    <p>
                        Advanced statistical predictions generated from your imported listening history in the Data Warehouse.
                    </p>
                    <p className="period-label">
                        Based on historical trend forecasting, activity patterns, and outlier detection models.
                    </p>
                </div>

                <div className="all-time-summary" style={{ 
                    color: trendColor, 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    padding: '16px 24px', 
                    borderRadius: '18px', 
                    border: '1px solid ' + trendColor + '33',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '120px'
                }}>
                    <strong style={{ fontSize: '36px', display: 'block', lineHeight: 1 }}>{trendIcon}</strong>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{trendLabel}</span>
                </div>
            </div>

            <div className="overview-grid">
                <div className="overview-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>Predicted top artist</span>
                    <strong>{predictions.predictedTopArtist.name}</strong>
                    <small style={{ color: '#a8a8b8', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }} title="Proportion of this artist in your recent decay-weighted history. Low values are typical for diverse listeners.">
                        <span>Recent share: {(predictions.predictedTopArtist.confidence * 100).toFixed(1)}%</span>
                        <span style={{ fontSize: '11px', color: '#888899' }}>
                            {predictions.predictedTopArtist.confidenceLabel === 'HIGH' 
                                ? 'strong dominance' 
                                : predictions.predictedTopArtist.confidenceLabel === 'MEDIUM' 
                                    ? 'moderate dominance' 
                                    : 'balanced rotation'}
                        </span>
                    </small>
                </div>

                <div className="overview-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>Most likely listening day</span>
                    <strong>{predictions.mostActiveDayOfWeek}</strong>
                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        {isUniformDays 
                            ? 'Fairly even across the week' 
                            : 'Predicted peak weekday'
                        }
                    </small>
                </div>

                <div className="overview-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>Predicted peak listening time</span>
                    <strong>{formatHour(predictions.mostActiveHour)}</strong>
                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        Peak hours of activity
                    </small>
                </div>

                <div className="overview-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>Most likely active month</span>
                    <strong>{predictions.mostActiveMonth}</strong>
                    <small style={{ color: '#a8a8b8', fontSize: '12px' }}>
                        Peak month of activity
                    </small>
                </div>
            </div>

            {/* LINEAR REGRESSION TREND AND PROJECTION CHART */}
            {predictions.trend && predictions.trend.historicalSeries?.length > 0 && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Listening Volume Evolution</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a8a8b8' }}>
                                Fitted <span title="Model order: SARIMA(1,0,0)x(1,0,0)₁₂" style={{ borderBottom: '1px dotted #a8a8b8', cursor: 'help' }}>SARIMA</span> seasonal model on monthly plays. Solid line = actual, dashed = 3-month forecast.
                            </p>
                        </div>
                        <span style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                            background: fitBg,
                            color: fitColor,
                            border: '1px solid ' + fitBorder
                        }}>
                            R² {rSquared.toFixed(2)} · {fitLabel}
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
                                    formatter={(value, name) => [value === null || value === -1 ? 'N/A' : Math.round(value), name === 'actual' ? 'Actual Plays' : 'SARIMA Model Fit']}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="actual" stroke="#1db954" strokeWidth={3} name="Actual Monthly Plays" dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} />
                                <Line type="monotone" dataKey="fitted" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="SARIMA + 3mo Forecast" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {predictions.trend.rSquared < 0.15 && (
                        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(255, 77, 109, 0.08)', border: '1px solid rgba(255, 77, 109, 0.15)', borderRadius: '12px', color: '#ff4d6d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>⚠️</span>
                            <span><strong>Low Predictability:</strong> High historical variability makes precise seasonal forecasting difficult.</span>
                        </div>
                    )}

                    <details style={{ marginTop: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.01)', overflow: 'hidden' }}>
                        <summary style={{ padding: '14px 18px', fontWeight: 'bold', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none', outline: 'none' }}>
                            How to read this graph?
                        </summary>
                        <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1.2 1 400px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#c7c7d1', lineHeight: 1.4 }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ color: '#1db954', fontSize: '14px', marginRight: '10px', lineHeight: 1 }}>●</span>
                                    <span><strong>Actual Plays:</strong> Your real Spotify listening history.</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ color: '#8b5cf6', fontSize: '14px', marginRight: '10px', lineHeight: 1 }}>●</span>
                                    <span><strong>SARIMA Model Fit:</strong> Mathematical curve fitting your seasonal patterns.</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '18px' }}>
                                    <span style={{ color: '#a8a8b8', marginRight: '8px', fontFamily: 'monospace' }}>└─</span>
                                    <span style={{ fontSize: '12px', color: '#a8a8b8' }}><strong>Flat Phase:</strong> Initial warm-up baseline (not enough history yet to learn the season).</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '18px' }}>
                                    <span style={{ color: '#a8a8b8', marginRight: '8px', fontFamily: 'monospace' }}>└─</span>
                                    <span style={{ fontSize: '12px', color: '#a8a8b8' }}><strong>Wavy Phase:</strong> Active seasonal tracking based on your past years.</span>
                                </div>
                            </div>
                            {predictions.nextMonthForecast && predictions.nextMonthForecast.predictedPlays > 0 && (
                                <div style={{ flex: '0.8 1 250px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#a8a8b8', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                        Next Month Forecast
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '2px 0' }}>
                                        <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1db954', lineHeight: 1 }}>
                                            ~{predictions.nextMonthForecast.predictedPlays}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#a8a8b8', fontWeight: 'bold' }}>plays</span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#888899', lineHeight: 1.3 }}>
                                        Safety range: <span style={{ color: '#a8a8b8' }}>{predictions.nextMonthForecast.lowerBound} – {predictions.nextMonthForecast.upperBound}</span> plays (95% confidence based on historical volatility).
                                    </span>
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            )}

            {/* PROBABILITY DISTRIBUTIONS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                {/* DAY OF WEEK PROBABILITY */}
                {predictions.dayOfWeekProbabilities && Object.keys(predictions.dayOfWeekProbabilities).length > 0 && (
                    <div className="all-time-panel" style={{ padding: '20px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <h3 style={{ margin: '0 0 4px' }}>Day of Week Distribution</h3>
                        <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#a8a8b8' }}>Probability distribution of your listening activity across the week.</p>
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
                        <h3 style={{ margin: '0 0 4px' }}>Hour of Day Distribution</h3>
                        <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#a8a8b8' }}>Probability distribution of your listening activity across the 24-hour cycle.</p>
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

            {((predictions.risingGenres && predictions.risingGenres.length > 0) || 
              (predictions.fadingGenres && predictions.fadingGenres.length > 0)) && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ margin: '0 0 4px' }}>Genre Trend Trajectories</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#a8a8b8' }}>
                        Rate of change in monthly plays per genre to isolate emerging interests vs fading favorites.
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
                            Listening Trend: {trendLabel}
                        </strong>
                        <p style={{ margin: '6px 0 0', color: '#c7c7d1', fontSize: '15px' }}>
                            {changePercent === 0
                                ? 'Your overall listening activity remains statistically steady compared to the previous recorded period.'
                                : changePercent > 0
                                    ? `You are listening ${Math.abs(changePercent)}% more than the previous comparable period, showing a rising engagement with music.`
                                    : `You are listening ${Math.abs(changePercent)}% less than the previous comparable period, indicating a decrease in listening volume.`
                            }
                        </p>
                    </div>
                </div>
                <p style={{ margin: '8px 0 0 0', color: '#c7c7d1', fontSize: '14px', lineHeight: 1.5 }}>
                    Your peak listening density usually concentrates on <strong>{`${predictions.mostActiveDayOfWeek}s`}</strong> around <strong>{formatHour(predictions.mostActiveHour)}</strong>, showing a stable habit. 
                    Across your history, <strong>{predictions.mostActiveMonth}</strong> is your most active month, and your predicted top artist for the coming period is <strong>{predictions.predictedTopArtist.name}</strong>.
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