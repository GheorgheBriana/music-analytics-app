import { useEffect, useState } from 'react'
import { getUserStats } from '../../api/statsApi'
import ActivityHeatmap from '../../components/ActivityHeatmap'

function CalendarPage() {
    const [importedStats, setImportedStats] = useState(null)
    const [dailyActivity, setDailyActivity] = useState([])
    const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(null)
    const [selectedMonthYear, setSelectedMonthYear] = useState('All')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const activeUserId = localStorage.getItem('userId')

    useEffect(() => {
        async function loadCalendarData() {
            if (!activeUserId) {
                setError('No logged-in user was found.')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError('')

                const statsData = await getUserStats(activeUserId)
                setImportedStats(statsData)

                const latestYear = getLatestAvailableYear(statsData)
                setSelectedHeatmapYear(latestYear)
                setSelectedMonthYear(latestYear.toString())

                await loadDailyActivityForYear(latestYear)
            } catch (error) {
                setError('Calendar data could not be loaded.')
                setImportedStats(null)
                setDailyActivity([])
            } finally {
                setLoading(false)
            }
        }

        loadCalendarData()
    }, [activeUserId])

    function getAvailableYears(stats) {
        return stats?.listeningActivityByYear?.map((item) => item.year) || []
    }

    function getLatestAvailableYear(stats) {
        const years = getAvailableYears(stats)

        if (years.length === 0) {
            return new Date().getFullYear()
        }

        return Math.max(...years)
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

    async function loadDailyActivityForYear(year) {
        if (!activeUserId || !year) {
            return
        }

        const from = `${year}-01-01`
        const to = `${year}-12-31`

        const response = await fetch(
            `http://localhost:8080/api/stats/user/${activeUserId}/daily-activity?from=${from}&to=${to}`
        )

        if (!response.ok) {
            throw new Error('Failed to load daily activity.')
        }

        const data = await response.json()
        setDailyActivity(data)
    }

    async function handleHeatmapYearChange(year) {
        try {
            setSelectedHeatmapYear(year)
            await loadDailyActivityForYear(year)
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

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Calendar</h2>
                <p className="empty-stats-message">
                    Loading your listening calendar...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Calendar</h2>
                <p className="date-filter-error">
                    {error}
                </p>
            </div>
        )
    }

    if (!importedStats) {
        return (
            <div className="all-time-section">
                <h2>Calendar</h2>
                <p className="empty-stats-message">
                    No imported Spotify history found yet. Go to Profile / Import and upload your ZIP file.
                </p>
            </div>
        )
    }

    const availableHeatmapYears = getAvailableYears(importedStats)

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Calendar</h2>
                    <p>
                        Explore when you listen to music across years, months and days.
                    </p>
                    <p className="period-label">
                        Current period: All time
                    </p>
                </div>

                <div className="all-time-summary">
                    <strong>{availableHeatmapYears.length}</strong>
                    <span>years found</span>
                </div>
            </div>

            <ActivityHeatmap
                data={dailyActivity}
                selectedYear={selectedHeatmapYear}
                availableYears={availableHeatmapYears}
                onYearChange={handleHeatmapYearChange}
            />

            <div className="all-time-section nested-section">
                <h2>Listening Activity</h2>

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
                                {availableHeatmapYears.map(y => (
                                    <option style={{ background: '#222533' }} key={y} value={y.toString()}>{y}</option>
                                ))}
                            </select>
                        </div>
                        {renderActivityByMonth()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CalendarPage