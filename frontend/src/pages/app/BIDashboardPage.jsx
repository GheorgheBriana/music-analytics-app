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
    getArtistRankingEvolution,
    getTopGenres,
    getWarehouseSummary,
    getWeekendVsWeekdayStats
} from '../../api/analyticsApi'

const DAY_ORDER = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

const HOURS = Array.from({ length: 24 }, (_, index) => index)

const COLORS = ['#1db954', '#8b5cf6', '#a3a3a3', '#535353', '#b3b3b3', '#282828']

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
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, artistRankingEvolution
                ] = await Promise.all([
                    getMonthlyListening(), getTopGenres(), getWeekendVsWeekdayStats(), getListeningHeatmap(), getMonthlyGrowth(), getArtistLoyalty(), getMusicInsights(),
                    getWarehouseSummary(), getPartOfDayStats(), getPlatforms(), getCompletionRate(), getPeakListeningTime(), getListeningPersonality(), getArtistRankingEvolution()
                ])

                setReports({
                    monthlyListening, topGenres, weekendVsWeekday, heatmap, monthlyGrowth, artistLoyalty, musicInsights,
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, artistRankingEvolution
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

    function formatNumber(value, decimals = 0) {
        return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    function renderEmpty(message) {
        return <p className="empty-stats-message" style={{ padding: '40px', textAlign: 'center', color: '#a3a3a3', fontStyle: 'italic', margin: 'auto' }}>{message}</p>
    }

    function renderAdvancedOverview() {
        const data = reports?.advancedOverview || {}
        const peakTime = reports?.peakListeningTime || {}
        const monthlyListening = reports?.monthlyListening || []

        if (!data || Object.keys(data).length === 0) return null

        const yearlyDataMap = new Map()
        monthlyListening.forEach(d => {
            const y = d.year
            if (!yearlyDataMap.has(y)) yearlyDataMap.set(y, 0)
            yearlyDataMap.set(y, yearlyDataMap.get(y) + Number(d.totalPlays || 0))
        })
        let mostActiveYear = 'N/A'
        let maxPlays = -1
        for (const [year, plays] of yearlyDataMap.entries()) {
            if (plays > maxPlays) {
                maxPlays = plays
                mostActiveYear = year
            }
        }

        const peakHourText = peakTime.hour !== undefined && peakTime.hour !== null ? `${peakTime.hour}:00 - ${peakTime.hour + 1}:00` : 'N/A'
        const peakDayText = peakTime.dayName || 'N/A'

        return (
            <div className="overview-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="overview-card">
                    <span>Total Plays</span>
                    <strong>{formatNumber(data.totalEvents ?? data.totalPlays)}</strong>
                </div>
                <div className="overview-card">
                    <span>Listening Time</span>
                    <strong>{formatNumber((data.totalMinutes || 0) / 60, 1)} <span style={{fontSize: '12px', fontWeight: 'normal', color: '#a3a3a3'}}>hours</span></strong>
                </div>
                <div className="overview-card">
                    <span>Track Diversity</span>
                    <strong>{formatNumber(data.uniqueTracks)} <span style={{fontSize: '12px', fontWeight: 'normal', color: '#a3a3a3'}}>tracks</span></strong>
                </div>
                <div className="overview-card">
                    <span>Peak Hour</span>
                    <strong>{peakHourText}</strong>
                </div>
                <div className="overview-card">
                    <span>Most Active Day</span>
                    <strong>{peakDayText}</strong>
                </div>
                <div className="overview-card">
                    <span>Most Active Year</span>
                    <strong>{mostActiveYear}</strong>
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
                yearlyDataMap.set(y, { year: y, totalPlays: 0, totalMinutes: 0, listeningHours: 0 })
            }
            const agg = yearlyDataMap.get(y)
            agg.totalPlays += Number(d.totalPlays || 0)
            agg.totalMinutes += Number(d.totalMinutes || 0)
            agg.listeningHours = Number((agg.totalMinutes / 60).toFixed(1))
        })
        const yearlyData = Array.from(yearlyDataMap.values()).sort((a, b) => a.year - b.year)

        const CustomTooltipYearly = ({ active, payload, label }) => {
            if (active && payload && payload.length) {
                const item = payload[0].payload
                return (
                    <div style={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>Year {label}</p>
                        <p style={{ margin: '4px 0', color: '#1db954', fontSize: '13px' }}>Hours Listened: <strong>{formatNumber(item.listeningHours, 1)}</strong></p>
                        <p style={{ margin: 0, color: '#8b5cf6', fontSize: '13px' }}>Total Plays: <strong>{formatNumber(item.totalPlays)}</strong></p>
                    </div>
                )
            }
            return null
        }

        return (
            <div className="chart-box" style={{ gridColumn: '1 / -1', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3>Yearly listening overview</h3>
                    <span style={{ fontSize: '12px', color: '#a3a3a3', fontWeight: '500' }}>Click a bar to drill down into months</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={yearlyData} onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                            setSelectedYear(e.activePayload[0].payload.year)
                        }
                    }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="year" stroke="#a3a3a3" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipYearly />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                        <Bar dataKey="listeningHours" name="Listening Hours" fill="#1db954" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    const renderPieTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const item = payload[0]
            const name = item.name
            const value = item.value
            // payload array on pie chart has the total in the chart via some tricks or we can calculate it
            return (
                <div style={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <strong style={{ color: item.payload.fill, textTransform: 'capitalize' }}>{name}</strong>
                    <p style={{ margin: '4px 0 0' }}>{formatNumber(value)} plays</p>
                </div>
            )
        }
        return null
    }

    function renderTopGenresChart() {
        const data = reports?.topGenres || []
        const isUnknown = data.length > 0 && data[0].genreName?.toLowerCase() === 'unknown'
        if (data.length === 0 || isUnknown) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Genre Coverage</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('Genre data requires Spotify API enrichment. Currently using fallback dimension.')}</div></div>

        return (
            <div className="chart-box">
                <h3>Top genres</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.slice(0, 5)} layout="vertical" margin={{ left: 30, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} />
                        <YAxis dataKey="genreName" type="category" stroke="#a3a3a3" fontSize={11} width={80} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="totalPlays" name="Plays" fill="#1db954" radius={[0, 4, 4, 0]} maxBarSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderPartOfDayChart() {
        const data = reports?.partOfDayStats || []
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Time of day</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No part of day data.')}</div></div>

        const totalPlays = data.reduce((sum, item) => sum + Number(item.totalPlays || 0), 0)

        return (
            <div className="chart-box">
                <h3>Time of day</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie data={data} dataKey="totalPlays" nameKey="partOfDay" cx="40%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={2} stroke="none">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={renderPieTooltip} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '13px', color: '#c7c7d1', right: '10%' }} formatter={(value, entry) => {
                            const percent = totalPlays > 0 ? ((entry.payload.value / totalPlays) * 100).toFixed(1) : 0
                            return <span style={{ color: '#e5e5e5', textTransform: 'capitalize' }}>{value} <span style={{ color: '#a3a3a3', marginLeft: '4px' }}>{percent}%</span></span>
                        }}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderPlatformsChart() {
        const data = reports?.platforms || []
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Platforms used</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No platform data.')}</div></div>

        const totalPlays = data.reduce((sum, item) => sum + Number(item.totalPlays || 0), 0)

        return (
            <div className="chart-box">
                <h3>Platforms used</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie data={data} dataKey="totalPlays" nameKey="platformName" cx="40%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={2} stroke="none">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={renderPieTooltip} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '13px', color: '#c7c7d1', right: '10%' }} formatter={(value, entry) => {
                            const percent = totalPlays > 0 ? ((entry.payload.value / totalPlays) * 100).toFixed(1) : 0
                            return <span style={{ color: '#e5e5e5', textTransform: 'capitalize' }}>{value} <span style={{ color: '#a3a3a3', marginLeft: '4px' }}>{percent}%</span></span>
                        }}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderMonthlyGrowthChart() {
        const data = reports?.monthlyGrowth || []
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Monthly growth (%)</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No monthly growth data.')}</div></div>

        return (
            <div className="chart-box">
                <h3>Monthly growth (%)</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="monthName" stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="playGrowthPercent" name="Growth %" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
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
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Completion Rate by Artist (%)</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No completion rate data.')}</div></div>

        return (
            <div className="chart-box">
                <h3>Completion Rate by Artist (%)</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="artistName" stroke="#a3a3a3" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="averageCompletionRate" name="Completion %" fill="#1db954" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderArtistRankingEvolution() {
        const data = reports?.artistRankingEvolution || []
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Artist Ranking Evolution</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No artist ranking data available.')}</div></div>

        return (
            <div className="chart-box">
                <h3>Artist Ranking Evolution (Top 3)</h3>
                <p className="chart-description">Showcasing DENSE_RANK() SQL analytics per month</p>
                <div className="compact-ranking-list" style={{ marginTop: '12px' }}>
                    {data.slice(0, 9).map((item, index) => (
                        <div className="compact-ranking-item" key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: item.rankPosition === 1 ? '#f59e0b' : item.rankPosition === 2 ? '#9ca3af' : '#b45309', minWidth: '30px' }}>#{item.rankPosition}</span>
                            <span style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', margin: '0 12px' }}>{item.monthName}</span>
                            <div>
                                <strong style={{ color: '#1db954', fontSize: '14px' }}>{item.artistName}</strong>
                                <p style={{ fontSize: '12px', color: '#a3a3a3', margin: '2px 0 0 0' }}>{formatNumber(item.totalPlays)} plays</p>
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
                            <strong style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{personality.personality || personality.personalityType}</strong>
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
                
                {renderArtistRankingEvolution()}
            </div>
        </div>
    )
}

export default BIDashboardPage
