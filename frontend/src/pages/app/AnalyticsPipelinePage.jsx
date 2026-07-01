import { useEffect, useState } from 'react'
import { rebuildAnalyticsPipeline, runMusicBrainzEnrichment } from '../../api/analyticsApi'

function AnalyticsPipelinePage() {
    const [enrichmentStatus, setEnrichmentStatus] = useState(null)
    const [dwStats, setDwStats] = useState(null)
    const [dwQuality, setDwQuality] = useState(null)
    const [pipelineResult, setPipelineResult] = useState(null)
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [enriching, setEnriching] = useState(false)
    const [refreshingMvs, setRefreshingMvs] = useState(false)
    const [mvRefreshResult, setMvRefreshResult] = useState('')
    const [error, setError] = useState('')
    
    const [backfillLimit, setBackfillLimit] = useState(500000)
    const [refreshLimit, setRefreshLimit] = useState(500000)
    const [enrichmentLimit, setEnrichmentLimit] = useState(50)
    const [enrichmentResult, setEnrichmentResult] = useState(null)

    const API_BASE_URL = 'http://localhost:8080'

    async function loadEnrichmentStatus() {
        try {
            const userId = localStorage.getItem('userId') || localStorage.getItem('original_user_id')
            const res = await fetch(`${API_BASE_URL}/api/admin/enrichment/status`, {
                headers: {
                    'X-User-Id': userId || ''
                }
            })
            if (res.ok) {
                const data = await res.json()
                setEnrichmentStatus(data)
            }
        } catch (_) {}
    }

    async function loadDwData() {
        try {
            const userId = localStorage.getItem('userId') || localStorage.getItem('original_user_id')
            const headers = { 'X-User-Id': userId || '' }
            
            const [statsRes, qualityRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/dw/stats`, { headers }),
                fetch(`${API_BASE_URL}/api/admin/dw/quality`, { headers })
            ])

            if (statsRes.ok) {
                const statsData = await statsRes.json()
                setDwStats(statsData)
            }
            if (qualityRes.ok) {
                const qualityData = await qualityRes.json()
                setDwQuality(qualityData)
            }
        } catch (err) {
            console.error("Failed to load DW stats:", err)
        }
    }

    useEffect(() => {
        async function init() {
            setLoading(true)
            await Promise.all([
                loadEnrichmentStatus(),
                loadDwData()
            ])
            setLoading(false)
        }
        init()
    }, [])

    async function handleRunPipeline() {
        console.log("Running DW pipeline", backfillLimit, refreshLimit)
        try {
            setRunning(true)
            setError('')
            setPipelineResult(null)

            const result = await rebuildAnalyticsPipeline(backfillLimit, refreshLimit)
            setPipelineResult(result)
            await loadDwData()
        } catch (error) {
            console.error("Error running pipeline:", error)
            setError(error.message || 'Analytics pipeline could not be executed.')
        } finally {
            setRunning(false)
        }
    }

    async function handleRunEnrichment() {
        try {
            setEnriching(true)
            setError('')
            setEnrichmentResult(null)

            const result = await runMusicBrainzEnrichment(enrichmentLimit)
            setEnrichmentResult(result)
            await loadEnrichmentStatus()
        } catch (error) {
            setError('MusicBrainz enrichment could not be executed.')
        } finally {
            setEnriching(false)
        }
    }

    async function handleRefreshMvs() {
        try {
            setRefreshingMvs(true)
            setError('')
            setMvRefreshResult('')
            const userId = localStorage.getItem('userId') || localStorage.getItem('original_user_id')
            const response = await fetch(`${API_BASE_URL}/api/admin/dw/refresh-mvs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId || ''
                }
            })
            if (!response.ok) {
                throw new Error('Failed to refresh materialized views.')
            }
            setMvRefreshResult('Materialized views refreshed successfully.')
            await loadDwData()
        } catch (err) {
            setError(err.message || 'Could not refresh materialized views.')
        } finally {
            setRefreshingMvs(false)
        }
    }

    if (loading) {
        return (
            <div className="admin-panel" style={{ color: '#fff', marginTop: '20px' }}>
                <p className="empty-stats-message">Loading DW control status...</p>
            </div>
        )
    }

    return (
        <div className="admin-panel" style={{ color: '#fff', marginTop: '20px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h3>DW Pipeline & Enrichment Control</h3>
                <p style={{ color: '#a3a3a3', fontSize: '13px', margin: '4px 0 0 0' }}>
                    Manage the operational Spotify listening records propagation, MusicBrainz metadata enrichment, and analytical materialized views.
                </p>
            </div>

            {error && (
                <p className="date-filter-error" style={{ marginBottom: '20px' }}>{error}</p>
            )}

            {/* Part 1: MusicBrainz Metadata Enrichment */}
            <div className="pipeline-message-card" style={{ marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.1)', paddingBottom: '8px' }}>
                    1. MusicBrainz Metadata Enrichment
                </h4>
                <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '16px' }}>
                    Fetches and stores rich genres and tags from MusicBrainz API for tracks and artists stored in the OLTP database.
                </p>

                {enrichmentStatus && (
                    <>
                        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px' }}>{enrichmentStatus.totalArtists.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Total Artists</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px', color: '#22c55e' }}>{enrichmentStatus.enrichedArtists.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Enriched</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px', color: '#eab308' }}>{enrichmentStatus.pendingArtists.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Pending</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px' }}>{enrichmentStatus.totalGenres}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Genres</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px' }}>{enrichmentStatus.totalTrackGenreLinks.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Track-Genre Links</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px', color: '#1db954' }}>{enrichmentStatus.enrichmentProgressPercentage.toFixed(1)}%</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Progress</div>
                            </div>
                        </div>

                        <div className="admin-progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
                            <div className="admin-progress-fill" style={{ height: '100%', background: '#1db954', width: `${enrichmentStatus.enrichmentProgressPercentage}%`, transition: 'width 0.4s ease' }} />
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input 
                        type="number" 
                        value={enrichmentLimit} 
                        onChange={e => setEnrichmentLimit(Number(e.target.value))} 
                        style={{ width: '90px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} 
                    />
                    <span style={{ fontSize: '13px', color: '#a3a3a3' }}>artists limit</span>
                    <button 
                        className="admin-btn primary" 
                        onClick={handleRunEnrichment} 
                        disabled={enriching} 
                        style={{ margin: '0 0 0 auto', padding: '10px 20px' }}
                    >
                        {enriching ? 'Enriching...' : 'Start Enrichment'}
                    </button>
                </div>

                {enrichmentResult && (
                    <p style={{ marginTop: '12px', fontSize: '13px', color: '#1db954' }}>
                        ✔ Enrichment Completed: Processed {enrichmentResult.processed} artists, enriched {enrichmentResult.artistsEnrichedWithTags} with tags.
                    </p>
                )}
            </div>

            {/* Part 2: Data Warehouse ETL Pipeline */}
            <div className="pipeline-message-card" style={{ marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.1)', paddingBottom: '8px' }}>
                    2. Data Warehouse ETL Pipeline
                </h4>
                <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '16px' }}>
                    Triggers transactional Spotify listening records propagation from OLTP schemas to analytical Data Warehouse schemas, including dimension building and Star Schema mapping.
                </p>

                {dwQuality && (
                    <>
                        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px' }}>{dwQuality.oltpListeningRecordsCount.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>OLTP Records</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px', color: '#1db954' }}>{dwQuality.dwFactsCount.toLocaleString()}</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>DW Facts (Sync)</div>
                            </div>
                            <div className="admin-stat-card" style={{ padding: '10px' }}>
                                <div className="stat-value" style={{ fontSize: '18px', color: '#3b82f6' }}>{dwQuality.dwCoveragePercentage.toFixed(1)}%</div>
                                <div className="stat-label" style={{ fontSize: '11px' }}>Sync Coverage</div>
                            </div>
                            {dwStats && (
                                <>
                                    <div className="admin-stat-card" style={{ padding: '10px' }}>
                                        <div className="stat-value" style={{ fontSize: '18px' }}>{dwStats.totalTracks.toLocaleString()}</div>
                                        <div className="stat-label" style={{ fontSize: '11px' }}>DW Tracks</div>
                                    </div>
                                    <div className="admin-stat-card" style={{ padding: '10px' }}>
                                        <div className="stat-value" style={{ fontSize: '18px' }}>{dwStats.totalArtists.toLocaleString()}</div>
                                        <div className="stat-label" style={{ fontSize: '11px' }}>DW Artists</div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="admin-progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
                            <div className="admin-progress-fill" style={{ height: '100%', background: '#3b82f6', width: `${Math.min(100, dwQuality.dwCoveragePercentage)}%`, transition: 'width 0.4s ease' }} />
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#a3a3a3' }}>Backfill Limit</span>
                        <input 
                            type="number" 
                            value={backfillLimit} 
                            onChange={e => setBackfillLimit(Number(e.target.value))} 
                            style={{ width: '100px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#a3a3a3' }}>Refresh Limit</span>
                        <input 
                            type="number" 
                            value={refreshLimit} 
                            onChange={e => setRefreshLimit(Number(e.target.value))} 
                            style={{ width: '100px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                    </div>
                    <button 
                            className="admin-btn primary" 
                            onClick={handleRunPipeline} 
                            disabled={running} 
                            style={{ margin: 'auto 0 0 auto', padding: '10px 20px' }}
                    >
                        {running ? 'Running...' : 'Run Global Pipeline'}
                    </button>
                </div>
            </div>

            {/* Part 3: Materialized Views Management */}
            <div className="pipeline-message-card" style={{ marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)', padding: '20px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.1)', paddingBottom: '8px' }}>
                    3. Materialized Views Management
                </h4>
                <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '16px' }}>
                    Materialized views must be refreshed after ETL pipeline runs to propagate the newly processed warehouse events into BI dashboards concurrently.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {mvRefreshResult && (
                        <span style={{ fontSize: '13px', color: '#1db954' }}>✔ {mvRefreshResult}</span>
                    )}
                    <button 
                        className="admin-btn secondary" 
                        onClick={handleRefreshMvs} 
                        disabled={refreshingMvs} 
                        style={{ margin: '0 0 0 auto', padding: '10px 20px' }}
                    >
                        {refreshingMvs ? 'Refreshing...' : 'Refresh Materialized Views'}
                    </button>
                </div>
            </div>

            {/* Last Execution Results */}
            {pipelineResult && (
                <div className="pipeline-result-card" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '10px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>Last Pipeline Execution Status</h4>
                    <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                        <div className="admin-stat-card" style={{ padding: '12px' }}>
                            <div className="stat-value" style={{ fontSize: '18px' }}>{pipelineResult.backfillLimit}</div>
                            <div className="stat-label" style={{ fontSize: '11px' }}>Backfill Limit</div>
                        </div>
                        <div className="admin-stat-card" style={{ padding: '12px' }}>
                            <div className="stat-value" style={{ fontSize: '18px' }}>{pipelineResult.refreshLimit}</div>
                            <div className="stat-label" style={{ fontSize: '11px' }}>Refresh Limit</div>
                        </div>
                        <div className="admin-stat-card" style={{ padding: '12px' }}>
                            <div className="stat-value" style={{ fontSize: '18px', color: '#1db954' }}>{pipelineResult.warehouseRefresh?.insertedFacts ?? 0}</div>
                            <div className="stat-label" style={{ fontSize: '11px' }}>Inserted Facts</div>
                        </div>
                        <div className="admin-stat-card" style={{ padding: '12px' }}>
                            <div className="stat-value" style={{ fontSize: '18px' }}>{pipelineResult.warehouseRefresh?.recordsWithFallbackDimensions ?? 0}</div>
                            <div className="stat-label" style={{ fontSize: '11px' }}>Fallback Tracks</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AnalyticsPipelinePage
