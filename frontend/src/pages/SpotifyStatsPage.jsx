import { useEffect, useState } from 'react'
import { getUserStats } from '../api/statsApi'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { useAuth } from '../contexts/AuthContext'
import './SpotifyStatsPage.css'

function SpotifyStatsPage({ userId, onBackClick }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const [isUploading, setIsUploading] = useState(false)

    const [topTracks, setTopTracks] = useState([])
    const [topArtists, setTopArtists] = useState([])
    const [recentTracks, setRecentTracks] = useState([])
    const [spotifyStatus, setSpotifyStatus] = useState('Loading Spotify data...')

    const [activeSection, setActiveSection] = useState('upload')
    const [activeAllTimeSection, setActiveAllTimeSection] = useState('overview')

    const [timeRange, setTimeRange] = useState('long_term')
    const [spotifyProfile, setSpotifyProfile] = useState(null)
    const [importedStats, setImportedStats] = useState(null)

    const [dailyActivity, setDailyActivity] = useState([])
    const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(null)
    const [selectedYearArtists, setSelectedYearArtists] = useState(null)

    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [statsPeriodLabel, setStatsPeriodLabel] = useState('All time')
    const [dateFilterError, setDateFilterError] = useState('')

    const { user } = useAuth()
    const activeUserId = user?.id || localStorage.getItem('userId') || userId

    const authType = localStorage.getItem('authType')
    const isSpotifyMode = authType === 'spotify' || (user?.spotifyUserId && user.spotifyUserId.trim() !== '')

    function formatMinutes(msPlayed) {
        return Math.round(msPlayed / 1000 / 60)
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

    async function loadImportedStats(from = '', to = '') {
        if (!activeUserId) {
            return null
        }

        const data = await getUserStats(activeUserId, from, to)
        setImportedStats(data)

        return data
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
            throw new Error('Failed to load daily activity for selected year')
        }

        const data = await response.json()
        setDailyActivity(data)
    }

    async function handleHeatmapYearChange(year) {
        setSelectedHeatmapYear(year)

        try {
            await loadDailyActivityForYear(year)
        } catch (error) {
            setDailyActivity([])
        }
    }

    useEffect(() => {
        const fetchSpotifyData = async () => {
            if (!isSpotifyMode) {
                setSpotifyStatus('')
                return
            }

            if (!activeUserId) {
                setSpotifyStatus('No logged-in user was found.')
                return
            }

            try {
                const [tracksResponse, artistsResponse, recentResponse] = await Promise.all([
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/top-tracks?timeRange=${timeRange}`),
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/top-artists?timeRange=${timeRange}`),
                    fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/recently-played`)
                ])

                if (!tracksResponse.ok || !artistsResponse.ok || !recentResponse.ok) {
                    throw new Error('Could not load Spotify data')
                }

                const tracksData = await tracksResponse.json()
                const artistsData = await artistsResponse.json()
                const recentData = await recentResponse.json()

                setTopTracks(tracksData.items || [])
                setTopArtists(artistsData.items || [])

                const recentTracksFromSpotify = recentData.items
                    ? recentData.items.map((item) => item.track)
                    : []

                setRecentTracks(recentTracksFromSpotify)
                setSpotifyStatus('')
            } catch (error) {
                setSpotifyStatus('Spotify data could not be loaded. Please log in with Spotify again.')
            }
        }

        const fetchSpotifyProfile = async () => {
            if (!isSpotifyMode) {
                setSpotifyProfile(null)
                return
            }

            if (!activeUserId) {
                return
            }

            try {
                const response = await fetch(`http://127.0.0.1:8080/api/spotify-data/${activeUserId}/profile`)

                if (!response.ok) {
                    return
                }

                const data = await response.json()
                setSpotifyProfile(data)
            } catch (error) {
                setSpotifyProfile(null)
            }
        }

        const fetchImportedStats = async () => {
            try {
                const data = await loadImportedStats()
                setStatsPeriodLabel('All time')

                const latestYear = getLatestAvailableYear(data)

                setSelectedHeatmapYear(latestYear)
                await loadDailyActivityForYear(latestYear)
            } catch (error) {
                setImportedStats(null)
                setDailyActivity([])
            }
        }

        fetchSpotifyData()
        fetchSpotifyProfile()
        fetchImportedStats()
    }, [activeUserId, timeRange, isSpotifyMode])

    useEffect(() => {
        if (importedStats?.topArtistsByYear?.length > 0) {
            const years = [...new Set(importedStats.topArtistsByYear.map(a => a.year))];
            const maxYear = Math.max(...years);
            setSelectedYearArtists(maxYear);
        } else {
            setSelectedYearArtists(null);
        }
    }, [importedStats])

    const handleFileChange = (event) => {
        const file = event.target.files[0]
        setSelectedFile(file)
        setUploadStatus('')
    }

    const handleUpload = async () => {
        if (!activeUserId) {
            setUploadStatus('No logged-in user was found. Please connect with Spotify again.')
            return
        }

        if (!selectedFile) {
            setUploadStatus('Please select a Spotify ZIP file first.')
            return
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        try {
            setIsUploading(true)
            setUploadStatus('Importing your Spotify history...')

            const response = await fetch(
                `http://127.0.0.1:8080/api/import/spotify-zip?userId=${activeUserId}`,
                {
                    method: 'POST',
                    body: formData
                }
            )

            if (!response.ok) {
                throw new Error('Import failed')
            }

            const result = await response.json()

            setUploadStatus(
                `Import completed: ${result.importedRecords} imported, ${result.duplicateRecords} duplicates, ${result.skippedRecords} skipped.`
            )

            const data = await loadImportedStats(fromDate, toDate)
            const latestYear = getLatestAvailableYear(data)

            setSelectedHeatmapYear(latestYear)
            await loadDailyActivityForYear(latestYear)
        } catch (error) {
            setUploadStatus('Something went wrong while importing the ZIP file.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleApplyDateFilter = async () => {
        if (!fromDate || !toDate) {
            setDateFilterError('Please select both start and end dates.')
            return
        }

        if (fromDate > toDate) {
            setDateFilterError('The start date cannot be after the end date.')
            return
        }

        try {
            setDateFilterError('')

            const data = await loadImportedStats(fromDate, toDate)
            const latestYear = getLatestAvailableYear(data)

            setSelectedHeatmapYear(latestYear)
            await loadDailyActivityForYear(latestYear)

            setStatsPeriodLabel(`${fromDate} → ${toDate}`)
            setActiveAllTimeSection('overview')
        } catch (error) {
            setDateFilterError('Statistics could not be loaded for this period.')
        }
    }

    const handleClearDateFilter = async () => {
        try {
            setFromDate('')
            setToDate('')
            setDateFilterError('')

            const data = await loadImportedStats()
            const latestYear = getLatestAvailableYear(data)

            setSelectedHeatmapYear(latestYear)
            await loadDailyActivityForYear(latestYear)

            setStatsPeriodLabel('All time')
            setActiveAllTimeSection('overview')
        } catch (error) {
            setDateFilterError('All-time statistics could not be loaded.')
        }
    }

    const topTrack = topTracks[0]
    const topArtist = topArtists[0]
    const recentTrack = recentTracks[0]

    const hasImportedStats = importedStats !== null
    const availableHeatmapYears = getAvailableYears(importedStats)

    return (
        <div className="stats-page">
            <div className="stats-card">
                <button className="back-btn" onClick={onBackClick}>
                    Logout
                </button>

                <h1>{isSpotifyMode ? 'Spotify Listening Dashboard' : 'Manual Listening Dashboard'}</h1>

                <p className="stats-subtitle">
                    {isSpotifyMode
                        ? `Spotify account connected successfully. User ID: ${activeUserId}`
                        : `Manual account connected successfully. User ID: ${activeUserId}`}
                </p>

                {isSpotifyMode && spotifyProfile && (
                    <div className="profile-card">
                        <h2>Connected Spotify Account</h2>

                        <div className="profile-grid">
                            <div>
                                <span>Username</span>
                                <strong>{spotifyProfile.username || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Email</span>
                                <strong>{spotifyProfile.email || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Country</span>
                                <strong>{spotifyProfile.spotifyCountry || 'Not available'}</strong>
                            </div>

                            <div>
                                <span>Account type</span>
                                <strong>{spotifyProfile.spotifyProduct || 'Not available'}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {isSpotifyMode && spotifyStatus && (
                    <p className="stats-status">
                        {spotifyStatus}
                    </p>
                )}

                {isSpotifyMode && (
                    <>
                        <h2 className="section-title">Live Spotify Data</h2>

                        <div className="stats-grid">
                            <div className="stat-box">
                                <span className="stat-label">Top Spotify track</span>
                                <strong>{topTrack ? topTrack.name : 'Not available yet'}</strong>
                                <small>
                                    {topTrack?.artists?.map((artist) => artist.name).join(', ')}
                                </small>
                            </div>

                            <div className="stat-box">
                                <span className="stat-label">Top Spotify artist</span>
                                <strong>{topArtist ? topArtist.name : 'Not available yet'}</strong>
                            </div>

                            <div className="stat-box">
                                <span className="stat-label">Recently played</span>
                                <strong>{recentTrack ? recentTrack.name : 'Not available yet'}</strong>
                                <small>
                                    {recentTrack?.artists?.map((artist) => artist.name).join(', ')}
                                </small>
                            </div>

                            <div className="stat-box">
                                <span className="stat-label">Main genre</span>
                                <strong>{topArtist?.genres?.[0] || 'Not available yet'}</strong>
                            </div>
                        </div>
                    </>
                )}

                <h2 className="section-title">Imported History Analytics</h2>

                <div className="stats-grid">
                    <div className="stat-box">
                        <span className="stat-label">Imported plays</span>
                        <strong>{hasImportedStats ? importedStats.totalPlays : 'Requires ZIP import'}</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Imported listening time</span>
                        <strong>
                            {hasImportedStats
                                ? `${importedStats.totalHoursPlayed} hours`
                                : 'Requires ZIP import'}
                        </strong>
                    </div>
                </div>

                {hasImportedStats && (
                    <div className="all-time-section">
                        <div className="all-time-header">
                            <div>
                                <h2>All-Time Wrapped from Imported History</h2>
                                <p>
                                    Statistics generated from your imported Spotify listening history.
                                </p>
                                <p className="period-label">
                                    Current period: {statsPeriodLabel}
                                </p>
                            </div>

                            <div className="all-time-summary">
                                <strong>{importedStats.totalPlays}</strong>
                                <span>plays in period</span>
                            </div>
                        </div>

                        <div className="date-filter-card">
                            <div className="date-input-group">
                                <label>
                                    From
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(event) => setFromDate(event.target.value)}
                                    />
                                </label>

                                <label>
                                    To
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(event) => setToDate(event.target.value)}
                                    />
                                </label>
                            </div>

                            <div className="date-filter-actions">
                                <button onClick={handleApplyDateFilter}>
                                    Apply period
                                </button>

                                <button className="secondary-filter-btn" onClick={handleClearDateFilter}>
                                    Clear filter
                                </button>
                            </div>

                            {dateFilterError && (
                                <p className="date-filter-error">
                                    {dateFilterError}
                                </p>
                            )}
                        </div>

                        <div className="all-time-accordion">
                            <button
                                className={activeAllTimeSection === 'overview' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'overview' ? '' : 'overview')}
                            >
                                Overview
                                <span>{activeAllTimeSection === 'overview' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'overview' && (
                                <div className="accordion-content">
                                    <div className="overview-grid">
                                        <div className="overview-card">
                                            <span>Total plays</span>
                                            <strong>{importedStats.totalPlays}</strong>
                                        </div>

                                        <div className="overview-card">
                                            <span>Total listening time</span>
                                            <strong>{importedStats.totalHoursPlayed} hours</strong>
                                        </div>

                                        <div className="overview-card">
                                            <span>Top imported artist</span>
                                            <strong>{importedStats.top10Artists?.[0]?.artistName || 'No data'}</strong>
                                        </div>

                                        <div className="overview-card">
                                            <span>Top imported track</span>
                                            <strong>{importedStats.top10Tracks?.[0]?.trackName || 'No data'}</strong>
                                        </div>

                                        <div className="overview-card">
                                            <span>Top imported album</span>
                                            <strong>{importedStats.top10Albums?.[0]?.albumName || 'No data'}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'heatmap' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'heatmap' ? '' : 'heatmap')}
                            >
                                Activity Heatmap
                                <span>{activeAllTimeSection === 'heatmap' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'heatmap' && (
                                <div className="accordion-content">
                                    <ActivityHeatmap
                                        data={dailyActivity}
                                        selectedYear={selectedHeatmapYear}
                                        availableYears={availableHeatmapYears}
                                        onYearChange={handleHeatmapYearChange}
                                    />
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'albums' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'albums' ? '' : 'albums')}
                            >
                                Top Imported Albums
                                <span>{activeAllTimeSection === 'albums' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'albums' && (
                                <div className="accordion-content">
                                    {importedStats.top10Albums?.length > 0 ? (
                                        <div className="compact-ranking-list">
                                            {importedStats.top10Albums.map((album, index) => (
                                                <div className="compact-ranking-item" key={`${album.albumName}-${album.artistName}-${index}`}>
                                                    <span>{index + 1}</span>

                                                    <div>
                                                        <strong>{album.albumName}</strong>
                                                        <p>
                                                            {album.artistName} · {album.playCount} plays · {formatMinutes(album.totalMsPlayed)} min
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-stats-message">No albums found for this period.</p>
                                    )}
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'tracks' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'tracks' ? '' : 'tracks')}
                            >
                                Top Imported Tracks
                                <span>{activeAllTimeSection === 'tracks' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'tracks' && (
                                <div className="accordion-content">
                                    {importedStats.top10Tracks?.length > 0 ? (
                                        <div className="compact-ranking-list">
                                            {importedStats.top10Tracks.map((track, index) => (
                                                <div className="compact-ranking-item" key={`${track.trackName}-${index}`}>
                                                    <span>{index + 1}</span>

                                                    <div>
                                                        <strong>{track.trackName}</strong>
                                                        <p>
                                                            {track.artistName} · {track.playCount} plays · {formatMinutes(track.totalMsPlayed)} min
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-stats-message">No tracks found for this period.</p>
                                    )}
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'artists' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'artists' ? '' : 'artists')}
                            >
                                Top Imported Artists
                                <span>{activeAllTimeSection === 'artists' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'artists' && (
                                <div className="accordion-content">
                                    {importedStats.top10Artists?.length > 0 ? (
                                        <div className="compact-ranking-list">
                                            {importedStats.top10Artists.map((artist, index) => (
                                                <div className="compact-ranking-item" key={`${artist.artistName}-${index}`}>
                                                    <span>{index + 1}</span>

                                                    <div>
                                                        <strong>{artist.artistName}</strong>
                                                        <p>
                                                            {artist.playCount} plays · {formatMinutes(artist.totalMsPlayed)} min
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="empty-stats-message">No artists found for this period.</p>
                                    )}
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'activity' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'activity' ? '' : 'activity')}
                            >
                                Listening Activity
                                <span>{activeAllTimeSection === 'activity' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'activity' && (
                                <div className="accordion-content">
                                    <div className="all-time-grid">
                                        <div className="all-time-panel">
                                            <h3>By Year</h3>

                                            {importedStats.listeningActivityByYear?.length > 0 ? (
                                                <div className="bar-chart-list">
                                                    {importedStats.listeningActivityByYear.map((item) => {
                                                        const maxPlayCount = getMaxPlayCount(importedStats.listeningActivityByYear)
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
                                            ) : (
                                                <p className="empty-stats-message">No yearly activity for this period.</p>
                                            )}
                                        </div>

                                        <div className="all-time-panel">
                                            <h3>By Month</h3>

                                            {importedStats.listeningActivityByMonth?.length > 0 ? (
                                                <div className="bar-chart-list">
                                                    {importedStats.listeningActivityByMonth.map((item) => {
                                                        const maxPlayCount = getMaxPlayCount(importedStats.listeningActivityByMonth)
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
                                            ) : (
                                                <p className="empty-stats-message">No monthly activity for this period.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                className={activeAllTimeSection === 'evolution' ? 'accordion-btn active' : 'accordion-btn'}
                                onClick={() => setActiveAllTimeSection(activeAllTimeSection === 'evolution' ? '' : 'evolution')}
                            >
                                Top Artists by Year
                                <span>{activeAllTimeSection === 'evolution' ? '−' : '+'}</span>
                            </button>

                            {activeAllTimeSection === 'evolution' && (
                                <div className="accordion-content">
                                    {importedStats.topArtistsByYear?.length > 0 ? (
                                        (() => {
                                            const artistsByYear = importedStats.topArtistsByYear
                                            const years = [...new Set(artistsByYear.map(a => a.year))].sort((a, b) => b - a)
                                            const activeYear = selectedYearArtists || years[0]
                                            const filteredArtists = artistsByYear
                                                .filter(artist => artist.year === activeYear)
                                                .sort((a, b) => b.playCount - a.playCount)

                                            return (
                                                <div className="yearly-artists-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                        <span style={{ fontSize: '13px', color: '#a3a3a3', fontWeight: 'bold' }}>📅 Select Year:</span>
                                                        <div className="year-selector-chips" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {years.map(year => (
                                                                <button
                                                                    key={year}
                                                                    onClick={() => setSelectedYearArtists(year)}
                                                                    className={activeYear === year ? 'tab-btn active' : 'tab-btn'}
                                                                    style={{ 
                                                                        padding: '6px 14px', 
                                                                        borderRadius: '20px', 
                                                                        border: '1px solid ' + (activeYear === year ? '#1db954' : 'rgba(255, 255, 255, 0.1)'),
                                                                        background: activeYear === year ? 'rgba(29, 185, 84, 0.15)' : 'transparent',
                                                                        color: activeYear === year ? '#1db954' : '#fff',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        fontSize: '13px',
                                                                        fontWeight: 'bold',
                                                                        outline: 'none'
                                                                    }}
                                                                >
                                                                    {year}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="compact-ranking-list">
                                                        {filteredArtists.length > 0 ? (
                                                            filteredArtists.map((artist, index) => (
                                                                <div
                                                                    className="compact-ranking-item"
                                                                    key={`${artist.year}-${artist.artistName}-${index}`}
                                                                >
                                                                    <span>{index + 1}</span>

                                                                    <div>
                                                                        <strong>{artist.artistName}</strong>
                                                                        <p>
                                                                            {artist.playCount} plays · {formatMinutes(artist.totalMsPlayed)} min
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="empty-stats-message">No artists found for the selected year.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })()
                                    ) : (
                                        <p className="empty-stats-message">No artist evolution data for this period.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isSpotifyMode && (
                    <div className="time-range-tabs">
                        <button
                            className={timeRange === 'short_term' ? 'tab-btn active' : 'tab-btn'}
                            onClick={() => setTimeRange('short_term')}
                        >
                            Last 4 weeks
                        </button>

                        <button
                            className={timeRange === 'medium_term' ? 'tab-btn active' : 'tab-btn'}
                            onClick={() => setTimeRange('medium_term')}
                        >
                            Last 6 months
                        </button>

                        <button
                            className={timeRange === 'long_term' ? 'tab-btn active' : 'tab-btn'}
                            onClick={() => setTimeRange('long_term')}
                        >
                            Long term
                        </button>
                    </div>
                )}

                <div className="section-tabs">
                    {isSpotifyMode && (
                        <>
                            <button
                                className={activeSection === 'tracks' ? 'tab-btn active' : 'tab-btn'}
                                onClick={() => setActiveSection('tracks')}
                            >
                                Show Top Tracks
                            </button>

                            <button
                                className={activeSection === 'artists' ? 'tab-btn active' : 'tab-btn'}
                                onClick={() => setActiveSection('artists')}
                            >
                                Show Top Artists
                            </button>

                            <button
                                className={activeSection === 'recent' ? 'tab-btn active' : 'tab-btn'}
                                onClick={() => setActiveSection('recent')}
                            >
                                Show Recently Played
                            </button>
                        </>
                    )}

                    <button
                        className={activeSection === 'upload' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveSection('upload')}
                    >
                        Upload ZIP
                    </button>
                </div>

                {isSpotifyMode && activeSection === 'tracks' && topTracks.length > 0 && (
                    <div className="ranking-section">
                        <h2>Top Tracks from Spotify</h2>

                        <div className="ranking-list">
                            {topTracks.map((track, index) => (
                                <div className="ranking-item" key={`${track.id}-${index}`}>
                                    <span>{index + 1}</span>

                                    <div>
                                        <strong>{track.name}</strong>
                                        <p>
                                            {track.artists?.map((artist) => artist.name).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isSpotifyMode && activeSection === 'artists' && topArtists.length > 0 && (
                    <div className="ranking-section">
                        <h2>Top Artists from Spotify</h2>

                        <div className="ranking-list">
                            {topArtists.map((artist, index) => (
                                <div className="ranking-item" key={`${artist.id}-${index}`}>
                                    <span>{index + 1}</span>

                                    <div>
                                        <strong>{artist.name}</strong>
                                        <p>
                                            {artist.genres?.length > 0
                                                ? artist.genres.join(', ')
                                                : 'No genre available'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isSpotifyMode && activeSection === 'recent' && recentTracks.length > 0 && (
                    <div className="ranking-section">
                        <h2>Recently Played</h2>

                        <div className="ranking-list">
                            {recentTracks.map((track, index) => (
                                <div className="ranking-item" key={`${track.id}-${index}`}>
                                    <span>{index + 1}</span>

                                    <div>
                                        <strong>{track.name}</strong>
                                        <p>
                                            {track.artists?.map((artist) => artist.name).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'upload' && (
                    <div className="upload-section">
                        <h2>Upload your Spotify history</h2>

                        <p>
                            Upload your Spotify ZIP export to generate all-time statistics,
                            yearly statistics, top tracks, top artists and top albums.
                        </p>

                        <input
                            type="file"
                            accept=".zip"
                            onChange={handleFileChange}
                        />

                        <button 
                            className="upload-btn" 
                            onClick={handleUpload}
                            disabled={isUploading}
                        >
                            {isUploading ? 'Importing...' : 'Upload Spotify ZIP'}
                        </button>

                        {uploadStatus && (
                            <p className="upload-status">
                                {uploadStatus}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default SpotifyStatsPage