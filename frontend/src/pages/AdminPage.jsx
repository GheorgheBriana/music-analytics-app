import { useState, useEffect } from 'react';
import { adminApi } from '../api/adminApi';
import AnalyticsPipelinePage from './app/AnalyticsPipelinePage';
import './AdminPage.css';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [users, setUsers] = useState([]);
    const [dwStats, setDwStats] = useState(null);
    const [recentActions, setRecentActions] = useState([]);
    const [dataQuality, setDataQuality] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Schema Explorer States
    const [schemaOltpTables, setSchemaOltpTables] = useState([]);
    const [schemaDwTables, setSchemaDwTables] = useState([]);
    const [schemaMvs, setSchemaMvs] = useState([]);
    const [schemaIndexes, setSchemaIndexes] = useState([]);
    const [schemaPartitions, setSchemaPartitions] = useState([]);

    useEffect(() => {
        if (activeTab === 'overview') loadRecentActions();
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'dw') {
            loadDwStats();
            loadUsers(); 
            loadRecentActions(); 
            loadDataQuality(); 
        }
        if (activeTab === 'quality') loadDataQuality();
        if (activeTab === 'schema') loadSchemaData();
    }, [activeTab]);

    const loadSchemaData = async () => {
        setLoading(true);
        try {
            const oltp = await adminApi.getOltpTables();
            const dw = await adminApi.getDwTables();
            const mvs = await adminApi.getMaterializedViews();
            const idxs = await adminApi.getDwIndexes();
            const parts = await adminApi.getPartitions();
            setSchemaOltpTables(oltp);
            setSchemaDwTables(dw);
            setSchemaMvs(mvs);
            setSchemaIndexes(idxs);
            setSchemaPartitions(parts);
        } catch (e) {
            setMessage('Failed to load schema information: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await adminApi.listUsers();
            setUsers(data);
        } catch (e) {
            setMessage('Failed to load users: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadDwStats = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDwStats();
            setDwStats(data);
        } catch (e) {
            setMessage('Failed to load DW stats: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadRecentActions = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getRecentActions();
            setRecentActions(data);
        } catch (e) {
            setMessage('Failed to load recent actions: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadDataQuality = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDataQualityStats();
            setDataQuality(data);
        } catch (e) {
            setMessage('Failed to load data quality: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshUserDw = async (targetUserId) => {
        setLoading(true);
        setMessage('Incremental synchronization in progress for user...');
        try {
            const result = await adminApi.refreshWarehouseForUser(targetUserId, 1000);
            setMessage(`Sync completed for user ${targetUserId}: ${result.insertedFacts} new facts inserted.`);
            await loadDwStats();
            await loadRecentActions();
            await loadDataQuality();
        } catch (e) {
            setMessage('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h2>Admin Dashboard</h2>
                <p>Manage users, data warehouse, and enrichment pipelines</p>
            </div>

            <div className="admin-tabs">
                <button onClick={() => setActiveTab('overview')}
                    className={activeTab === 'overview' ? 'active' : ''}>
                    Overview
                </button>
                <button onClick={() => setActiveTab('users')}
                    className={activeTab === 'users' ? 'active' : ''}>
                    Users
                </button>
                <button onClick={() => setActiveTab('pipeline')}
                    className={activeTab === 'pipeline' ? 'active' : ''}>
                    Pipeline & Enrichment
                </button>
                <button onClick={() => setActiveTab('dw')}
                    className={activeTab === 'dw' ? 'active' : ''}>
                    Data Warehouse
                </button>
                <button onClick={() => setActiveTab('schema')}
                    className={activeTab === 'schema' ? 'active' : ''}>
                    Schema Explorer
                </button>
                <button onClick={() => setActiveTab('quality')}
                    className={activeTab === 'quality' ? 'active' : ''}>
                    System Health & Data Quality
                </button>
            </div>

            {message && <div className="admin-message" style={{ background: 'rgba(29, 185, 84, 0.1)', border: '1px solid #1db954', color: '#1db954', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{message}</span>
                <button onClick={() => setMessage('')} style={{ background: 'transparent', border: 'none', color: '#1db954', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
            </div>}
            {loading && <div className="admin-loading" style={{ color: '#a3a3a3', fontStyle: 'italic', marginBottom: '16px' }}>Loading...</div>}

            <div className="admin-content">
                {activeTab === 'overview' && (
                    <OverviewSection actions={recentActions} />
                )}

                {activeTab === 'users' && (
                    <UsersSection users={users} />
                )}

                {activeTab === 'dw' && dwStats && (
                    <DwSection
                        stats={dwStats}
                        users={users}
                        dataQuality={dataQuality}
                        recentActions={recentActions}
                        onRefreshUserDw={handleRefreshUserDw}
                    />
                )}

                {activeTab === 'pipeline' && (
                    <AnalyticsPipelinePage />
                )}

                {activeTab === 'quality' && dataQuality && (
                    <DataQualitySection dataQuality={dataQuality} />
                )}

                {activeTab === 'schema' && (
                    <SchemaSection 
                        oltp={schemaOltpTables}
                        dw={schemaDwTables}
                        mvs={schemaMvs}
                        indexes={schemaIndexes}
                        partitions={schemaPartitions}
                    />
                )}
            </div>
        </div>
    );
}

// ============ OVERVIEW SECTION ============
function OverviewSection({ actions }) {
    const formatDetails = (details) => {
        if (!details) return '';
        if (details.includes('error=')) {
            const errIndex = details.indexOf('error=');
            let errText = details.substring(errIndex + 6);
            if (errText.includes('Detail:')) {
                const detailIndex = errText.indexOf('Detail:');
                errText = errText.substring(detailIndex + 7);
            }
            if (errText.length > 55) {
                errText = errText.substring(0, 52) + '...';
            }
            return `Failed: ${errText}`;
        }
        if (details.length > 60) {
            return details.substring(0, 57) + '...';
        }
        return details;
    };

    return (
        <div className="admin-panel">
            {/* Pipeline Diagram */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '32px',
            }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Data Pipeline & Analytics Architecture Flow
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '130px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase' }}>1. Source Data</span>
                        <strong style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '4px' }}>Spotify ZIP Import</strong>
                    </div>
                    <div style={{ color: '#555', fontWeight: 'bold' }}>➔</div>
                    <div style={{ flex: 1, minWidth: '130px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase' }}>2. Transactional</span>
                        <strong style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '4px' }}>Operational OLTP</strong>
                    </div>
                    <div style={{ color: '#1db954', fontWeight: 'bold' }}>➔</div>
                    <div style={{ flex: 1, minWidth: '130px', background: 'rgba(29,185,84,0.05)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#1db954', textTransform: 'uppercase' }}>3. Enrichment</span>
                        <strong style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '4px' }}>MusicBrainz Genres</strong>
                    </div>
                    <div style={{ color: '#1db954', fontWeight: 'bold' }}>➔</div>
                    <div style={{ flex: 1, minWidth: '130px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase' }}>4. Depository</span>
                        <strong style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '4px' }}>DW Star Schema</strong>
                    </div>
                    <div style={{ color: '#555', fontWeight: 'bold' }}>➔</div>
                    <div style={{ flex: 1, minWidth: '130px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase' }}>5. BI Reporting</span>
                        <strong style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '4px' }}>Materialized Views</strong>
                    </div>
                </div>
            </div>

            <h3>Recent Admin Actions</h3>
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Admin ID</th>
                            <th>Action Type</th>
                            <th>Details</th>
                            <th>Status</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map(a => (
                            <tr key={a.id}>
                                <td>{a.id}</td>
                                <td>{a.adminUserId}</td>
                                <td style={{ fontFamily: 'monospace' }}>{a.actionType}</td>
                                <td title={a.actionDetails}>{formatDetails(a.actionDetails)}</td>
                                <td>
                                    <span style={{ 
                                        background: a.status === 'SUCCESS' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: a.status === 'SUCCESS' ? '#22c55e' : '#ef4444',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                    }}>
                                        {a.status}
                                    </span>
                                </td>
                                <td>{new Date(a.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                        {actions.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>No recent actions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============ DATA WAREHOUSE SECTION ============
function DwSection({ stats, dataQuality, recentActions }) {
    const oltpCount = dataQuality?.oltpListeningRecordsCount || 0;
    const dwCount = stats?.totalFacts || dataQuality?.dwFactsCount || 0;
    const pendingSync = Math.max(0, oltpCount - dwCount);
    const coverage = dataQuality?.dwCoveragePercentage || (oltpCount === 0 ? 0 : (dwCount * 100) / oltpCount);

    const lastPipelineAction = recentActions?.find(a =>
        a.actionType === 'RUN_DW_PIPELINE' || a.actionType === 'RUN_DW_PIPELINE_USER'
    );

    let statusColor = '#ef4444'; 
    let statusText = 'OUT OF SYNC';
    if (pendingSync === 0) {
        statusColor = '#22c55e'; 
        statusText = 'IN SYNC';
    } else if (pendingSync < 100) {
        statusColor = '#eab308'; 
        statusText = 'PENDING SYNC';
    }

    const lastSyncText = lastPipelineAction 
        ? `Last execution: ${lastPipelineAction.status} (${new Date(lastPipelineAction.createdAt).toLocaleTimeString()}) — processed ${dwCount.toLocaleString()} of ${oltpCount.toLocaleString()} records. ${pendingSync > 0 ? `${pendingSync.toLocaleString()} still pending.` : 'All synced!'}`
        : 'No sync action recorded yet.';

    return (
        <div className="admin-panel">
            <h3>Data Warehouse Status</h3>

            {/* DW Sync Center */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>DW Sync Center</h4>
                        <p style={{ margin: '4px 0 0 0', color: '#a3a3a3', fontSize: '13px' }}>
                            Validates the real-time synchronization coverage between transactional records and analytical facts.
                        </p>
                    </div>
                    <span style={{
                        background: statusColor,
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        letterSpacing: '0.5px',
                        boxShadow: `0 0 15px ${statusColor}40`
                    }}>
                        {statusText}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px' }}>OLTP Records</span>
                        <strong style={{ fontSize: '20px', color: '#fff' }}>{oltpCount.toLocaleString()}</strong>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px' }}>DW Facts</span>
                        <strong style={{ fontSize: '20px', color: '#fff' }}>{dwCount.toLocaleString()}</strong>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px' }}>Pending Sync</span>
                        <strong style={{ fontSize: '20px', color: pendingSync === 0 ? '#22c55e' : '#eab308' }}>
                            {pendingSync.toLocaleString()}
                        </strong>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px' }}>Coverage</span>
                        <strong style={{ fontSize: '20px', color: '#fff' }}>{coverage.toFixed(1)}%</strong>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px' }}>Last Pipeline Action</span>
                    <strong style={{ fontSize: '13px', color: lastPipelineAction ? (lastPipelineAction.status === 'SUCCESS' ? '#22c55e' : '#ef4444') : '#888', fontWeight: 'normal' }}>
                        {lastSyncText}
                    </strong>
                </div>
            </div>

            <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                <StatCard label="Total Facts" value={stats.totalFacts.toLocaleString()} />
                <StatCard label="Unique Tracks" value={stats.totalTracks.toLocaleString()} />
                <StatCard label="Unique Artists" value={stats.totalArtists.toLocaleString()} />
                <StatCard label="Unique Genres" value={stats.totalGenres.toLocaleString()} />
            </div>

            <div className="admin-split">
                <div className="admin-subpanel">
                    <h4>Partition Distribution</h4>
                    <ul className="admin-list">
                        {Object.entries(stats.factsByPartition)
                            .filter(([_, count]) => count > 0)
                            .map(([year, count]) => {
                                const total = stats.totalFacts || 1;
                                const pct = ((count * 100) / total).toFixed(1);
                                return (
                                    <li key={year}>
                                        <span>Year {year}</span> 
                                        <strong>{count.toLocaleString()} facts ({pct}%)</strong>
                                    </li>
                                );
                            })}
                        {Object.entries(stats.factsByPartition).filter(([_, count]) => count > 0).length === 0 && (
                            <li style={{ color: '#888', textAlign: 'center' }}>No active partitions found.</li>
                        )}
                    </ul>
                </div>
                <div className="admin-subpanel">
                    <h4>Materialized Views Status</h4>
                    <ul className="admin-list">
                        {Object.entries(stats.materializedViewSizes).map(([mv, count]) => (
                            <li key={mv}>
                                <span style={{ fontFamily: 'monospace' }}>{mv}</span> 
                                <strong>{count.toLocaleString()} rows</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

// ============ SYSTEM HEALTH & DATA QUALITY ============
function DataQualitySection({ dataQuality }) {
    const dwCoverage = dataQuality.dwCoveragePercentage;
    let dwCoverageColor = '#ef4444'; 
    let dwCoverageText = 'RED';
    if (dwCoverage >= 95) {
        dwCoverageColor = '#22c55e'; 
        dwCoverageText = 'GREEN';
    } else if (dwCoverage >= 80) {
        dwCoverageColor = '#eab308'; 
        dwCoverageText = 'YELLOW';
    }

    const genreEnrichment = dataQuality.genreEnrichmentCoverage;
    let genreColor = '#ef4444';
    let genreText = 'RED';
    if (genreEnrichment >= 70) {
        genreColor = '#22c55e';
        genreText = 'GREEN';
    } else if (genreEnrichment >= 30) {
        genreColor = '#eab308';
        genreText = 'YELLOW';
    }

    const pendingSync = Math.max(0, dataQuality.oltpListeningRecordsCount - dataQuality.dwFactsCount);
    let pendingColor = '#ef4444';
    let pendingText = 'RED';
    if (pendingSync === 0) {
        pendingColor = '#22c55e';
        pendingText = 'GREEN';
    } else if (pendingSync < 100) {
        pendingColor = '#eab308';
        pendingText = 'YELLOW';
    }

    const tracksWithoutDuration = dataQuality.tracksWithoutDuration;
    let durationColor = '#ef4444'; 
    let durationText = 'RED';
    if (tracksWithoutDuration === 0) {
        durationColor = '#22c55e'; 
        durationText = 'GREEN';
    } else if (tracksWithoutDuration <= 5) {
        durationColor = '#eab308'; 
        durationText = 'YELLOW';
    }

    const mvRows = dataQuality.materializedViewRowCounts;
    let mvColor = '#ef4444'; 
    let mvText = 'RED';
    if (mvRows > 0) {
        mvColor = '#22c55e'; 
        mvText = 'GREEN';
    }

    const badges = [dwCoverageText, genreText, pendingText, durationText, mvText];
    const greenCount = badges.filter(b => b === 'GREEN').length;

    let overallScore = 'POOR';
    let overallColor = '#ef4444';
    if (greenCount === 5) {
        overallScore = 'EXCELLENT';
        overallColor = '#22c55e';
    } else if (greenCount === 4) {
        overallScore = 'GOOD';
        overallColor = '#10b981';
    } else if (greenCount === 3) {
        overallScore = 'FAIR';
        overallColor = '#eab308';
    }

    return (
        <div className="admin-panel">
            <h3>System Health & Data Quality</h3>

            <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Overall Data Quality Score</h4>
                    <p style={{ margin: '6px 0 0 0', color: '#a3a3a3', fontSize: '13px' }}>
                        Calculated based on data warehouse coverage, genre integration coverage, and metadata completeness.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '14px', color: '#a3a3a3' }}>Score: {greenCount}/5 green</span>
                    <span style={{
                        background: overallColor,
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '15px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        letterSpacing: '0.5px',
                        boxShadow: `0 0 15px ${overallColor}40`
                    }}>
                        {overallScore}
                    </span>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '32px'
            }}>
                <BadgeCard label="DW Coverage" value={`${dwCoverage.toFixed(1)}%`} status={dwCoverageText} color={dwCoverageColor} />
                <BadgeCard label="Genre Enrichment" value={`${genreEnrichment.toFixed(1)}%`} status={genreText} color={genreColor} />
                <BadgeCard label="Pending Sync" value={pendingSync.toLocaleString()} status={pendingText} color={pendingColor} />
                <BadgeCard label="Duration Completeness" value={tracksWithoutDuration === 0 ? 'COMPLETE' : `${tracksWithoutDuration} missing`} status={durationText} color={durationColor} />
                <BadgeCard label="Materialized Views" value={`${mvRows.toLocaleString()} rows`} status={mvText} color={mvColor} />
            </div>

            <h4 style={{ marginBottom: '16px', color: '#fff' }}>Operational & Analytical Metrics</h4>
            <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <StatCard label="OLTP Records Count" value={dataQuality.oltpListeningRecordsCount.toLocaleString()} />
                <StatCard label="DW Facts Count" value={dataQuality.dwFactsCount.toLocaleString()} />
                <StatCard label="DW Coverage" value={`${dataQuality.dwCoveragePercentage.toFixed(2)}%`} />
                <StatCard label="Known Genre Facts" value={dataQuality.knownGenreFacts.toLocaleString()} />
                <StatCard label="Unknown Genre Facts" value={dataQuality.unknownGenreFacts.toLocaleString()} />
                <StatCard label="Genre Enrichment Coverage" value={`${dataQuality.genreEnrichmentCoverage.toFixed(2)}%`} />
                <StatCard label="Tracks w/ Duration" value={dataQuality.tracksWithDuration.toLocaleString()} />
                <StatCard label="Tracks w/o Duration" value={dataQuality.tracksWithoutDuration.toLocaleString()} />
                <StatCard label="Materialized Views Rows" value={dataQuality.materializedViewRowCounts.toLocaleString()} />
            </div>
        </div>
    );
}

function BadgeCard({ label, value, status, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ fontSize: '11px', color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: color }}>{status}</span>
            </div>
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '4px',
                height: '100%',
                background: color
            }} />
        </div>
    );
}

// ============ USERS SECTION ============
function UsersSection({ users }) {
    return (
        <div className="admin-panel">
            <h3>Registered Users</h3>
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Records OLTP</th>
                            <th>Facts DW</th>
                            <th>Spotify</th>
                            <th>Registered At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.username}</td>
                                <td>{u.email}</td>
                                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                                <td>{u.listeningRecordsCount.toLocaleString()}</td>
                                <td>{u.factsInWarehouseCount.toLocaleString()}</td>
                                <td>{u.spotifyConnected ? '✓' : '—'}</td>
                                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="admin-stat-card">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

// ============ SCHEMA EXPLORER SECTION ============
function SchemaSection({ oltp, dw, mvs, indexes, partitions }) {
    const [indexFilter, setIndexFilter] = useState('');
    const filteredIndexes = indexes.filter(idx => 
        idx.index_name.toLowerCase().includes(indexFilter.toLowerCase()) ||
        idx.table_name.toLowerCase().includes(indexFilter.toLowerCase())
    );

    return (
        <div className="admin-panel" style={{ color: '#fff' }}>
            <div style={{ marginBottom: '24px' }}>
                <h3>Database Schema Explorer</h3>
                <p style={{ color: '#a3a3a3', fontSize: '13px', margin: '4px 0 0 0' }}>
                    Inspect in real-time the physical structure of the relational databases: transactional base tables (OLTP), multidimensional star schema tables (DW), physical indexes, and storage partitions.
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* OLTP SCHEMA */}
                <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '20px'
                }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.2)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Schema: oltp</span>
                        <span style={{ fontSize: '11px', background: 'rgba(29, 185, 84, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Operational (OLTP)</span>
                    </h4>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '16px' }}>
                        Stores raw operational listening events and user registry profiles before ETL processing.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {oltp.map(t => (
                            <li key={t.table_name} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }}>
                                📁 {t.table_name}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* DW SCHEMA */}
                <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '20px'
                }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#00d2ff', borderBottom: '1px solid rgba(0, 210, 255, 0.2)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Schema: dw</span>
                        <span style={{ fontSize: '11px', background: 'rgba(0, 210, 255, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Analytical (DW Star)</span>
                    </h4>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '16px' }}>
                        Star schema dimensions and fact tables optimized for multi-dimensional analytical processing.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1px dashed rgba(0, 210, 255, 0.3)', padding: '10px 14px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            📊 dw_fact_listening_event (Partitioned)
                        </li>
                        {dw.map(t => (
                            <li key={t.table_name} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }}>
                                📁 {t.table_name}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
            }}>
                {/* PARTITIONS */}
                <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '20px'
                }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#eab308', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', paddingBottom: '8px' }}>
                        dw_fact_listening_event Partitions
                    </h4>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '16px' }}>
                        Physical storage partitioning of the analytical facts table by date key for historical query pruning optimization.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {partitions.map(p => (
                            <li key={p.partition_name} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
                                <span>⚡ {p.partition_name}</span>
                                <strong style={{ color: '#eab308' }}>~{Math.max(0, p.estimated_rows).toLocaleString()} rows</strong>
                            </li>
                        ))}
                        {partitions.length === 0 && (
                            <li style={{ color: '#888', fontStyle: 'italic' }}>No physical partitions detected.</li>
                        )}
                    </ul>
                </div>

                {/* MATERIALIZED VIEWS */}
                <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '20px'
                }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#a855f7', borderBottom: '1px solid rgba(168, 85, 247, 0.2)', paddingBottom: '8px' }}>
                        Materialized Views (Analytical Aggregates)
                    </h4>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '16px' }}>
                        Pre-aggregated materialized views caching heavy analytical metrics to guarantee sub-second BI reporting response times.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {mvs.map(m => (
                            <li key={m.view_name} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>👁️ {m.view_name}</span>
                                <span style={{
                                    fontSize: '11px',
                                    background: m.is_populated ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: m.is_populated ? '#22c55e' : '#ef4444',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold'
                                }}>
                                    {m.is_populated ? 'POPULATED' : 'STALE'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* INDEXES */}
            <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '20px'
            }}>
                <div style={{ borderBottom: '1px solid rgba(236, 72, 153, 0.2)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <h4 style={{ margin: 0, color: '#ec4899' }}>
                        Data Warehouse Indexes Structure
                    </h4>
                    <input 
                        type="text" 
                        placeholder="Search indexes by name or table..." 
                        value={indexFilter}
                        onChange={e => setIndexFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '12px',
                            minWidth: '240px',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>
                <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '16px' }}>
                    Physical database indexes created on star schema tables to considerably accelerate JOIN times during analysis.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredIndexes.map(idx => (
                        <div key={idx.index_name} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '6px',
                            padding: '12px 16px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <strong style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>🔑 {idx.index_name}</strong>
                                <span style={{ fontSize: '12px', color: '#a3a3a3' }}>Table: <code style={{ color: '#ec4899' }}>{idx.table_name}</code></span>
                            </div>
                            <pre style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#a3a3a3',
                                background: '#121212',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                border: '1px solid rgba(255,255,255,0.02)'
                            }}>{idx.index_definition}</pre>
                        </div>
                    ))}
                    {filteredIndexes.length === 0 && (
                        <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', margin: '20px 0' }}>No matching indexes found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
