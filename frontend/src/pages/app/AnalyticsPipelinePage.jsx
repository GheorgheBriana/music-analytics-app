import { useEffect, useState } from 'react'
import { getWarehouseStatus, rebuildAnalyticsPipeline } from '../../api/analyticsApi'

function AnalyticsPipelinePage() {
    const [status, setStatus] = useState(null)
    const [pipelineResult, setPipelineResult] = useState(null)
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState('')

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

            const result = await rebuildAnalyticsPipeline(200, 500)
            setPipelineResult(result)

            await loadStatus()
        } catch (error) {
            setError('Analytics pipeline could not be executed.')
        } finally {
            setRunning(false)
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
                    <h2>Data Warehouse Pipeline</h2>
                    <p>
                        This module shows how operational Spotify listening records are propagated into the analytical Data Warehouse.
                    </p>
                    <p className="period-label">
                        OLTP → ETL → Data Warehouse → BI reports
                    </p>
                </div>

                <button
                    className="upload-btn"
                    onClick={handleRunPipeline}
                    disabled={running}
                >
                    {running ? 'Running pipeline...' : 'Run Analytics Pipeline'}
                </button>
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
