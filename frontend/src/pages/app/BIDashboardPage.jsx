import { useEffect, useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'
import {
    getArtistLoyalty,
    getListeningHeatmap,
    getMonthlyGrowth,
    getMonthlyListening,
    getMusicInsights,
    getTopGenres,
    getWeekendVsWeekdayStats
} from '../../api/analyticsApi'

const DAY_ORDER = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
]

const HOURS = Array.from({ length: 24 }, (_, index) => index)

function BIDashboardPage() {
    const [reports, setReports] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedYear, setSelectedYear] = useState(null)

    useEffect(() => {
        async function loadReports() {
            try {
                setLoading(true)
                setError('')

                const [
                    monthlyListening,
                    topGenres,
                    weekendVsWeekday,
                    heatmap,
                    monthlyGrowth,
                    artistLoyalty,
                    musicInsights
                ] = await Promise.all([
                    getMonthlyListening(),
                    getTopGenres(),
                    getWeekendVsWeekdayStats(),
                    getListeningHeatmap(),
                    getMonthlyGrowth(),
                    getArtistLoyalty(),
                    getMusicInsights()
                ])

                setReports({
                    monthlyListening,
                    topGenres,
                    weekendVsWeekday,
                    heatmap,
                    monthlyGrowth,
                    artistLoyalty,
                    musicInsights
                })
            } catch (error) {
                setError('BI reports could not be loaded. Run the analytics pipeline first, then refresh this page.')
            } finally {
                setLoading(false)
            }
        }

        loadReports()
    }, [])

    const heatmapLookup = useMemo(() => {
        const lookup = new Map()
        const rows = reports?.heatmap || []

        rows.forEach((row) => {
            const key = `${row.dayName}-${row.hour}`
            lookup.set(key, Number(row.totalPlays) || 0)
        })

        return lookup
    }, [reports])

    const maxHeatmapValue = useMemo(() => {
        const values = Array.from(heatmapLookup.values())
        return values.length > 0 ? Math.max(...values) : 0
    }, [heatmapLookup])

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('en-US')
    }

    function renderEmpty(message) {
        return <p className="empty-stats-message">{message}</p>
    }

    function renderMonthlyListeningChart() {
        const rawData = reports?.monthlyListening || []

        if (rawData.length === 0) {
            return renderEmpty('No monthly listening data available yet.')
        }

        if (selectedYear) {
            const data = rawData.filter(d => d.year === selectedYear)
            return (
                <div className="chart-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3>Listening evolution - {selectedYear}</h3>
                        <button 
                            style={{ padding: '6px 12px', background: '#282828', color: 'white', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            onClick={() => setSelectedYear(null)}
                            onMouseOver={(e) => e.currentTarget.style.background = '#3e3e3e'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#282828'}
                        >
                            &larr; Back to all years
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="monthName" stroke="#a3a3a3" fontSize={12} tickMargin={10} />
                            <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                            <Tooltip contentStyle={{ backgroundColor: '#282828', border: 'none', borderRadius: '8px' }} />
                            <Line type="monotone" name="Total Minutes" dataKey="totalMinutes" stroke="#1db954" strokeWidth={3} activeDot={{ r: 6 }} />
                            <Line type="monotone" name="Total Plays" dataKey="totalPlays" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )
        }

        const yearlyDataMap = new Map()
        rawData.forEach(d => {
            const y = d.year
            if (!yearlyDataMap.has(y)) {
                yearlyDataMap.set(y, { year: y, totalPlays: 0, totalMinutes: 0 })
            }
            const agg = yearlyDataMap.get(y)
            agg.totalPlays += Number(d.totalPlays || 0)
            agg.totalMinutes += Number(d.totalMinutes || 0)
        })
        const yearlyData = Array.from(yearlyDataMap.values()).sort((a, b) => a.year - b.year)

        return (
            <div className="chart-box" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3>Yearly listening overview</h3>
                    <span style={{ fontSize: '12px', color: '#1db954', fontWeight: 'bold' }}>Click a bar to drill down</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={yearlyData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            setSelectedYear(e.activePayload[0].payload.year)
                        }
                    }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="year" stroke="#a3a3a3" fontSize={12} tickMargin={10} />
                        <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                        <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: '#282828', border: 'none', borderRadius: '8px' }} />
                        <Bar dataKey="totalMinutes" name="Total Minutes" fill="#1db954" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="totalPlays" name="Total Plays" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderTopGenresChart() {
        const data = reports?.topGenres || []

        if (data.length === 0) {
            return renderEmpty('No genre data available yet.')
        }

        return (
            <div className="chart-box">
                <h3>Top genres</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="genreName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalPlays" fill="#1db954" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderWeekendChart() {
        const data = reports?.weekendVsWeekday || []

        if (data.length === 0) {
            return renderEmpty('No weekday/weekend data available yet.')
        }

        return (
            <div className="chart-box">
                <h3>Weekend vs weekday</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="totalPlays"
                            nameKey="dayType"
                            outerRadius={95}
                            label
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${entry.dayType}`}
                                    fill={index === 0 ? '#1db954' : '#8b5cf6'}
                                />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderMonthlyGrowthChart() {
        const data = reports?.monthlyGrowth || []

        if (data.length === 0) {
            return renderEmpty('No monthly growth data available yet.')
        }

        return (
            <div className="chart-box">
                <h3>Monthly growth</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="monthName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="playGrowthPercent" fill="#f472b6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderHeatmap() {
        if (!reports?.heatmap || reports.heatmap.length === 0) {
            return renderEmpty('No heatmap data available yet.')
        }

        return (
            <div className="chart-box wide-chart-box">
                <h3>Listening heatmap</h3>
                <p className="chart-description">
                    The darker cells show the hours when listening activity is more frequent.
                </p>

                <div className="listening-heatmap-grid">
                    <div className="heatmap-corner" />

                    {HOURS.map((hour) => (
                        <div className="heatmap-hour" key={hour}>{hour}</div>
                    ))}

                    {DAY_ORDER.map((day) => (
                        <div className="heatmap-row" key={day}>
                            <div className="heatmap-day">{day.slice(0, 3)}</div>

                            {HOURS.map((hour) => {
                                const value = heatmapLookup.get(`${day}-${hour}`) || 0
                                const intensity = maxHeatmapValue > 0 ? value / maxHeatmapValue : 0

                                return (
                                    <div
                                        className="heatmap-cell"
                                        key={`${day}-${hour}`}
                                        title={`${day}, ${hour}:00 - ${value} plays`}
                                        style={{ opacity: 0.18 + intensity * 0.82 }}
                                    >
                                        {value > 0 ? value : ''}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    function renderArtistLoyalty() {
        const data = reports?.artistLoyalty || []

        if (data.length === 0) {
            return renderEmpty('No artist loyalty data available yet.')
        }

        return (
            <div className="chart-box">
                <h3>Artist loyalty</h3>
                <div className="compact-ranking-list">
                    {data.slice(0, 6).map((artist, index) => (
                        <div className="compact-ranking-item" key={`${artist.artistName}-${index}`}>
                            <span>{index + 1}</span>
                            <div>
                                <strong>{artist.artistName}</strong>
                                <p>
                                    {artist.totalPlays} plays · {artist.uniqueTracks} tracks · repeat intensity {artist.repeatIntensity}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    function renderMusicInsights() {
        const insights = reports?.musicInsights

        if (!insights || insights.profileTitle === 'No Data Yet') {
            return renderEmpty('No music insights available yet.')
        }

        return (
            <div className="music-insights-card">
                <div>
                    <span>Listening profile</span>
                    <h3>{insights.profileTitle}</h3>
                    <p>{insights.description}</p>
                </div>

                <div className="overview-grid">
                    <div className="overview-card">
                        <span>Total plays</span>
                        <strong>{formatNumber(insights.totalPlays)}</strong>
                    </div>

                    <div className="overview-card">
                        <span>Total minutes</span>
                        <strong>{formatNumber(insights.totalMinutes)}</strong>
                    </div>

                    <div className="overview-card">
                        <span>Unique tracks</span>
                        <strong>{formatNumber(insights.uniqueTracks)}</strong>
                    </div>

                    <div className="overview-card">
                        <span>Diversity score</span>
                        <strong>{insights.diversityScore}</strong>
                    </div>
                </div>

                <div className="insight-list">
                    {(insights.insights || []).slice(0, 6).map((message, index) => (
                        <p key={`${message}-${index}`}>{message}</p>
                    ))}
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>BI Dashboard</h2>
                <p className="empty-stats-message">Loading BI reports...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>BI Dashboard</h2>
                <p className="date-filter-error">{error}</p>
            </div>
        )
    }

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>BI Dashboard</h2>
                    <p>
                        Dynamic reports generated from the analytical Data Warehouse.
                    </p>
                    <p className="period-label">
                        Data source: dw_fact_listening_event + dimension tables
                    </p>
                </div>
            </div>

            {renderMusicInsights()}

            <div className="bi-dashboard-grid">
                {renderMonthlyListeningChart()}
                {renderTopGenresChart()}
                {renderWeekendChart()}
                {renderMonthlyGrowthChart()}
            </div>

            {renderHeatmap()}

            <div className="bi-dashboard-grid">
                {renderArtistLoyalty()}
            </div>
        </div>
    )
}

export default BIDashboardPage
