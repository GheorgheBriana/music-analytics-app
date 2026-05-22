import { useState, useEffect } from 'react';
import { adminApi } from '../api/adminApi';
import AnalyticsPipelinePage from './app/AnalyticsPipelinePage';
import './AdminPage.css';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [dwStats, setDwStats] = useState(null);
    const [enrichmentStatus, setEnrichmentStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'dw') loadDwStats();
        if (activeTab === 'enrichment') loadEnrichmentStatus();
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

    const handleRebuildDw = async () => {
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
            </div>

            {message && <div className="admin-message">{message}</div>}
            {loading && <div className="admin-loading">Se încarcă...</div>}

            <div className="admin-content">
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
