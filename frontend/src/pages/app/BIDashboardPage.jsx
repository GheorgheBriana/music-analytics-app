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
    YAxis,
    Legend
} from 'recharts'
import {
    getAdvancedOverview,
    getArtistLoyalty,
    getCompletionRate,
    getListeningHeatmap,
    getListeningPersonality,
    getMonthlyGrowth,
    getMonthlyListening,
    getMusicInsights,
    getPartOfDayStats,
    getPeakListeningTime,
    getPlatforms,
    getTopGenreByMonth,
    getTopGenres,
    getWarehouseSummary,
    getWeekendVsWeekdayStats
} from '../../api/analyticsApi'

const DAY_ORDER = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

const HOURS = Array.from({ length: 24 }, (_, index) => index)

const COLORS = ['#1db954', '#8b5cf6', '#f472b6', '#3b82f6', '#f59e0b', '#10b981']

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
                    monthlyListening, topGenres, weekendVsWeekday, heatmap, monthlyGrowth, artistLoyalty, musicInsights,
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, topGenreByMonth
                ] = await Promise.all([
                    getMonthlyListening(), getTopGenres(), getWeekendVsWeekdayStats(), getListeningHeatmap(), getMonthlyGrowth(), getArtistLoyalty(), getMusicInsights(),
                    getWarehouseSummary(), getPartOfDayStats(), getPlatforms(), getCompletionRate(), getPeakListeningTime(), getListeningPersonality(), getTopGenreByMonth()
                ])

                setReports({
                    monthlyListening, topGenres, weekendVsWeekday, heatmap, monthlyGrowth, artistLoyalty, musicInsights,
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, topGenreByMonth
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

    function renderAdvancedOverview() {
        const data = reports?.advancedOverview || {}
        if (!data || Object.keys(data).length === 0) return null

        return (
            <div className="overview-grid" style={{ marginBottom: '24px' }}>
                <div className="overview-card">
                    <span>Total Plays</span>
                    <strong>{formatNumber(data.totalListeningEvents)}</strong>
                </div>
                <div className="overview-card">
                    <span>Total Minutes</span>
                    <strong>{formatNumber(data.totalDurationMinutes)}</strong>
                </div>
                <div className="overview-card">
                    <span>Unique Tracks</span>
                    <strong>{formatNumber(data.uniqueTracks)}</strong>
                </div>
                <div className="overview-card">
                    <span>Unique Artists</span>
                    <strong>{formatNumber(data.uniqueArtists)}</strong>
                </div>
            </div>
        )
    }

    function renderMonthlyListeningChart() {
        const rawData = reports?.monthlyListening || []

        if (rawData.length === 0) {
            return <div className="chart-box">{renderEmpty('No monthly listening data available yet.')}</div>
        }

        if (selectedYear) {
            const data = rawData.filter(d => d.year === selectedYear)
            return (
                <div className="chart-box" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3>Listening evolution - {selectedYear}</h3>
                        <button 
                            className="tab-btn active"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => setSelectedYear(null)}
                        >
                            &larr; Back to all years
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="monthName" stroke="#a3a3a3" fontSize={12} tickMargin={10} />
                            <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }} />
                            <Line type="monotone" name="Total Minutes" dataKey="totalMinutes" stroke="#1db954" strokeWidth={3} activeDot={{ r: 6 }} />
                            <Line type="monotone" name="Total Plays" dataKey="totalPlays" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 6 }} />
                            <Legend />
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
            <div className="chart-box" style={{ gridColumn: '1 / -1', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3>Yearly listening overview</h3>
                    <span style={{ fontSize: '12px', color: '#1db954', fontWeight: 'bold' }}>Click a bar to drill down</span>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={yearlyData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            setSelectedYear(e.activePayload[0].payload.year)
                        }
                    }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="year" stroke="#a3a3a3" fontSize={12} tickMargin={10} />
                        <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                        <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }} />
                        <Bar dataKey="totalMinutes" name="Total Minutes" fill="#1db954" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="totalPlays" name="Total Plays" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        <Legend />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderTopGenresChart() {
        const data = reports?.topGenres || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No genre data.')}</div>

        return (
            <div className="chart-box">
                <h3>Top genres</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis type="number" stroke="#a3a3a3" fontSize={12} />
                        <YAxis dataKey="genreName" type="category" stroke="#a3a3a3" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: 'none', borderRadius: '12px' }} />
                        <Bar dataKey="totalPlays" fill="#1db954" radius={[0, 8, 8, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderPartOfDayChart() {
        const data = reports?.partOfDayStats || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No part of day data.')}</div>

        return (
            <div className="chart-box">
                <h3>Time of day</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie data={data} dataKey="totalPlays" nameKey="timeOfDay" cx="50%" cy="50%" outerRadius={95} label>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: 'none', borderRadius: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderPlatformsChart() {
        const data = reports?.platforms || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No platform data.')}</div>

        return (
            <div className="chart-box">
                <h3>Platforms used</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie data={data} dataKey="totalPlays" nameKey="platform" cx="50%" cy="50%" innerRadius={60} outerRadius={95} label>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: 'none', borderRadius: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderMonthlyGrowthChart() {
        const data = reports?.monthlyGrowth || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No monthly growth data.')}</div>

        return (
            <div className="chart-box">
                <h3>Monthly growth (%)</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="monthName" stroke="#a3a3a3" fontSize={12} />
                        <YAxis stroke="#a3a3a3" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: 'none', borderRadius: '12px' }} />
                        <Bar dataKey="playGrowthPercent" fill="#f472b6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderHeatmap() {
        if (!reports?.heatmap || reports.heatmap.length === 0) return <div className="chart-box">{renderEmpty('No heatmap data.')}</div>

        return (
            <div className="chart-box wide-chart-box" style={{ gridColumn: '1 / -1' }}>
                <h3>Listening heatmap</h3>
                <p className="chart-description">Darker cells show hours with higher listening activity.</p>
                <div className="listening-heatmap-grid">
                    <div className="heatmap-corner" />
                    {HOURS.map((hour) => <div className="heatmap-hour" key={hour}>{hour}</div>)}
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

    function renderCompletionRateChart() {
        const data = reports?.completionRate || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No completion rate data.')}</div>

        return (
            <div className="chart-box">
                <h3>Completion Rate by Artist (%)</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="artistName" stroke="#a3a3a3" fontSize={11} tickMargin={10} />
                        <YAxis stroke="#a3a3a3" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.9)', border: 'none', borderRadius: '12px' }} />
                        <Bar dataKey="completionRate" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderTopGenreByMonth() {
        const data = reports?.topGenreByMonth || []
        if (data.length === 0) return <div className="chart-box">{renderEmpty('No top genre by month data.')}</div>

        return (
            <div className="chart-box">
                <h3>Top Genre Evolution</h3>
                <div className="compact-ranking-list">
                    {data.slice(0, 8).map((item, index) => (
                        <div className="compact-ranking-item" key={index}>
                            <span style={{ fontSize: '11px', padding: '0 8px', width: 'auto' }}>{item.monthName}</span>
                            <div>
                                <strong style={{ color: '#1db954' }}>{item.genreName}</strong>
                                <p>{item.totalPlays} plays</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    function renderHighlights() {
        const personality = reports?.listeningPersonality
        const peakTime = reports?.peakListeningTime

        return (
            <div className="chart-box">
                <h3>Insights & Personality</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    {personality && (
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', borderLeft: '4px solid #8b5cf6' }}>
                            <span style={{ fontSize: '12px', color: '#a3a3a3', textTransform: 'uppercase' }}>Your Vibe</span>
                            <strong style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{personality.personalityType}</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#c7c7d1' }}>{personality.description}</p>
                        </div>
                    )}
                    {peakTime && (
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', borderLeft: '4px solid #f472b6' }}>
                            <span style={{ fontSize: '12px', color: '#a3a3a3', textTransform: 'uppercase' }}>Peak Listening</span>
                            <strong style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{peakTime.hour}:00 - {peakTime.hour + 1}:00</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#c7c7d1' }}>{peakTime.totalPlays} plays recorded during this hour.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>BI Dashboard</h2>
                <p className="empty-stats-message">Loading Data Warehouse metrics...</p>
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
        <div className="all-time-section" style={{ background: 'transparent', border: 'none', padding: '0', marginTop: '20px' }}>
            <div className="all-time-header">
                <div>
                    <h2>BI Dashboard</h2>
                    <p style={{ color: '#c7c7d1' }}>Premium reports powered by the analytical Data Warehouse.</p>
                </div>
            </div>

            {renderAdvancedOverview()}

            <div className="bi-dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {renderMonthlyListeningChart()}
                
                {renderPartOfDayChart()}
                {renderPlatformsChart()}

                {renderTopGenresChart()}
                {renderMonthlyGrowthChart()}

                {renderHeatmap()}

                {renderCompletionRateChart()}
                {renderHighlights()}
                
                {renderTopGenreByMonth()}
            </div>
        </div>
    )
}

export default BIDashboardPage
