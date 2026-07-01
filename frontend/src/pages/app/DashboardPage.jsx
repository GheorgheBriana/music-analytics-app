import { useEffect, useState } from 'react'
import { getUserStats } from '../../api/statsApi'
import { useAuth } from '../../contexts/AuthContext'
import './DashboardPage.css'

const monthsList = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' }
];

function DashboardPage() {
    const { user } = useAuth()
    const activeUserId = user?.id || localStorage.getItem('userId')

    // 1. All-time Dashboard State
    const [allTimeStats, setAllTimeStats] = useState(null)
    const [allTimeLoading, setAllTimeLoading] = useState(true)
    const [allTimeError, setAllTimeError] = useState('')

    // 2. Period Statistics State
    const [statsData, setStatsData] = useState(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [statsError, setStatsError] = useState('')
    const [activePeriod, setActivePeriod] = useState('month') // 'day', 'week', 'month', 'year', 'lifetime', 'custom'
    const [timeAnchor, setTimeAnchor] = useState(null)
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [hoveredStreamHour, setHoveredStreamHour] = useState(null)
    const [hoveredMinuteHour, setHoveredMinuteHour] = useState(null)

    const API_BASE_URL = 'http://localhost:8080'

    // Fetch All-Time Stats for Top Cards
    useEffect(() => {
        async function loadDashboardStats() {
            if (!activeUserId) {
                setAllTimeError('No logged-in user was found.')
                setAllTimeLoading(false)
                return
            }

            try {
                setAllTimeLoading(true)
                setAllTimeError('')
                const data = await getUserStats(activeUserId)
                setAllTimeStats(data)
            } catch (error) {
                setAllTimeError('Dashboard statistics could not be loaded.')
                setAllTimeStats(null)
            } finally {
                setAllTimeLoading(false)
            }
        }
        loadDashboardStats()
    }, [activeUserId])

    // Fetch Period Stats for Heatmaps & Clocks
    useEffect(() => {
        async function fetchPeriodStats() {
            if (!activeUserId) {
                setStatsError('No logged-in user was found.')
                setStatsLoading(false)
                return
            }

            try {
                setStatsLoading(true)
                let url = `${API_BASE_URL}/api/stats/user/${activeUserId}/period-metrics?period=${activePeriod}`
                
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
                    throw new Error('Failed to load period stats data')
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
                
                setStatsError('')
            } catch (err) {
                setStatsError('Failed to load period stats data.')
            } finally {
                setStatsLoading(false)
            }
        }
        fetchPeriodStats()
    }, [activeUserId, activePeriod, timeAnchor, customStart, customEnd])

    // Period changes handler
    const handlePeriodChange = (period) => {
        setActivePeriod(period)
        setTimeAnchor(null)
    }

    const handlePrev = () => {
        if (activePeriod === 'lifetime' || activePeriod === 'custom') return
        const newAnchor = new Date(timeAnchor || new Date())
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
        const newAnchor = new Date(timeAnchor || new Date())
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

    // Render loading & error states
    if ((allTimeLoading && !allTimeStats) || (statsLoading && !statsData)) {
        return (
            <div className="overview-page-container">
                <h2>Overview</h2>
                <p>Loading your music overview...</p>
            </div>
        )
    }

    if (allTimeError || statsError) {
        return (
            <div className="overview-page-container">
                <h2>Overview</h2>
                <p className="error-message">{allTimeError || statsError}</p>
            </div>
        )
    }

    if (!allTimeStats || !statsData) {
        return (
            <div className="overview-page-container">
                <h2>Overview</h2>
                <p>No listening records found. Please import some data first.</p>
            </div>
        )
    }

    // 3. Extract all data structures
    const topArtist = allTimeStats.top10Artists?.[0]
    const topTrack = allTimeStats.top10Tracks?.[0]
    const topAlbum = allTimeStats.top10Albums?.[0]
    const insight = buildInsight(allTimeStats, topArtist, topTrack)

    const now = timeAnchor || new Date()
    const availableYears = statsData?.availableYears || [new Date().getFullYear()]
    const isLatestPeriod = statsData?.isLatestPeriod ?? true
    const isOldestPeriod = statsData?.isOldestPeriod ?? true
    const periodLabel = statsData?.periodLabel || ''
    const { current, trends, hourlyPlays, hourlyMinutes, weekdayPlays } = statsData

    // Format minutes tooltip with decimals under 10 minutes (except 0)
    const formatMinutesTooltip = (val) => {
        if (val === 0) return '0 mins';
        if (val === 1) return '1 min';
        if (val < 10) {
            const formatted = Number(val.toFixed(1));
            return `${formatted} ${formatted === 1 ? 'min' : 'mins'}`;
        }
        const rounded = Math.round(val);
        return `${rounded.toLocaleString()} ${rounded === 1 ? 'min' : 'mins'}`;
    }

    // Dropdown selectors rendering
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
                    <span className="period-week-prefix">Week of the 1st of</span>
                    <select
                        className="period-dropdown-select"
                        value={now.getMonth()}
                        onChange={(e) => {
                            const targetMonth = parseInt(e.target.value);
                            const newAnchor = new Date(now.getFullYear(), targetMonth, 1, 12, 0, 0);
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
                            const newAnchor = new Date(targetYear, now.getMonth(), 1, 12, 0, 0);
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
                        {now.toLocaleDateString('en-US', { month: 'long' })}
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
                    <span className="period-year-prefix">Year</span>
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

        if (activePeriod === 'lifetime') {
            return <span className="period-label-text">Lifetime</span>;
        }

        return <span className="period-label-text">{periodLabel}</span>;
    }

    // Trend percentage renderer
    const renderTrend = (value) => {
        if (value === null || activePeriod === 'lifetime') return null
        const isNegative = value < 0
        const isZero = value === 0
        const formatted = isZero ? '0%' : `${isNegative ? '' : '+'}${Math.round(value)}%`
        
        let compText = ''
        if (activePeriod === 'day') compText = 'vs. yesterday'
        else if (activePeriod === 'week') compText = 'vs. last week'
        else if (activePeriod === 'month') compText = 'vs. last month'
        else if (activePeriod === 'year') compText = 'vs. last year'

        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className={`stat-trend ${isNegative ? 'negative' : 'positive'}`}>
                    {formatted}
                </span>
                {compText && <span style={{ fontSize: '11px', color: '#a0a0a0', fontWeight: '400' }}>{compText}</span>}
            </div>
        )
    }

    // SVG clock wedge generator
    const renderClockWedges = (values, setHoveredHour) => {
        const cx = 100
        const cy = 100
        const r_outer = 85
        const r_inner = 45
        const maxValue = Math.max(...values, 1)

        return values.map((val, h) => {
            const startAngle = h * 15 - 90
            const endAngle = (h + 1) * 15 - 90

            const startRad = (startAngle * Math.PI) / 180
            const endRad = (endAngle * Math.PI) / 180

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
        <div className="overview-page-container">
            {/* ── ALL-TIME SUMMARY HEADER ── */}
            <div className="dashboard-header">
                <div>
                    <h2>Overview</h2>
                    <p className="dashboard-sub">
                        A consolidated overview of your Spotify listening history.
                    </p>
                </div>
                <div className="all-time-summary">
                    <strong>{allTimeStats.totalPlays?.toLocaleString()}</strong>
                    <span>total plays</span>
                </div>
            </div>

            {/* ── ALL-TIME SUMMARY CARDS ── */}
            <div className="dashboard-grid">
                <div className="dash-card">
                    <span className="dash-label">Listening time</span>
                    <strong className="dash-value">{allTimeStats.totalHoursPlayed} hours</strong>
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

            {/* ── MUSIC INSIGHT PANEL ── */}
            <div className="dashboard-insight">
                <strong className="insight-title">{insight.title}</strong>
                <p className="insight-body">{insight.body}</p>
            </div>

            {/* ── SECTION DIVIDER ── */}
            <hr className="overview-section-divider" />
            
            <div>
                <h3 className="overview-section-title">Listening Behavior & Patterns</h3>
                <p className="overview-section-sub">Explore custom periods, weekly distributions, and hourly listening clocks.</p>
            </div>

            {/* ── PERIOD TAB FILTERS ── */}
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

            {/* ── CUSTOM DATE RANGE PICKER ── */}
            {activePeriod === 'custom' && (
                <div className="custom-range-picker-container">
                    <div className="picker-input-group">
                        <label htmlFor="custom-start-date">From:</label>
                        <input 
                            type="date" 
                            id="custom-start-date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="custom-date-input"
                        />
                    </div>
                    <div className="picker-input-group">
                        <label htmlFor="custom-end-date">To:</label>
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

            {/* ── SIDE-BY-SIDE ANALYTICS GRID ── */}
            <div className="overview-analysis-grid">
                {/* Panel 1: Weekday Distribution */}
                <div className="weekday-activity-section">
                    <div className="clocks-title-row">
                        <h4>Streams by Day of the Week</h4>
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

                {/* Panel 2: Listening Clocks */}
                <div className="listening-clocks-section">
                    <div className="clocks-title-row">
                        <h4>Listening Clocks (Daily Hours)</h4>
                        <span className="beta-badge">radial</span>
                    </div>

                    <div className="clocks-grid">
                        {/* Clock 1: Streams */}
                        <div className="listening-clock-card">
                            <div className="clock-svg-container">
                                <svg viewBox="0 0 200 200" width="100%" height="100%">
                                    {renderClockWedges(hourlyPlays, setHoveredStreamHour)}
                                    
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
                                            <text x="100" y="62" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">0</text>
                                            <text x="138" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">6</text>
                                            <text x="100" y="146" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">12</text>
                                            <text x="62" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">18</text>
                                        </>
                                    )}
                                </svg>
                            </div>
                            <span className="clock-card-label">Streams</span>
                        </div>

                        {/* Clock 2: Minutes */}
                        <div className="listening-clock-card">
                            <div className="clock-svg-container">
                                <svg viewBox="0 0 200 200" width="100%" height="100%">
                                    {renderClockWedges(hourlyMinutes, setHoveredMinuteHour)}
                                    
                                    <circle cx="100" cy="100" r="45" fill="#111421" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                    
                                    {hoveredMinuteHour !== null ? (
                                        <>
                                            <text x="100" y="96" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Outfit, sans-serif">
                                                {String(hoveredMinuteHour).padStart(2, '0')}:00
                                            </text>
                                            <text x="100" y="114" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold" letterSpacing="0.2">
                                                {formatMinutesTooltip(hourlyMinutes[hoveredMinuteHour])}
                                            </text>
                                        </>
                                    ) : (
                                        <>
                                            <text x="100" y="62" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">0</text>
                                            <text x="138" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">6</text>
                                            <text x="100" y="146" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">12</text>
                                            <text x="62" y="103.5" textAnchor="middle" fill="#aeb3c5" fontSize="10" fontWeight="bold">18</text>
                                        </>
                                    )}
                                </svg>
                            </div>
                            <span className="clock-card-label">Minutes Streamed</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── GRID OF PERIOD STATS CARDS ── */}
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