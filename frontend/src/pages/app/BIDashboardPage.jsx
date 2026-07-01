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
    Legend,
    LabelList,
    ReferenceLine
} from 'recharts'
import {
    getAdvancedOverview,
    getArtistLoyalty,
    getCompletionRate,
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
import { getUserStats } from '../../api/statsApi'
import ActivityHeatmap from '../../components/ActivityHeatmap'

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
    const [selectedRankingYear, setSelectedRankingYear] = useState(null)

    const [yearlyMetric, setYearlyMetric] = useState('hours')
    const [monthlyMetric, setMonthlyMetric] = useState('hours')
    const [monthlyMode, setMonthlyMode] = useState('monthly')

    // Calendar & Heatmap States
    const [importedStats, setImportedStats] = useState(null)
    const [dailyActivity, setDailyActivity] = useState([])
    const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(null)
    const [selectedMonthYear, setSelectedMonthYear] = useState('All')

    const activeUserId = localStorage.getItem('userId') || localStorage.getItem('original_user_id')

    useEffect(() => {
        async function loadReports() {
            try {
                setLoading(true)
                setError('')

                if (!activeUserId) {
                    setError('No logged-in user was found.')
                    setLoading(false)
                    return
                }

                const [
                    monthlyListening, topGenres, weekendVsWeekday, monthlyGrowth, artistLoyalty, musicInsights,
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, artistRankingEvolution,
                    statsData
                ] = await Promise.all([
                    getMonthlyListening(), getTopGenres(), getWeekendVsWeekdayStats(), getMonthlyGrowth(), getArtistLoyalty(), getMusicInsights(),
                    getWarehouseSummary(), getPartOfDayStats(), getPlatforms(), getCompletionRate(), getPeakListeningTime(), getListeningPersonality(), getArtistRankingEvolution(),
                    getUserStats(activeUserId)
                ])

                setReports({
                    monthlyListening, topGenres, weekendVsWeekday, monthlyGrowth, artistLoyalty, musicInsights,
                    advancedOverview, partOfDayStats, platforms, completionRate, peakListeningTime, listeningPersonality, artistRankingEvolution
                })
                setImportedStats(statsData)

                // Initialize years for calendar
                const years = statsData?.listeningActivityByYear?.map((item) => item.year) || []
                const latestYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear()
                setSelectedHeatmapYear(latestYear)
                setSelectedMonthYear(latestYear.toString())

                // Fetch daily activity for the latest year
                const from = `${latestYear}-01-01`
                const to = `${latestYear}-12-31`
                const heatmapRes = await fetch(
                    `http://localhost:8080/api/stats/user/${activeUserId}/daily-activity?from=${from}&to=${to}`
                )
                if (heatmapRes.ok) {
                    const dailyData = await heatmapRes.json()
                    setDailyActivity(dailyData)
                }
            } catch (error) {
                setError('BI reports could not be loaded. Run the analytics pipeline first, then refresh this page.')
            } finally {
                setLoading(false)
            }
        }

        loadReports()
    }, [activeUserId])

    function getAvailableYears(stats) {
        return stats?.listeningActivityByYear?.map((item) => item.year) || []
    }

    function getMonthName(monthNumber) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        return monthNames[monthNumber - 1] || 'Unknown month'
    }

    function getMaxPlayCount(items) {
        if (!items || items.length === 0) {
            return 1
        }
        return Math.max(...items.map((item) => item.playCount || 0), 1)
    }

    async function handleHeatmapYearChange(year) {
        try {
            setSelectedHeatmapYear(year)
            if (!activeUserId) return
            const from = `${year}-01-01`
            const to = `${year}-12-31`
            const response = await fetch(
                `http://localhost:8080/api/stats/user/${activeUserId}/daily-activity?from=${from}&to=${to}`
            )
            if (response.ok) {
                const data = await response.json()
                setDailyActivity(data)
            } else {
                setDailyActivity([])
            }
        } catch (error) {
            setDailyActivity([])
        }
    }

    function renderActivityByYear() {
        const activityByYear = importedStats?.listeningActivityByYear || []
        if (activityByYear.length === 0) {
            return (
                <p className="empty-stats-message">
                    No yearly activity found yet.
                </p>
            )
        }
        const maxPlayCount = getMaxPlayCount(activityByYear)
        return (
            <div className="bar-chart-list">
                {activityByYear.map((item) => {
                    const barWidth = `${(item.playCount / maxPlayCount) * 100}%`
                    return (
                        <div className="bar-row" key={item.year}>
                            <div className="bar-label">
                                <span>{item.year}</span>
                                <small>{item.playCount} plays</small>
                            </div>
                            <div className="bar-track">
                                <div
                                    className="bar-fill"
                                    style={{ width: barWidth }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    function renderActivityByMonth() {
        const activityByMonth = importedStats?.listeningActivityByMonth || []
        if (activityByMonth.length === 0) {
            return (
                <p className="empty-stats-message">
                    No monthly activity found yet.
                </p>
            )
        }
        const filteredActivity = selectedMonthYear === 'All'
            ? activityByMonth
            : activityByMonth.filter((item) => item.year.toString() === selectedMonthYear)

        if (filteredActivity.length === 0) {
            return (
                <p className="empty-stats-message">
                    No monthly activity found for year {selectedMonthYear}.
                </p>
            )
        }
        const maxPlayCount = getMaxPlayCount(filteredActivity)
        return (
            <div className="bar-chart-list">
                {filteredActivity.map((item) => {
                    const barWidth = `${(item.playCount / maxPlayCount) * 100}%`
                    return (
                        <div className="bar-row" key={`${item.year}-${item.month}`}>
                            <div className="bar-label">
                                <span>{getMonthName(item.month)} {item.year}</span>
                                <small>{item.playCount} plays</small>
                            </div>
                            <div className="bar-track">
                                <div
                                    className="bar-fill"
                                    style={{ width: barWidth }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }



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
            const data = rawData
                .filter(d => d.year === selectedYear)
                .sort((a, b) => a.month - b.month)
                .map(d => ({
                    ...d,
                    listeningHours: Number((d.totalMinutes / 60).toFixed(1))
                }))

            const fullYearData = []
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
            
            let cumulativeHours = 0
            let cumulativePlays = 0

            for (let i = 1; i <= 12; i++) {
                const existingMonth = data.find(d => d.month === i)
                
                let currentHours = 0
                let currentPlays = 0

                if (existingMonth) {
                    currentHours = existingMonth.listeningHours
                    currentPlays = existingMonth.totalPlays
                }

                cumulativeHours += currentHours
                cumulativePlays += currentPlays

                fullYearData.push({
                    month: i,
                    monthName: monthNames[i-1],
                    year: selectedYear,
                    listeningHours: monthlyMode === 'cumulative' ? Number(cumulativeHours.toFixed(1)) : currentHours,
                    totalPlays: monthlyMode === 'cumulative' ? cumulativePlays : currentPlays,
                    actualHours: currentHours,
                    actualPlays: currentPlays
                })
            }

            const dataKey = monthlyMetric === 'hours' ? 'listeningHours' : 'totalPlays'
            const lineName = monthlyMetric === 'hours' ? 'Total Hours' : 'Total Plays'
            const strokeColor = monthlyMetric === 'hours' ? '#1db954' : '#8b5cf6'

            const CustomTooltipMonthly = ({ active, payload }) => {
                if (active && payload && payload.length) {
                    const item = payload[0].payload
                    return (
                        <div style={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>{item.monthName} {item.year}</p>
                            <p style={{ margin: '4px 0', color: '#1db954', fontSize: '13px' }}>
                                {monthlyMode === 'cumulative' ? 'Cumulative hours' : 'Total hours'}: <strong>{item.listeningHours}h</strong>
                            </p>
                            <p style={{ margin: 0, color: '#8b5cf6', fontSize: '13px' }}>
                                {monthlyMode === 'cumulative' ? 'Cumulative plays' : 'Total plays'}: <strong>{formatNumber(item.totalPlays)}</strong>
                            </p>
                        </div>
                    )
                }
                return null
            }

            return (
                <div className="chart-box" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <h3 style={{ marginBottom: '8px' }}>Monthly Listening Evolution - {selectedYear}</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px' }}>
                                    <button onClick={() => setMonthlyMetric('hours')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: monthlyMetric === 'hours' ? '#282828' : 'transparent', color: monthlyMetric === 'hours' ? '#1db954' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Hours</button>
                                    <button onClick={() => setMonthlyMetric('plays')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: monthlyMetric === 'plays' ? '#282828' : 'transparent', color: monthlyMetric === 'plays' ? '#8b5cf6' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Plays</button>
                                </div>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px' }}>
                                    <button onClick={() => setMonthlyMode('monthly')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: monthlyMode === 'monthly' ? '#282828' : 'transparent', color: monthlyMode === 'monthly' ? '#fff' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Monthly</button>
                                    <button onClick={() => setMonthlyMode('cumulative')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: monthlyMode === 'cumulative' ? '#282828' : 'transparent', color: monthlyMode === 'cumulative' ? '#fff' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Cumulative</button>
                                </div>
                            </div>
                        </div>
                        <button 
                            className="tab-btn active"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => setSelectedYear(null)}
                        >
                            &larr; Back to all years
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={fullYearData} margin={{ bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="monthName" stroke="#a3a3a3" fontSize={11} tickMargin={10} interval={0} angle={-25} textAnchor="end" height={60} />
                            <YAxis stroke="#a3a3a3" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                            <Tooltip content={<CustomTooltipMonthly />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Line type="monotone" name={lineName} dataKey={dataKey} stroke={strokeColor} strokeWidth={3} activeDot={{ r: 6 }} />
                            <Legend wrapperStyle={{ bottom: 0 }} />
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
        const yearlyData = Array.from(yearlyDataMap.values())
            .filter(y => y.totalPlays > 0)
            .sort((a, b) => a.year - b.year)

        const CustomTooltipYearly = ({ active, payload, label }) => {
            if (active && payload && payload.length) {
                const item = payload[0].payload
                const currentYear = new Date().getFullYear()
                return (
                    <div style={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                            Year {label} {item.year === currentYear ? <span style={{fontSize: '11px', color: '#f59e0b', fontWeight: 'normal'}}>(Partial year)</span> : ''}
                        </p>
                        <p style={{ margin: '4px 0', color: '#1db954', fontSize: '13px' }}>Hours Listened: <strong>{formatNumber(item.listeningHours, 1)}</strong></p>
                        <p style={{ margin: 0, color: '#8b5cf6', fontSize: '13px' }}>Total Plays: <strong>{formatNumber(item.totalPlays)}</strong></p>
                    </div>
                )
            }
            return null
        }

        const yearlyDataKey = yearlyMetric === 'hours' ? 'listeningHours' : 'totalPlays'
        const yearlyBarName = yearlyMetric === 'hours' ? 'Listening Hours' : 'Total Plays'
        const yearlyBarColor = yearlyMetric === 'hours' ? '#1db954' : '#8b5cf6'

        return (
            <div className="chart-box" style={{ gridColumn: '1 / -1', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                        <h3>Total Listening by Year</h3>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px', marginTop: '8px', width: 'fit-content' }}>
                            <button onClick={() => setYearlyMetric('hours')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: yearlyMetric === 'hours' ? '#282828' : 'transparent', color: yearlyMetric === 'hours' ? '#1db954' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Hours</button>
                            <button onClick={() => setYearlyMetric('plays')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: yearlyMetric === 'plays' ? '#282828' : 'transparent', color: yearlyMetric === 'plays' ? '#8b5cf6' : '#a3a3a3', borderRadius: '4px', cursor: 'pointer' }}>Plays</button>
                        </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#a3a3a3', fontWeight: '500', marginTop: '4px' }}>Click a bar to drill down into months</span>
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
                        <Bar dataKey={yearlyDataKey} name={yearlyBarName} fill={yearlyBarColor} radius={[4, 4, 0, 0]} maxBarSize={60} />
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
        const rawData = reports?.topGenres || []
        const data = rawData.filter(g => g.genreName && g.genreName.toLowerCase() !== 'unknown')
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Top genres</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No genre statistics available.')}</div></div>

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

        const chartData = data.map(d => ({
            ...d,
            displayMonth: `${d.monthName?.substring(0,3)} ${d.year}`
        })).slice(-12)

        return (
            <div className="chart-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>Monthly growth (%)</h3>
                    <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '400' }}>Last 12 months (vs. previous month)</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="displayMonth" stroke="#a3a3a3" fontSize={11} axisLine={false} tickLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} domain={[dataMin => Math.min(0, dataMin), 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                        <Bar dataKey="playGrowthPercent" name="Growth %" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }



    function renderCompletionRateChart() {
        const data = reports?.completionRate || []
        if (data.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Completion Rate by Artist (%)</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No completion rate data.')}</div></div>

        return (
            <div className="chart-box">
                <h3>Completion Rate by Artist (%)</h3>
                <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" stroke="#a3a3a3" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} tick={false} domain={[0, 100]} />
                        <YAxis dataKey="artistName" type="category" stroke="#a3a3a3" fontSize={12} axisLine={false} tickLine={false} width={100} tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(23, 25, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                            formatter={(value) => [`${value}%`, 'Completion Rate']}
                        />
                        <Bar dataKey="averageCompletionRate" name="Completion %" fill="#1db954" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            <LabelList dataKey="averageCompletionRate" position="right" formatter={(val) => `${val}%`} fill="#a3a3a3" fontSize={11} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )
    }

    function renderArtistRankingEvolution() {
        const rawData = reports?.artistRankingEvolution || []
        if (rawData.length === 0) return <div className="chart-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}><h3>Artist Ranking Evolution</h3><div style={{ flex: 1, display: 'flex' }}>{renderEmpty('No artist ranking data available.')}</div></div>

        const years = Array.from(new Set(rawData.map(d => d.year))).sort((a,b) => b - a)
        const currentYear = selectedRankingYear || (years.length > 0 ? years[0] : null)
        const data = currentYear ? rawData.filter(d => d.year === currentYear) : rawData

        return (
            <div className="chart-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Artist Ranking Evolution (Top 3)</h3>
                    {years.length > 0 && (
                        <select 
                            style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', outline: 'none', cursor: 'pointer' }}
                            value={currentYear}
                            onChange={(e) => setSelectedRankingYear(Number(e.target.value))}
                        >
                            {years.map(y => <option style={{ background: '#282828' }} key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                </div>
                <p className="chart-description">Showcasing DENSE_RANK() SQL analytics per month</p>
                <div className="compact-ranking-list custom-scrollbar" style={{ marginTop: '12px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {data.map((item, index) => (
                        <div className="compact-ranking-item" key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: item.rankPosition === 1 ? '#f59e0b' : item.rankPosition === 2 ? '#9ca3af' : '#b45309', minWidth: '30px' }}>#{item.rankPosition}</span>
                            <span style={{ fontSize: '11px', padding: '4px 8px', width: '35px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', margin: '0 12px' }}>{item.monthName?.substring(0, 3)}</span>
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

            {/* Calendar & Listening History Heatmap Section */}
            {importedStats && (
                <>
                    <div style={{ marginBottom: '24px' }}>
                        <ActivityHeatmap
                            data={dailyActivity}
                            selectedYear={selectedHeatmapYear}
                            availableYears={getAvailableYears(importedStats)}
                            onYearChange={handleHeatmapYearChange}
                        />
                    </div>

                    <div className="all-time-section nested-section" style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', margin: '0 0 16px 0', fontFamily: "'Outfit', sans-serif" }}>Listening Activity History</h2>

                        <div className="all-time-grid">
                            <div className="all-time-panel">
                                <h3>By Year</h3>
                                {renderActivityByYear()}
                            </div>

                            <div className="all-time-panel">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <h3 style={{ margin: 0 }}>By Month</h3>
                                    <select
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            color: '#fff',
                                            border: 'none',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        value={selectedMonthYear}
                                        onChange={(e) => setSelectedMonthYear(e.target.value)}
                                    >
                                        <option style={{ background: '#222533' }} value="All">All Years</option>
                                        {getAvailableYears(importedStats).map(y => (
                                            <option style={{ background: '#222533' }} key={y} value={y.toString()}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                {renderActivityByMonth()}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className="bi-dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {renderMonthlyListeningChart()}
                
                {renderPartOfDayChart()}
                {renderPlatformsChart()}

                {renderTopGenresChart()}
                {renderMonthlyGrowthChart()}



                {renderCompletionRateChart()}
                {renderHighlights()}
                
                {renderArtistRankingEvolution()}
            </div>
        </div>
    )
}

export default BIDashboardPage
