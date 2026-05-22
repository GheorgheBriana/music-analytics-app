import { useState, useEffect } from 'react';
import { adminApi } from '../api/adminApi';
import AnalyticsPipelinePage from './app/AnalyticsPipelinePage';
import './AdminPage.css';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [users, setUsers] = useState([]);
    const [dwStats, setDwStats] = useState(null);
    const [enrichmentStatus, setEnrichmentStatus] = useState(null);
    const [recentActions, setRecentActions] = useState([]);
    const [dataQuality, setDataQuality] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (activeTab === 'overview') loadRecentActions();
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'dw') loadDwStats();
        if (activeTab === 'enrichment') loadEnrichmentStatus();
        if (activeTab === 'quality') loadDataQuality();
    }, [activeTab]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await adminApi.listUsers();
            setUsers(data);
        } catch (e) {
            setMessage('Failed to load users: ' + e.message);
        }
        setLoading(false);
    };

    const loadDwStats = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDwStats();
            setDwStats(data);
        } catch (e) {
            setMessage('Failed to load DW stats: ' + e.message);
        }
        setLoading(false);
    };

    const loadEnrichmentStatus = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getEnrichmentStatus();
            setEnrichmentStatus(data);
        } catch (e) {
            setMessage('Failed to load enrichment status: ' + e.message);
        }
        setLoading(false);
    };

    const loadRecentActions = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getRecentActions();
            setRecentActions(data);
        } catch (e) {
            setMessage('Failed to load recent actions: ' + e.message);
        }
        setLoading(false);
    };

    const loadDataQuality = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDataQualityStats();
            setDataQuality(data);
        } catch (e) {
            setMessage('Failed to load data quality: ' + e.message);
        }
        setLoading(false);
    };

    const handleRebuildDw = async () => {
        if (!window.confirm("Are you sure you want to trigger this admin process?")) return;
        setLoading(true);
        setMessage('Reconstruirea depozitului în curs...');
        try {
            const result = await adminApi.refreshWarehouse(20000);
            setMessage(`Reconstrucție finalizată: ${result.insertedFacts} fapte inserate.`);
            await loadDwStats();
        } catch (e) {
            setMessage('Error: ' + e.message);
        }
        setLoading(false);
    };

    const handleRefreshMvs = async () => {
        if (!window.confirm("Are you sure you want to trigger this admin process?")) return;
        setLoading(true);
        setMessage('Reîmprospătare MV-uri...');
        try {
            await adminApi.refreshMaterializedViews();
            setMessage('Vederile materializate au fost reîmprospătate.');
            await loadDwStats();
        } catch (e) {
            setMessage('Error: ' + e.message);
        }
        setLoading(false);
    };

    const handleTriggerEnrichment = async () => {
        if (!window.confirm("Are you sure you want to trigger this admin process?")) return;
        setLoading(true);
        setMessage('Îmbogățire MusicBrainz în curs...');
        try {
            const result = await adminApi.triggerEnrichment(10);
            setMessage(`Îmbogățire finalizată: ${result.artistsEnrichedWithTags} artiști procesați.`);
            await loadEnrichmentStatus();
        } catch (e) {
            setMessage('Error: ' + e.message);
        }
        setLoading(false);
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
                    Utilizatori
                </button>
                <button onClick={() => setActiveTab('dw')}
                    className={activeTab === 'dw' ? 'active' : ''}>
                    Data Warehouse
                </button>
                <button onClick={() => setActiveTab('enrichment')}
                    className={activeTab === 'enrichment' ? 'active' : ''}>
                    MusicBrainz Enrichment
                </button>
                <button onClick={() => setActiveTab('pipeline')}
                    className={activeTab === 'pipeline' ? 'active' : ''}>
                    ETL / Pipeline
                </button>
                <button onClick={() => setActiveTab('quality')}
                    className={activeTab === 'quality' ? 'active' : ''}>
                    System Health & Data Quality
                </button>
            </div>

            {message && <div className="admin-message">{message}</div>}
            {loading && <div className="admin-loading">Se încarcă...</div>}

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
                        onRebuild={handleRebuildDw}
                        onRefreshMvs={handleRefreshMvs}
                    />
                )}

                {activeTab === 'enrichment' && enrichmentStatus && (
                    <EnrichmentSection
                        status={enrichmentStatus}
                        onTrigger={handleTriggerEnrichment}
                    />
                )}

                {activeTab === 'pipeline' && (
                    <AnalyticsPipelinePage />
                )}

                {activeTab === 'quality' && dataQuality && (
                    <DataQualitySection dataQuality={dataQuality} />
                )}
            </div>
        </div>
    );
}

// ============ SECȚIUNEA OVERVIEW ============
function OverviewSection({ actions }) {
    return (
        <div className="admin-panel">
            <h3>Recent Admin Actions</h3>
            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Admin User ID</th>
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
                                <td>{a.actionType}</td>
                                <td>{a.actionDetails}</td>
                                <td><span className={`role-badge ${a.status === 'SUCCESS' ? 'USER' : 'ADMIN'}`}>{a.status}</span></td>
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

// ============ SECȚIUNEA CALITATEA DATELOR ============
function DataQualitySection({ dataQuality }) {
    return (
        <div className="admin-panel">
            <h3>System Health & Data Quality</h3>
            <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <StatCard label="OLTP Listening Records" value={dataQuality.oltpListeningRecordsCount.toLocaleString()} />
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

// ============ SECȚIUNEA USERI ============
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
                            <th>Rol</th>
                            <th>Records OLTP</th>
                            <th>Facts DW</th>
                            <th>Spotify</th>
                            <th>Înregistrat</th>
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

// ============ SECȚIUNEA DW ============
function DwSection({ stats, onRebuild, onRefreshMvs }) {
    return (
        <div className="admin-panel">
            <h3>Data Warehouse Status</h3>
            <div className="admin-stats-grid">
                <StatCard label="Fapte totale" value={stats.totalFacts.toLocaleString()} />
                <StatCard label="Utilizatori" value={stats.totalUsers} />
                <StatCard label="Piese" value={stats.totalTracks.toLocaleString()} />
                <StatCard label="Artiști" value={stats.totalArtists.toLocaleString()} />
                <StatCard label="Albume" value={stats.totalAlbums.toLocaleString()} />
                <StatCard label="Genuri" value={stats.totalGenres} />
            </div>

            <div className="admin-split">
                <div className="admin-subpanel">
                    <h4>Distribuția pe partiții</h4>
                    <ul className="admin-list">
                        {Object.entries(stats.factsByPartition).map(([year, count]) => (
                            <li key={year}><span>{year}</span> <strong>{count.toLocaleString()} fapte</strong></li>
                        ))}
                    </ul>
                </div>
                <div className="admin-subpanel">
                    <h4>Vederi materializate</h4>
                    <ul className="admin-list">
                        {Object.entries(stats.materializedViewSizes).map(([mv, count]) => (
                            <li key={mv}><span>{mv}</span> <strong>{count.toLocaleString()} rânduri</strong></li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="admin-actions">
                <button className="admin-btn primary" onClick={onRebuild}>Reconstrucție incrementală DW</button>
                <button className="admin-btn secondary" onClick={onRefreshMvs}>Reîmprospătare MV-uri</button>
            </div>
        </div>
    );
}

// ============ SECȚIUNEA ENRICHMENT ============
function EnrichmentSection({ status, onTrigger }) {
    return (
        <div className="admin-panel">
            <h3>MusicBrainz Enrichment</h3>
            <div className="admin-stats-grid">
                <StatCard label="Artiști totali" value={status.totalArtists.toLocaleString()} />
                <StatCard label="Îmbogățiți" value={status.enrichedArtists.toLocaleString()} />
                <StatCard label="În așteptare" value={status.pendingArtists.toLocaleString()} />
                <StatCard label="Genuri" value={status.totalGenres} />
                <StatCard label="Link-uri track-genre" value={status.totalTrackGenreLinks.toLocaleString()} />
                <StatCard label="Progres" value={`${status.enrichmentProgressPercentage.toFixed(1)}%`} />
            </div>

            <div className="admin-progress-bar">
                <div className="admin-progress-fill"
                    style={{ width: `${status.enrichmentProgressPercentage}%` }} />
            </div>

            <div className="admin-actions">
                <button className="admin-btn primary" onClick={onTrigger}>
                    Pornire îmbogățire (10 artiști)
                </button>
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
