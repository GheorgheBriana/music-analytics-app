import { useEffect, useState } from 'react'
import { getWarehouseStatus, rebuildAnalyticsPipeline, runMusicBrainzEnrichment } from '../../api/analyticsApi'

function AnalyticsPipelinePage() {
    const [status, setStatus] = useState(null)
    const [pipelineResult, setPipelineResult] = useState(null)
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [enriching, setEnriching] = useState(false)
    const [error, setError] = useState('')
    
    const [backfillLimit, setBackfillLimit] = useState(20000)
    const [refreshLimit, setRefreshLimit] = useState(20000)
    const [enrichmentLimit, setEnrichmentLimit] = useState(50)
    const [enrichmentResult, setEnrichmentResult] = useState(null)

    async function loadStatus() {
        try {
            setError('')
            const data = await getWarehouseStatus()
            setStatus(data)
        } catch (error) {
            setError('Could not load Data Warehouse status.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadStatus()
    }, [])

    async function handleRunPipeline() {
        try {
            setRunning(true)
            setError('')
            setPipelineResult(null)

            const result = await rebuildAnalyticsPipeline(backfillLimit, refreshLimit)
            setPipelineResult(result)

            await loadStatus()
        } catch (error) {
            setError('Analytics pipeline could not be executed.')
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
        } catch (error) {
            setError('MusicBrainz enrichment could not be executed.')
        } finally {
            setEnriching(false)
        }
    }

    function renderDimensionCards() {
        const dimensions = status?.dimensions || {}

        return Object.entries(dimensions).map(([name, value]) => (
            <div className="overview-card" key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
            </div>
        ))
    }

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Data Warehouse Pipeline</h2>
                <p className="empty-stats-message">Loading warehouse status...</p>
            </div>
        )
    }

    return (
        <div className="all-time-section" style={{ background: 'transparent', border: 'none', padding: '0', marginTop: '20px' }}>
            <div className="all-time-header">
                <div>
                    <h2>DW Control Center</h2>
                    <p>
                        Manage operational Spotify listening records propagation into the analytical Data Warehouse and API enrichments.
                    </p>
                    <p className="period-label">
                        OLTP → API Enrichment → Data Warehouse → BI reports
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                <div className="pipeline-message-card" style={{ flex: 1, margin: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <strong style={{ display: 'block', marginBottom: '12px' }}>1. MusicBrainz Metadata Enrichment</strong>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input type="number" value={enrichmentLimit} onChange={e => setEnrichmentLimit(e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: '13px', color: '#a3a3a3' }}>artists limit</span>
                        <button className="upload-btn" onClick={handleRunEnrichment} disabled={enriching} style={{ marginLeft: 'auto' }}>
                            {enriching ? 'Enriching...' : 'Run Enrichment'}
                        </button>
                    </div>
                    {enrichmentResult && (
                        <p style={{ marginTop: '12px', fontSize: '13px', color: '#1db954' }}>
                            Processed {enrichmentResult.processed} artists, enriched {enrichmentResult.artistsEnrichedWithTags} with tags.
                        </p>
                    )}
                </div>

                <div className="pipeline-message-card" style={{ flex: 1, margin: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <strong style={{ display: 'block', marginBottom: '12px' }}>2. Data Warehouse Pipeline</strong>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input type="number" value={backfillLimit} onChange={e => setBackfillLimit(e.target.value)} style={{ width: '90px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: '13px', color: '#a3a3a3' }}>backfill / refresh</span>
                        <input type="number" value={refreshLimit} onChange={e => setRefreshLimit(e.target.value)} style={{ width: '90px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <button className="upload-btn" onClick={handleRunPipeline} disabled={running} style={{ marginLeft: 'auto' }}>
                            {running ? 'Running...' : 'Run Pipeline'}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <p className="date-filter-error">{error}</p>
            )}

            {status && (
                <>
                    <div className="overview-grid">
                        <div className="overview-card">
                            <span>OLTP records</span>
                            <strong>{status.operationalListeningRecords}</strong>
                        </div>

                        <div className="overview-card">
                            <span>Warehouse facts</span>
                            <strong>{status.warehouseFacts}</strong>
                        </div>

                        <div className="overview-card">
                            <span>Coverage</span>
                            <strong>{status.warehouseCoveragePercent}%</strong>
                        </div>

                        <div className="overview-card">
                            <span>Ready for reports</span>
                            <strong>{status.readyForReports ? 'Yes' : 'No'}</strong>
                        </div>
                    </div>

                    <div className="pipeline-message-card">
                        <strong>Status message</strong>
                        <p>{status.message}</p>
                    </div>

                    <h3 className="section-title">Dimension tables</h3>
                    <div className="overview-grid">
                        {renderDimensionCards()}
                    </div>
                </>
            )}

            {pipelineResult && (
                <div className="pipeline-result-card">
                    <h3>Last pipeline execution</h3>

                    <div className="overview-grid">
                        <div className="overview-card">
                            <span>Backfill limit</span>
                            <strong>{pipelineResult.backfillLimit}</strong>
                        </div>

                        <div className="overview-card">
                            <span>Refresh limit</span>
                            <strong>{pipelineResult.refreshLimit}</strong>
                        </div>

                        <div className="overview-card">
                            <span>Inserted facts</span>
                            <strong>{pipelineResult.warehouseRefresh?.insertedFacts ?? 0}</strong>
                        </div>

                        <div className="overview-card">
                            <span>Fallback dimensions</span>
                            <strong>{pipelineResult.warehouseRefresh?.recordsWithFallbackDimensions ?? 0}</strong>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AnalyticsPipelinePage
