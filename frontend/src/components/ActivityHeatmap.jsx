import { useMemo, useState } from 'react'
import './ActivityHeatmap.css'

function ActivityHeatmap({ data, selectedYear, availableYears, onYearChange }) {
    function buildDateKey(year, month, day) {
        const paddedMonth = String(month).padStart(2, '0')
        const paddedDay = String(day).padStart(2, '0')

        return `${year}-${paddedMonth}-${paddedDay}`
    }

    function buildDateKeyFromDate(date) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        return `${year}-${month}-${day}`
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    function getColorLevel(playCount) {
        if (playCount === 0) {
            return 'level-0'
        }

        if (playCount <= 10) {
            return 'level-1'
        }

        if (playCount <= 30) {
            return 'level-2'
        }

        if (playCount <= 60) {
            return 'level-3'
        }

        return 'level-4'
    }

    // availableYears and selectedYear are now passed as props, so we don't need to compute them here.
    // If availableYears is empty/undefined, fallback to current year
    const safeAvailableYears = availableYears && availableYears.length > 0 
        ? availableYears 
        : [new Date().getFullYear()]

    const safeSelectedYear = selectedYear || safeAvailableYears[0]

    const activityByDate = useMemo(() => {
        const map = new Map()

        data.forEach((item) => {
            const key = buildDateKey(item.year, item.month, item.day)
            map.set(key, item)
        })

        return map
    }, [data])

    function buildYearDays(year) {
        const days = []
        const startDate = new Date(year, 0, 1)
        const endDate = new Date(year, 11, 31)

        const firstWeekday = startDate.getDay()

        for (let i = 0; i < firstWeekday; i++) {
            days.push(null)
        }

        const currentDate = new Date(startDate)

        while (currentDate <= endDate) {
            days.push(new Date(currentDate))
            currentDate.setDate(currentDate.getDate() + 1)
        }

        return days
    }

    function groupDaysByWeek(days) {
        const weeks = []
        let currentWeek = []

        days.forEach((day) => {
            currentWeek.push(day)

            if (currentWeek.length === 7) {
                weeks.push(currentWeek)
                currentWeek = []
            }
        })

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null)
            }

            weeks.push(currentWeek)
        }

        return weeks
    }

    function getMonthLabelForWeek(week, previousWeek) {
        const firstDayInWeek = week.find((day) => day !== null)

        if (!firstDayInWeek) {
            return ''
        }

        const previousFirstDay = previousWeek?.find((day) => day !== null)

        if (!previousFirstDay) {
            return firstDayInWeek.toLocaleDateString('en-US', { month: 'short' })
        }

        if (firstDayInWeek.getMonth() !== previousFirstDay.getMonth()) {
            return firstDayInWeek.toLocaleDateString('en-US', { month: 'short' })
        }

        return ''
    }

    const days = buildYearDays(safeSelectedYear)
    const weeks = groupDaysByWeek(days)

    return (
        <div className="activity-heatmap-card">
            <div className="activity-heatmap-header">
                <div>
                    <h3>Listening Activity Heatmap</h3>
                    <p>Your daily listening activity for the selected year.</p>
                </div>

                <div className="activity-heatmap-controls">
                    <label>
                        Year
                        <select
                            value={safeSelectedYear}
                            onChange={(event) => {
                                if (onYearChange) {
                                    onYearChange(Number(event.target.value))
                                }
                            }}
                        >
                            {safeAvailableYears.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="activity-heatmap-legend">
                        <span>Less</span>
                        <div className="activity-legend-box level-0" />
                        <div className="activity-legend-box level-1" />
                        <div className="activity-legend-box level-2" />
                        <div className="activity-legend-box level-3" />
                        <div className="activity-legend-box level-4" />
                        <span>More</span>
                    </div>
                </div>
            </div>

            <div className="activity-heatmap-scroll">
                <div className="activity-heatmap-months">
                    {weeks.map((week, index) => (
                        <span className="activity-heatmap-month-label" key={`month-${index}`}>
                            {getMonthLabelForWeek(week, weeks[index - 1])}
                        </span>
                    ))}
                </div>

                <div className="activity-heatmap-body">
                    <div className="activity-heatmap-weekdays">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                    </div>

                    <div className="activity-heatmap-grid">
                        {weeks.map((week, weekIndex) => (
                            <div className="activity-heatmap-week" key={weekIndex}>
                                {week.map((day, dayIndex) => {
                                    if (!day) {
                                        return (
                                            <div
                                                className="activity-heatmap-empty-day"
                                                key={`empty-${weekIndex}-${dayIndex}`}
                                            />
                                        )
                                    }

                                    const dateKey = buildDateKeyFromDate(day)
                                    const activity = activityByDate.get(dateKey)
                                    const playCount = activity?.playCount || 0
                                    const totalMinutes = activity
                                        ? Math.round(activity.totalMsPlayed / 1000 / 60)
                                        : 0

                                    return (
                                        <div
                                            className={`activity-heatmap-day ${getColorLevel(playCount)}`}
                                            key={dateKey}
                                            title={`${formatDate(day)} • ${playCount} plays • ${totalMinutes} min`}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActivityHeatmap