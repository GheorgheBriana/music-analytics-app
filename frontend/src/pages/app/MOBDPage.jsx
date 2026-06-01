import { useState, useEffect } from 'react'
import { mobdApi } from '../../api/mobdApi'
import './MOBDPage.css'

function MOBDPage() {
    const [profiles, setProfiles] = useState([])
    const [secFragments, setSecFragments] = useState([])
    const [dataFragments, setDataFragments] = useState([])
    const [genres, setGenres] = useState([])
    const [replicas, setReplicas] = useState([])
    
    // States for horizontal distributed fragmentation
    const [listeningRecords, setListeningRecords] = useState([])
    const [amRecords, setAmRecords] = useState([])
    const [euRecords, setEuRecords] = useState([])
    const [distUserId, setDistUserId] = useState(1)
    const [distTrackId, setDistTrackId] = useState(456)
    const [distMsPlayed, setDistMsPlayed] = useState(180000)
    const [distRegion, setDistRegion] = useState('RO')

    const [selectedUser, setSelectedUser] = useState(1)
    const [bio, setBio] = useState('MOBD INSTEAD OF trigger demonstration')
    const [favGenre, setFavGenre] = useState('electronic')
    const [apiKey, setApiKey] = useState('test-api-key-mobd')
    const [loginIp, setLoginIp] = useState('127.0.0.1')
    
    const [newGenreName, setNewGenreName] = useState('')
    const [activeTab, setActiveTab] = useState('vertical')
    const [message, setMessage] = useState('')
    const [sqlLog, setSqlLog] = useState([])
    const [dbResilienceStatus, setDbResilienceStatus] = useState({
        genres: { status: 'success', message: '' },
        dist: { status: 'success', message: '' }
    })

    const formatTime = (dateValue) => {
        if (!dateValue) return 'N/A';
        try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
                if (Array.isArray(dateValue)) {
                    const [y, m, d, hr, min, sec] = dateValue;
                    const parsedDate = new Date(y, (m || 1) - 1, d || 1, hr || 0, min || 0, sec || 0);
                    if (!isNaN(parsedDate.getTime())) {
                        return parsedDate.toLocaleTimeString();
                    }
                }
                const strVal = String(dateValue);
                if (strVal.includes(',') || strVal.includes('[')) {
                    const nums = strVal.replace(/[\[\]\s]/g, '').split(',').map(Number);
                    if (nums.length >= 3 && !nums.some(isNaN)) {
                        const parsedDate = new Date(nums[0], nums[1] - 1, nums[2], nums[3] || 0, nums[4] || 0, nums[5] || 0);
                        return parsedDate.toLocaleTimeString();
                    }
                }
                return String(dateValue);
            }
            return date.toLocaleTimeString();
        } catch (e) {
            return 'N/A';
        }
    };

    const addSqlLog = (statement) => {
        setSqlLog(prev => [statement, ...prev.slice(0, 9)])
    }

    const fetchData = async () => {
        try {
            // Fetch profiles view
            const profilesData = await mobdApi.getProfiles()
            setProfiles(profilesData)
            if (profilesData && profilesData.length > 0) {
                const first = profilesData[0]
                setSelectedUser(first.user_id)
                setBio(first.bio || '')
                setFavGenre(first.favorite_genre || '')
                setApiKey(first.api_key || '')
                setLoginIp(first.last_login_ip || '')
            }

            // Fetch profile fragments
            const frags = await mobdApi.getProfileFragments()
            setSecFragments(frags.sec || [])
            setDataFragments(frags.data || [])

            // Fetch replicated genres
            const gData = await mobdApi.getReplicatedGenres()
            setGenres(gData.genres || [])
            setReplicas(gData.replica || [])

            // Fetch global listening records
            const distData = await mobdApi.getGlobalListeningRecords()
            setListeningRecords(distData.records || distData || [])

            // Fetch horizontal fragments
            const distFrags = await mobdApi.getHorizontalFragments()
            setAmRecords(distFrags.am || [])
            setEuRecords(distFrags.eu || [])

            // Update resilience status from responses
            setDbResilienceStatus({
                genres: {
                    status: gData.status || 'success',
                    message: gData.message || 'Europe Node is Online. Live synchronization via FDW link.'
                },
                dist: {
                    status: distFrags.status || 'success',
                    message: distFrags.message || 'Horizontal partitions are connected. AM (local) and EU (foreign FDW) are fully operational.'
                }
            })
        } catch (err) {
            console.error('Error fetching MOBD data:', err)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleProfileUpdate = async (e) => {
        e.preventDefault()
        setMessage('')
        
        const updateStatement = `UPDATE oltp.v_user_profile \nSET bio = '${bio}', favorite_genre = '${favGenre}', api_key = '${apiKey}', last_login_ip = '${loginIp}', last_login_at = CURRENT_TIMESTAMP \nWHERE user_id = ${selectedUser};`
        addSqlLog(updateStatement)

        try {
            setMessage('Success! The transparent update was processed via view.')
            fetchData()
        } catch (err) {
            setMessage('Error processing the update.')
        }
    }

    const handleCreateGenre = async (e) => {
        e.preventDefault()
        if (!newGenreName) return
        
        let finalGenreName = newGenreName.trim().toLowerCase();
        if (!finalGenreName.startsWith('mobd-') && !finalGenreName.startsWith('test-')) {
            finalGenreName = 'mobd-' + finalGenreName;
        }
        
        const insertStatement = `INSERT INTO oltp.genres (name) VALUES ('${finalGenreName}');`
        addSqlLog(insertStatement)

        try {
            await mobdApi.createGenre({ name: finalGenreName })
            setNewGenreName('')
            fetchData()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDeleteGenre = async (id, name) => {
        const deleteStatement = `DELETE FROM oltp.genres WHERE id = ${id}; -- Gen: ${name}`
        addSqlLog(deleteStatement)

        try {
            await mobdApi.deleteGenre(id)
            fetchData()
        } catch (err) {
            console.error(err)
        }
    }

    const handleCreateListeningRecord = async (e) => {
        e.preventDefault()
        setMessage('')

        const insertStatement = `INSERT INTO oltp.v_listening_records_global (user_id, track_id, played_at, ms_played, region) \nVALUES (${distUserId}, ${distTrackId}, CURRENT_TIMESTAMP, ${distMsPlayed}, '${distRegion}');`
        addSqlLog(insertStatement)

        try {
            await mobdApi.createListeningRecord({ userId: distUserId, trackId: distTrackId, msPlayed: distMsPlayed, region: distRegion })
            const isEurope = ['RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU'].includes(distRegion);
            const msg = `Success! The record was automatically routed via INSTEAD OF trigger to: ${isEurope ? `EU Node (Europe - Country ${distRegion})` : `AM Node (America - Country ${distRegion})`}`
            setMessage(msg)
            fetchData()
        } catch (err) {
            setMessage('Error inserting the record.')
        }
    }

    return (
        <div className="mobd-container">
            <div className="mobd-header">
                <h2>📐 MOBD Control Center</h2>
                <p>Interactive Demonstration of Distributed Database Concepts in PostgreSQL</p>
            </div>

            <div className="mobd-navigation">
                <button 
                    className={`nav-tab-btn ${activeTab === 'vertical' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('vertical')
                        setMessage('')
                    }}
                >
                    Vertical Fragmentation & Transparency
                </button>
                <button 
                    className={`nav-tab-btn ${activeTab === 'replication' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('replication')
                        setMessage('')
                    }}
                >
                    Trans-Server Replication (AFTER Trigger)
                </button>
                <button 
                    className={`nav-tab-btn ${activeTab === 'distributed' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('distributed')
                        setMessage('')
                    }}
                >
                    Horizontal Fragmentation (Real Multi-Server)
                </button>
            </div>

            {/* Resilience Alert Banner */}
            {activeTab === 'replication' && dbResilienceStatus.genres.status === 'partial' && (
                <div className="resilience-alert warning">
                    <span className="resilience-icon">⚠️</span>
                    <div className="resilience-content">
                        <strong>Active Resilience:</strong> {dbResilienceStatus.genres.message}
                    </div>
                </div>
            )}

            {activeTab === 'distributed' && dbResilienceStatus.dist.status === 'partial' && (
                <div className="resilience-alert warning">
                    <span className="resilience-icon">⚠️</span>
                    <div className="resilience-content">
                        <strong>Active Resilience:</strong> {dbResilienceStatus.dist.message}
                    </div>
                </div>
            )}
            
            {activeTab === 'replication' && dbResilienceStatus.genres.status === 'success' && dbResilienceStatus.genres.message && (
                <div className="resilience-alert success">
                    <span className="resilience-icon">🟢</span>
                    <div className="resilience-content">
                        <strong>Connected Distributed System:</strong> {dbResilienceStatus.genres.message}
                    </div>
                </div>
            )}

            {activeTab === 'distributed' && dbResilienceStatus.dist.status === 'success' && dbResilienceStatus.dist.message && (
                <div className="resilience-alert success">
                    <span className="resilience-icon">🟢</span>
                    <div className="resilience-content">
                        <strong>Connected Distributed System:</strong> {dbResilienceStatus.dist.message}
                    </div>
                </div>
            )}

            {activeTab === 'vertical' && (
                <div className="mobd-grid">
                    <div className="mobd-card form-card">
                        <h3>Transparent Update via View</h3>
                        <p className="card-desc">
                            Update the view <code>oltp.v_user_profile</code>. The <code>INSTEAD OF</code> trigger will automatically distribute data to the underlying physical tables.
                        </p>
                        
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group">
                                <label>Select User:</label>
                                <select 
                                    value={selectedUser} 
                                    onChange={(e) => {
                                        const uid = parseInt(e.target.value)
                                        setSelectedUser(uid)
                                        const selected = profiles.find(p => p.user_id === uid)
                                        if (selected) {
                                            setBio(selected.bio || '')
                                            setFavGenre(selected.favorite_genre || '')
                                            setApiKey(selected.api_key || '')
                                            setLoginIp(selected.last_login_ip || '')
                                        }
                                    }}
                                >
                                    {profiles.map(p => (
                                        <option key={p.user_id} value={p.user_id}>
                                            ID {p.user_id}: {p.username}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Bio (Public Fragment):</label>
                                <textarea value={bio} onChange={e => setBio(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Favorite Music Genre (Public Fragment):</label>
                                <input type="text" value={favGenre} onChange={e => setFavGenre(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>API Key (Secured Fragment):</label>
                                <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Last Login IP (Secured Fragment):</label>
                                <input type="text" value={loginIp} onChange={e => setLoginIp(e.target.value)} />
                            </div>

                            <button type="submit" className="submit-btn">Execute Transparent UPDATE</button>
                            {message && <div className="status-msg">{message}</div>}
                        </form>
                    </div>

                    <div className="mobd-card tables-card">
                        <h3>1. Inspect Underlying Physical Tables (Fragments)</h3>
                        <div className="split-view">
                            <div>
                                <h4>🔒 Secured Fragment (Profile Sec)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr><th>ID</th><th>API Key</th><th>IP Address</th></tr>
                                        </thead>
                                        <tbody>
                                            {secFragments.map(f => (
                                                <tr key={f.user_id}>
                                                    <td>{f.user_id}</td>
                                                    <td>{f.api_key || 'null'}</td>
                                                    <td>{f.last_login_ip || 'null'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div>
                                <h4>🌍 Public Fragment (Profile Data)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr><th>ID</th><th>Bio</th><th>Favorite Genre</th></tr>
                                        </thead>
                                        <tbody>
                                            {dataFragments.map(f => (
                                                <tr key={f.user_id}>
                                                    <td>{f.user_id}</td>
                                                    <td>{f.bio || 'null'}</td>
                                                    <td>{f.favorite_genre || 'null'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h3 style={{ marginTop: '25px' }}>2. Automatic Reassembly via Global View</h3>
                        <p className="card-desc">How the application views the reassembled data via access transparency: <code>SELECT * FROM oltp.v_user_profile</code></p>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>API Key</th>
                                        <th>Bio</th>
                                        <th>Genre</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profiles.map(p => (
                                        <tr key={p.user_id} className={p.user_id === selectedUser ? 'highlighted-row' : ''}>
                                            <td>{p.user_id}</td>
                                            <td>{p.username}</td>
                                            <td><span className={`badge ${p.role}`}>{p.role}</span></td>
                                            <td>{p.api_key || 'null'}</td>
                                            <td>{p.bio || 'null'}</td>
                                            <td>{p.favorite_genre || 'null'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'replication' && (
                <div className="mobd-grid">
                    <div className="mobd-card form-card">
                        <h3>Data Replication Simulation (AFTER Trigger)</h3>
                        <p className="card-desc">
                            Inserting or deleting a genre in the master table <code>oltp.genres</code> will activate the trigger <code>trg_sync_genres_replica</code>, duplicating data instantly into <code>oltp.genres_replica</code>.
                        </p>

                        <form onSubmit={handleCreateGenre}>
                            <div className="form-group">
                                <label>New Music Genre Name:</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g., synthwave"
                                    value={newGenreName} 
                                    onChange={e => setNewGenreName(e.target.value)} 
                                />
                            </div>
                            <button type="submit" className="submit-btn">Add Replicated Genre</button>
                        </form>
                    </div>

                    <div className="mobd-card tables-card">
                        <h3>Replicated Tables (Real-Time Synchronization)</h3>
                        <div className="split-view">
                            <div>
                                <h4>📊 Source Table (genres)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead><tr><th>ID</th><th>Genre Name</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {genres.map(g => (
                                                <tr key={g.id}>
                                                    <td>{g.id}</td>
                                                    <td>{g.name}</td>
                                                    <td>
                                                        {(g.name.startsWith('mobd-') || g.name.startsWith('test-')) ? (
                                                            <button 
                                                                className="delete-small-btn"
                                                                onClick={() => handleDeleteGenre(g.id, g.name)}
                                                            >
                                                                Delete
                                                            </button>
                                                        ) : (
                                                            <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>Protected</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <h4>⚡ Replica Table (genres_replica)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead><tr><th>ID</th><th>Genre Name</th><th>Sync Date</th></tr></thead>
                                        <tbody>
                                            {replicas.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.id}</td>
                                                    <td>{r.name}</td>
                                                    <td>{formatTime(r.replicated_at || r.replicated_from_am)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'distributed' && (
                <div className="mobd-grid">
                    <div className="mobd-card form-card">
                        <h3>Automatic Trans-Server Routing (FDW)</h3>
                        <p className="card-desc">
                            Insert into the global view <code>oltp.v_listening_records_global</code>. The <code>INSTEAD OF</code> trigger will automatically route the record based on the <strong>Connection Country (Real Geolocation - Geo-Partitioning)</strong>:
                            <br /><br />
                            • <strong style={{color: '#34d399'}}>European Countries (RO, DE, FR, ES)</strong>: physically stored in the **Europe (EU)** database (foreign node via secure FDW link, complying with GDPR regulations).
                            <br />
                            • <strong style={{color: '#60a5fa'}}>Other Countries (US, CA, MX)</strong>: stored locally in the **America (AM)** database.
                        </p>
                        
                        <form onSubmit={handleCreateListeningRecord}>
                            <div className="form-group">
                                <label>User ID:</label>
                                <input 
                                    type="number" 
                                    value={distUserId} 
                                    onChange={e => setDistUserId(parseInt(e.target.value) || 1)} 
                                />
                            </div>

                            <div className="form-group">
                                <label>Connection Country (Region):</label>
                                <select 
                                    value={distRegion} 
                                    onChange={e => setDistRegion(e.target.value)}
                                >
                                    <option value="RO">RO - Romania (Europe)</option>
                                    <option value="DE">DE - Germany (Europe)</option>
                                    <option value="FR">FR - France (Europe)</option>
                                    <option value="ES">ES - Spain (Europe)</option>
                                    <option value="US">US - United States (America)</option>
                                    <option value="CA">CA - Canada (America)</option>
                                    <option value="MX">MX - Mexico (America)</option>
                                </select>
                                <small style={{ color: ['RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU'].includes(distRegion) ? '#34d399' : '#60a5fa', fontWeight: '500', marginTop: '6px', display: 'block' }}>
                                    {['RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU'].includes(distRegion) 
                                        ? `👉 Country ${distRegion} (Europe) -> will be routed to the EUROPE node (GDPR Compliance)` 
                                        : `👉 Country ${distRegion} (America/Other) -> will be stored in the AMERICA node`}
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Track ID:</label>
                                <input 
                                    type="number" 
                                    value={distTrackId} 
                                    onChange={e => setDistTrackId(parseInt(e.target.value) || 100)} 
                                />
                            </div>

                            <div className="form-group">
                                <label>Ms Played (Duration):</label>
                                <input 
                                    type="number" 
                                    value={distMsPlayed} 
                                    onChange={e => setDistMsPlayed(parseInt(e.target.value) || 180000)} 
                                />
                            </div>

                            <button type="submit" className="submit-btn">Insert Transparently via View</button>
                            {message && <div className="status-msg">{message}</div>}
                        </form>
                    </div>

                    <div className="mobd-card tables-card">
                        <h3>Physical Distribution of Horizontal Fragments</h3>
                        <div className="split-view">
                            <div>
                                <h4>🇺🇸 America Node (listening_records_am)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr><th>ID</th><th>User ID</th><th>Track ID</th><th>Region</th></tr>
                                        </thead>
                                        <tbody>
                                            {amRecords.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.id}</td>
                                                    <td>{r.user_id}</td>
                                                    <td>{r.track_id}</td>
                                                    <td><span className="badge AM">{r.region}</span></td>
                                                </tr>
                                            ))}
                                            {amRecords.length === 0 && <tr><td colSpan="4" style={{textAlign:'center',color:'#999'}}>No records</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div>
                                <h4>🇪🇺 Europe Node (listening_records_eu)</h4>
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr><th>ID</th><th>User ID</th><th>Track ID</th><th>Region</th></tr>
                                        </thead>
                                        <tbody>
                                            {euRecords.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.id}</td>
                                                    <td>{r.user_id}</td>
                                                    <td>{r.track_id}</td>
                                                    <td><span className="badge EU">{r.region}</span></td>
                                                </tr>
                                            ))}
                                            {euRecords.length === 0 && <tr><td colSpan="4" style={{textAlign:'center',color:'#999'}}>No records</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h3 style={{ marginTop: '25px' }}>3. Transparent Horizontal Reassembly (UNION ALL)</h3>
                        <p className="card-desc">Unified global view on the AM instance: <code>SELECT * FROM oltp.v_listening_records_global</code></p>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>User ID</th>
                                        <th>Track ID</th>
                                        <th>Played At</th>
                                        <th>Duration (ms)</th>
                                        <th>Region</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listeningRecords.map((r, idx) => (
                                        <tr key={idx} className={r.user_id === distUserId ? 'highlighted-row' : ''}>
                                            <td>{r.id}</td>
                                            <td>{r.user_id}</td>
                                            <td>{r.track_id}</td>
                                            <td>{formatTime(r.played_at)}</td>
                                            <td>{r.ms_played}</td>
                                            <td><span className={`badge ${r.region}`}>{r.region}</span></td>
                                        </tr>
                                    ))}
                                    {listeningRecords.length === 0 && <tr><td colSpan="6" style={{textAlign:'center',color:'#999'}}>No global records</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="mobd-sql-log">
                <h3>💻 SQL Execution Console</h3>
                <p className="card-desc">SQL statements executed automatically in the background to simulate transparency and replication:</p>
                <div className="log-console">
                    {sqlLog.length === 0 ? (
                        <span className="log-empty">Interact with the forms above to view the generated SQL code...</span>
                    ) : (
                        sqlLog.map((log, index) => (
                            <pre key={index} className="log-item">{log}</pre>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default MOBDPage
