import { useEffect, useState, useMemo } from 'react'
import './StatsPage.css'

const monthsList = [
    { value: 0, label: 'Ianuarie' },
    { value: 1, label: 'Februarie' },
    { value: 2, label: 'Martie' },
    { value: 3, label: 'Aprilie' },
    { value: 4, label: 'Mai' },
    { value: 5, label: 'Iunie' },
    { value: 6, label: 'Iulie' },
    { value: 7, label: 'August' },
    { value: 8, label: 'Septembrie' },
    { value: 9, label: 'Octombrie' },
    { value: 10, label: 'Noiembrie' },
    { value: 11, label: 'Decembrie' }
];

function StatsPage() {
    const [statsData, setStatsData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activePeriod, setActiveTab] = useState('month') // 'day', 'week', 'month', 'year', 'lifetime', 'custom'
    const [timeAnchor, setTimeAnchor] = useState(null)
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [hoveredStreamHour, setHoveredStreamHour] = useState(null)
    const [hoveredMinuteHour, setHoveredMinuteHour] = useState(null)

    const API_BASE_URL = 'http://localhost:8080'
    const userId = localStorage.getItem('userId')

    useEffect(() => {
        async function fetchPeriodStats() {
            try {
                setLoading(true)
                let url = `${API_BASE_URL}/api/stats/user/${userId}/period-metrics?period=${activePeriod}`
                
                if (timeAnchor) {
                    const yyyy = timeAnchor.getFullYear()
                    const mm = String(timeAnchor.getMonth() + 1).padStart(2, '0')
                    const dd = String(timeAnchor.getDate()).padStart(2, '0')
                    url += `&anchor=${yyyy}-${mm}-${dd}`
                }
                
                if (activePeriod === 'custom') {
                    if (customStart) url += `&customStart=${customStart}`
                    if (customEnd) url += `&customEnd=${customEnd}`
                }
                
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error('Failed to load stats data')
                }
                const data = await response.json()
                setStatsData(data)
                
                if (data.anchorDate) {
                    const resolvedDate = new Date(data.anchorDate + 'T12:00:00')
                    if (!timeAnchor || timeAnchor.toDateString() !== resolvedDate.toDateString()) {
                        setTimeAnchor(resolvedDate)
                    }
                }
                
                if (activePeriod === 'custom' && data.anchorDate && (!customStart || !customEnd)) {
                    const latest = new Date(data.anchorDate + 'T12:00:00')
                    const thirtyDaysAgo = new Date(latest.getTime() - 30 * 24 * 60 * 60 * 1000)
                    
                    const formatDate = (d) => {
                        const yyyy = d.getFullYear()
                        const mm = String(d.getMonth() + 1).padStart(2, '0')
                        const dd = String(d.getDate()).padStart(2, '0')
                        return `${yyyy}-${mm}-${dd}`
                    }
                    
                    if (!customStart) setCustomStart(formatDate(thirtyDaysAgo))
                    if (!customEnd) setCustomEnd(formatDate(latest))
                }
                
                setError('')
            } catch (err) {
                setError('Failed to load stats data.')
            } finally {
                setLoading(false)
            }
        }
        if (userId) {
            fetchPeriodStats()
        }
    }, [userId, activePeriod, timeAnchor, customStart, customEnd])

    const now = timeAnchor || new Date()
    const availableYears = statsData?.availableYears || [new Date().getFullYear()]
    const isLatestPeriod = statsData?.isLatestPeriod ?? true
    const isOldestPeriod = statsData?.isOldestPeriod ?? true
    const periodLabel = statsData?.periodLabel || ''

    const handlePeriodChange = (period) => {
        setActiveTab(period)
        setTimeAnchor(null)
    }

    const handlePrev = () => {
        if (activePeriod === 'lifetime' || activePeriod === 'custom') return
        const newAnchor = new Date(now)
        if (activePeriod === 'day') {
            newAnchor.setDate(newAnchor.getDate() - 1)
        } else if (activePeriod === 'week') {
            newAnchor.setDate(newAnchor.getDate() - 7)
        } else if (activePeriod === 'month') {
            newAnchor.setMonth(newAnchor.getMonth() - 1)
        } else if (activePeriod === 'year') {
            newAnchor.setFullYear(newAnchor.getFullYear() - 1)
        }
        setTimeAnchor(newAnchor)
    }

    const handleNext = () => {
        if (activePeriod === 'lifetime' || activePeriod === 'custom') return
        const newAnchor = new Date(now)
        if (activePeriod === 'day') {
            newAnchor.setDate(newAnchor.getDate() + 1)
        } else if (activePeriod === 'week') {
            newAnchor.setDate(newAnchor.getDate() + 7)
        } else if (activePeriod === 'month') {
            newAnchor.setMonth(newAnchor.getMonth() + 1)
        } else if (activePeriod === 'year') {
            newAnchor.setFullYear(newAnchor.getFullYear() + 1)
        }
        setTimeAnchor(newAnchor)
    }

    if (loading && !statsData) {
        return (
            <div className="stats-page-container">
                <h2>Stats / Clocks</h2>
                <p>Loading your metrics...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="stats-page-container">
                <h2>Stats / Clocks</h2>
                <p className="error-message">{error}</p>
            </div>
        )
    }

    if (!statsData || (statsData.current.streams === 0 && activePeriod === 'lifetime')) {
        return (
            <div className="stats-page-container">
                <h2>Stats / Clocks</h2>
                <p>No listening records found. Please import some data first.</p>
            </div>
        )
    }

    const { current, trends, hourlyPlays, hourlyMinutes, weekdayPlays } = statsData
    
    const renderActivePeriodLabel = () => {
        if (activePeriod === 'day') {
            return (
                <div className="period-dropdowns-container">
                    <span className="period-day-number">{now.getDate()}</span>
                    <select
                        className="period-dropdown-select"
                        value={now.getMonth()}
                        onChange={(e) => {
                            const targetMonth = parseInt(e.target.value);
                            const newAnchor = new Date(now);
                            const maxDays = new Date(newAnchor.getFullYear(), targetMonth + 1, 0).getDate();
                            const currentDay = Math.min(newAnchor.getDate(), maxDays);
                            newAnchor.setDate(currentDay);
                            newAnchor.setMonth(targetMonth);
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {monthsList.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select
                        className="period-dropdown-select"
                        value={now.getFullYear()}
                        onChange={(e) => {
                            const targetYear = parseInt(e.target.value);
                            const newAnchor = new Date(now);
                            const maxDays = new Date(targetYear, newAnchor.getMonth() + 1, 0).getDate();
                            const currentDay = Math.min(newAnchor.getDate(), maxDays);
                            newAnchor.setDate(currentDay);
                            newAnchor.setFullYear(targetYear);
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                </div>
            )
        }

        if (activePeriod === 'week') {
            return (
                <div className="period-dropdowns-container">
                    <span className="period-week-prefix">Săptămâna cu 1</span>
                    <select
                        className="period-dropdown-select"
                        value={now.getMonth()}
                        onChange={(e) => {
                            const targetMonth = parseInt(e.target.value);
                            const newAnchor = new Date(now.getFullYear(), targetMonth, 1, 12, 0, 0); // 1st of the month
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {monthsList.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select
                        className="period-dropdown-select"
                        value={now.getFullYear()}
                        onChange={(e) => {
                            const targetYear = parseInt(e.target.value);
                            const newAnchor = new Date(targetYear, now.getMonth(), 1, 12, 0, 0); // 1st of the month
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                    <span className="period-week-range-label">({periodLabel})</span>
                </div>
            )
        }

        if (activePeriod === 'month') {
            return (
                <div className="period-dropdowns-container">
                    <span className="period-month-name">
                        {now.toLocaleDateString('ro-RO', { month: 'long' })}
                    </span>
                    <select
                        className="period-dropdown-select"
                        value={now.getFullYear()}
                        onChange={(e) => {
                            const targetYear = parseInt(e.target.value);
                            const newAnchor = new Date(now);
                            newAnchor.setFullYear(targetYear);
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                </div>
            )
        }

        if (activePeriod === 'year') {
            return (
                <div className="period-dropdowns-container">
                    <span className="period-year-prefix">Anul</span>
                    <select
                        className="period-dropdown-select"
                        value={now.getFullYear()}
                        onChange={(e) => {
                            const targetYear = parseInt(e.target.value);
                            const newAnchor = new Date(now);
                            newAnchor.setFullYear(targetYear);
                            setTimeAnchor(newAnchor);
                        }}
                    >
                        {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                        ))}
                    </select>
                </div>
            )
        }

        return <span className="period-label-text">{periodLabel}</span>;
    }



    const renderTrend = (value) => {
        if (value === null) return null
        const isNegative = value < 0
        const isZero = value === 0
        const formatted = isZero ? '0%' : `${isNegative ? '' : '+'}${Math.round(value)}%`
        return (
            <span className={`stat-trend ${isNegative ? 'negative' : 'positive'}`}>
                {formatted}
            </span>
        )
    }

    // Helper to draw SVG donut wedges for Clocks
    const renderClockWedges = (values, setHoveredHour) => {
        const cx = 100
        const cy = 100
        const r_outer = 85
        const r_inner = 45
        const maxValue = Math.max(...values, 1)

        return values.map((val, h) => {
            // Wedges of 15 degrees (360 / 24)
            // Align hour 0 at the very top (-90 degrees)
            const startAngle = h * 15 - 90
            const endAngle = (h + 1) * 15 - 90

            const startRad = (startAngle * Math.PI) / 180
            const endRad = (endAngle * Math.PI) / 180

            // Inner and outer points for wedge
            const x1_outer = cx + r_outer * Math.cos(startRad)
            const y1_outer = cy + r_outer * Math.sin(startRad)
            const x2_outer = cx + r_outer * Math.cos(endRad)
            const y2_outer = cy + r_outer * Math.sin(endRad)

            const x1_inner = cx + r_inner * Math.cos(endRad)
            const y1_inner = cy + r_inner * Math.sin(endRad)
            const x2_inner = cx + r_inner * Math.cos(startRad)
            const y2_inner = cy + r_inner * Math.sin(startRad)

            const pathData = `
                M ${x1_outer} ${y1_outer}
                A ${r_outer} ${r_outer} 0 0 1 ${x2_outer} ${y2_outer}
                L ${x1_inner} ${y1_inner}
                A ${r_inner} ${r_inner} 0 0 0 ${x2_inner} ${y2_inner}
                Z
            `

            // Color intensity based on value
            const intensity = val > 0 ? (val / maxValue) : 0
            const fill = val > 0 
                ? `rgba(29, 185, 84, ${0.2 + 0.8 * intensity})` 
                : 'rgba(255, 255, 255, 0.03)'

            return (
                <path
                    key={`wedge-${h}`}
                    d={pathData}
                    fill={fill}
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth="1.2"
                    className="clock-wedge"
                    onMouseEnter={() => setHoveredHour(h)}
                    onMouseLeave={() => setHoveredHour(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                />
            )
        })
    }

    const maxWeekdayPlays = Math.max(...weekdayPlays, 1)

    return (
        <div className="stats-page-container">
            {/* Top time period filters */}
            <div className="stats-period-tabs">
                {['day', 'week', 'month', 'year', 'lifetime', 'custom'].map(period => (
                    <button
                        key={period}
                        onClick={() => handlePeriodChange(period)}
                        className={`period-tab-btn ${activePeriod === period ? 'active' : ''}`}
                    >
                        {period}
                    </button>
                ))}
            </div>

            {/* Custom Date Range Picker */}
            {activePeriod === 'custom' && (
                <div className="custom-range-picker-container">
                    <div className="picker-input-group">
                        <label htmlFor="custom-start-date">De la:</label>
                        <input 
                            type="date" 
                            id="custom-start-date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="custom-date-input"
                        />
                    </div>
                    <div className="picker-input-group">
                        <label htmlFor="custom-end-date">Până la:</label>
                        <input 
                            type="date" 
                            id="custom-end-date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="custom-date-input"
                        />
                    </div>
                </div>
            )}

            {/* Grid of stats cards with percentage trends */}
            <div className="stats-cards-grid">
                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{current.streams.toLocaleString()}</span>
                        {renderTrend(trends.streams)}
                    </div>
                    <span className="stat-card-label">streams</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{current.uniqueTracks.toLocaleString()}</span>
                        {renderTrend(trends.uniqueTracks)}
                    </div>
                    <span className="stat-card-label">different tracks</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{Math.round(current.minutes).toLocaleString()}</span>
                        {renderTrend(trends.minutes)}
                    </div>
                    <span className="stat-card-label">minutes streamed</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{current.uniqueArtists.toLocaleString()}</span>
                        {renderTrend(trends.uniqueArtists)}
                    </div>
                    <span className="stat-card-label">different artists</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{Math.round(current.hours).toLocaleString()}</span>
                        {renderTrend(trends.hours)}
                    </div>
                    <span className="stat-card-label">hours streamed</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{current.uniqueAlbums.toLocaleString()}</span>
                        {renderTrend(trends.uniqueAlbums)}
                    </div>
                    <span className="stat-card-label">different albums</span>
                </div>

                <div className="stat-grid-card">
                    <div className="card-top-row">
                        <span className="stat-number-value">{current.daysCount.toLocaleString()}</span>
                        {renderTrend(trends.daysCount)}
                    </div>
                    <span className="stat-card-label">days streamed</span>
                </div>
            </div>

            {/* Listening Clocks radial dials */}
            <div className="listening-clocks-section">
                <div className="clocks-title-row">
                    <h4>Listening clocks</h4>
                </div>

                <div className="clocks-grid">
                    {/* Clock 1: Streams */}
                    <div className="listening-clock-card">
                        <div className="clock-svg-container">
                            <svg viewBox="0 0 200 200" width="100%" height="100%">
                                {renderClockWedges(hourlyPlays, setHoveredStreamHour)}
                                
                                {/* Inner dark circle containing labels */}
                                <circle cx="100" cy="100" r="45" fill="#111421" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                
                                {hoveredStreamHour !== null ? (
                                    <>
                                        <text x="100" y="96" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Outfit, sans-serif">
                                            {String(hoveredStreamHour).padStart(2, '0')}:00
                                        </text>
                                        <text x="100" y="114" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold" letterSpacing="0.2">
                                            {Math.round(hourlyPlays[hoveredStreamHour]).toLocaleString()} {hourlyPlays[hoveredStreamHour] === 1 ? 'stream' : 'streams'}
                                        </text>
                                    </>
                                ) : (
                                    <>
                                        {/* 0, 6, 12, 18 time indicators */}
                                        <text x="100" y="62" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">0</text>
                                        <text x="138" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">6</text>
                                        <text x="100" y="146" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">12</text>
                                        <text x="62" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">18</text>
                                    </>
                                )}
                            </svg>
                        </div>
                        <span className="clock-card-label">streams</span>
                    </div>

                    {/* Clock 2: Minutes */}
                    <div className="listening-clock-card">
                        <div className="clock-svg-container">
                            <svg viewBox="0 0 200 200" width="100%" height="100%">
                                {renderClockWedges(hourlyMinutes, setHoveredMinuteHour)}
                                
                                {/* Inner dark circle containing labels */}
                                <circle cx="100" cy="100" r="45" fill="#111421" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                
                                {hoveredMinuteHour !== null ? (
                                    <>
                                        <text x="100" y="96" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Outfit, sans-serif">
                                            {String(hoveredMinuteHour).padStart(2, '0')}:00
                                        </text>
                                        <text x="100" y="114" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold" letterSpacing="0.2">
                                            {Math.round(hourlyMinutes[hoveredMinuteHour]).toLocaleString()} {hourlyMinutes[hoveredMinuteHour] === 1 ? 'min' : 'mins'}
                                        </text>
                                    </>
                                ) : (
                                    <>
                                        {/* 0, 6, 12, 18 time indicators */}
                                        <text x="100" y="62" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">0</text>
                                        <text x="138" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">6</text>
                                        <text x="100" y="146" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">12</text>
                                        <text x="62" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">18</text>
                                    </>
                                )}
                            </svg>
                        </div>
                        <span className="clock-card-label">minutes streamed</span>
                    </div>
                </div>
            </div>

            {/* Weekday bar chart */}
            <div className="weekday-activity-section">
                <div className="clocks-title-row">
                    <h4>Streams by day of the week</h4>
                </div>

                <div className="weekday-navigation">
                    <button 
                        className="nav-arrow" 
                        onClick={handlePrev} 
                        disabled={isOldestPeriod}
                        title="Previous period"
                    >
                        &lt;
                    </button>
                    <span className="active-period-name">{renderActivePeriodLabel()}</span>
                    <button 
                        className="nav-arrow" 
                        onClick={handleNext} 
                        disabled={isLatestPeriod}
                        title="Next period"
                    >
                        &gt;
                    </button>
                </div>

                <div className="weekday-bar-chart">
                    {weekdayPlays.map((plays, idx) => {
                        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                        const heightPercent = Math.max(10, (plays / maxWeekdayPlays) * 80)
                        return (
                            <div className="weekday-bar-column" key={`weekday-${idx}`}>
                                <span className="weekday-play-count">{plays.toLocaleString()}</span>
                                <div className="weekday-bar-track">
                                    <div 
                                        className="weekday-bar-fill" 
                                        style={{ height: `${heightPercent}%` }}
                                    />
                                </div>
                                <span className="weekday-name-label">{labels[idx]}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default StatsPage
