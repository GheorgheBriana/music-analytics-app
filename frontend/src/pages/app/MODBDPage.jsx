import { useState, useEffect } from 'react'
import { modbdApi } from '../../api/modbdApi'
import './MODBDPage.css'

const EU_REGIONS = ['RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU']

function MODBDPage() {
    const [profiles, setProfiles] = useState([])
    const [secFragments, setSecFragments] = useState([])
    const [dataFragments, setDataFragments] = useState([])
    const [genres, setGenres] = useState([])
    const [replicas, setReplicas] = useState([])

    const [listeningRecords, setListeningRecords] = useState([])
    const [amRecords, setAmRecords] = useState([])
    const [euRecords, setEuRecords] = useState([])
    const [distUserId, setDistUserId] = useState(1)
    const [distTrackId, setDistTrackId] = useState(456)
    const [distMsPlayed, setDistMsPlayed] = useState(180000)
    const [distRegion, setDistRegion] = useState('RO')

    const [selectedUser, setSelectedUser] = useState(1)
    const [bio, setBio] = useState('MODBD INSTEAD OF trigger demonstration')
    const [favGenre, setFavGenre] = useState('electronic')
    const [apiKey, setApiKey] = useState('test-api-key-modbd')
    const [loginIp, setLoginIp] = useState('127.0.0.1')

    const [newGenreName, setNewGenreName] = useState('')
    const [activeTab, setActiveTab] = useState('vertical')
    const [message, setMessage] = useState('')
    const [sqlLog, setSqlLog] = useState(['-- Ready. Execute an action to see the generated SQL.'])
    const [dbResilienceStatus, setDbResilienceStatus] = useState({
        genres: { status: 'success', message: '' },
        dist: { status: 'success', message: '' }
    })

    const [validationData, setValidationData] = useState(null)
    const [validationLoading, setValidationLoading] = useState(false)
    const [syncLoading, setSyncLoading] = useState(false)

    const fetchValidation = async () => {
        setValidationLoading(true)
        try {
            const val = await modbdApi.getValidation()
            setValidationData(val)
        } catch (err) {
            console.error('Error fetching MODBD validation:', err)
        } finally {
            setValidationLoading(false)
        }
    }

    const handleSyncGenres = async () => {
        setSyncLoading(true)
        setMessage('')
        addSqlLog('-- SEED: bidirectional master-replica reconciliation (America + Europe).')
        try {
            const res = await modbdApi.syncGenres()
            setMessage(`Reconciliation complete: ${res.message}`)
            fetchValidation()
            fetchData()
        } catch (err) {
            setMessage('Error running genre reconciliation.')
        } finally {
            setSyncLoading(false)
        }
    }

    const formatTime = (dateValue) => {
        if (!dateValue) return 'N/A'
        try {
            const date = new Date(dateValue)
            if (isNaN(date.getTime())) {
                if (Array.isArray(dateValue)) {
                    const [y, m, d, hr, min, sec] = dateValue
                    const parsedDate = new Date(y, (m || 1) - 1, d || 1, hr || 0, min || 0, sec || 0)
                    if (!isNaN(parsedDate.getTime())) return parsedDate.toLocaleTimeString()
                }
                const strVal = String(dateValue)
                if (strVal.includes(',') || strVal.includes('[')) {
                    const nums = strVal.replace(/[\[\]\s]/g, '').split(',').map(Number)
                    if (nums.length >= 3 && !nums.some(isNaN)) {
                        const parsedDate = new Date(nums[0], nums[1] - 1, nums[2], nums[3] || 0, nums[4] || 0, nums[5] || 0)
                        return parsedDate.toLocaleTimeString()
                    }
                }
                return String(dateValue)
            }
            return date.toLocaleTimeString()
        } catch (e) {
            return 'N/A'
        }
    }

    const maskApiKey = (key) => {
        if (!key) return 'null'
        if (key.length <= 8) return '********'
        return `${key.slice(0, 8)}...${key.slice(-3)}`
    }

    const addSqlLog = (statement) => {
        setSqlLog(prev => [statement, ...prev.slice(0, 9)])
    }

    const fetchData = async () => {
        try {
            const profilesData = await modbdApi.getProfiles()
            setProfiles(profilesData)
            if (profilesData && profilesData.length > 0) {
                const first = profilesData[0]
                setSelectedUser(first.user_id)
                setBio(first.bio || '')
                setFavGenre(first.favorite_genre || '')
                setApiKey(first.api_key || '')
                setLoginIp(first.last_login_ip || '')
            }

            const frags = await modbdApi.getProfileFragments()
            setSecFragments(frags.sec || [])
            setDataFragments(frags.data || [])

            const gData = await modbdApi.getReplicatedGenres()
            setGenres(gData.genres || [])
            setReplicas(gData.replica || [])

            const distData = await modbdApi.getGlobalListeningRecords()
            setListeningRecords(distData.records || distData || [])

            const distFrags = await modbdApi.getHorizontalFragments()
            setAmRecords(distFrags.am || [])
            setEuRecords(distFrags.eu || [])

            setDbResilienceStatus({
                genres: {
                    status: gData.status || 'success',
                    message: gData.message || 'Europe node is online. Live synchronization via the FDW link.'
                },
                dist: {
                    status: distFrags.status || 'success',
                    message: distFrags.message || 'Horizontal partitions connected. AM (local) and EU (foreign FDW) are operational.'
                }
            })
        } catch (err) {
            console.error('Error fetching MODBD data:', err)
        }
    }

    useEffect(() => {
        fetchData()
        fetchValidation()
    }, [])

    const handleProfileUpdate = async (e) => {
        e.preventDefault()
        setMessage('')
        const updateStatement = `UPDATE oltp.v_user_profile\nSET bio = '${bio}', favorite_genre = '${favGenre}', api_key = '${apiKey}', last_login_ip = '${loginIp}', last_login_at = CURRENT_TIMESTAMP\nWHERE user_id = ${selectedUser};`
        addSqlLog(updateStatement)
        try {
            await modbdApi.updateProfile(selectedUser, {
                bio, favorite_genre: favGenre, api_key: apiKey, last_login_ip: loginIp
            })
            setMessage('Success — the transparent update was routed through the view.')
            fetchData()
        } catch (err) {
            setMessage('Error processing the update.')
        }
    }

    const handleCreateGenre = async (e) => {
        e.preventDefault()
        if (!newGenreName) return
        let finalGenreName = newGenreName.trim().toLowerCase()
        if (!finalGenreName.startsWith('modbd-') && !finalGenreName.startsWith('test-')) {
            finalGenreName = 'modbd-' + finalGenreName
        }
        addSqlLog(`INSERT INTO oltp.genres (name) VALUES ('${finalGenreName}');`)
        try {
            await modbdApi.createGenre({ name: finalGenreName })
            setNewGenreName('')
            fetchData()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDeleteGenre = async (id, name) => {
        addSqlLog(`DELETE FROM oltp.genres WHERE id = ${id}; -- genre: ${name}`)
        try {
            await modbdApi.deleteGenre(id)
            fetchData()
        } catch (err) {
            console.error(err)
        }
    }

    const handleCreateListeningRecord = async (e) => {
        e.preventDefault()
        setMessage('')
        const insertStatement = `INSERT INTO oltp.v_listening_records_global (user_id, track_id, played_at, ms_played, region)\nVALUES (${distUserId}, ${distTrackId}, CURRENT_TIMESTAMP, ${distMsPlayed}, '${distRegion}');`
        addSqlLog(insertStatement)
        try {
            await modbdApi.createListeningRecord({ userId: distUserId, trackId: distTrackId, msPlayed: distMsPlayed, region: distRegion })
            const isEurope = EU_REGIONS.includes(distRegion)
            setMessage(`Success — routed via INSTEAD OF trigger to the ${isEurope ? `Europe node (${distRegion})` : `America node (${distRegion})`}.`)
            fetchData()
        } catch (err) {
            setMessage('Error inserting the record.')
        }
    }

    const isEuropeSelected = EU_REGIONS.includes(distRegion)

    const TABS = [
        { id: 'vertical', label: 'Vertical Fragmentation' },
        { id: 'replication', label: 'Trans-Server Replication' },
        { id: 'distributed', label: 'Horizontal Fragmentation' },
        { id: 'validation', label: 'Integrity Validation' },
    ]

    return (
        <div className="modbd-container">
            <div className="modbd-header">
                <h2>MODBD Control Center</h2>
                <p>Interactive demonstration of distributed database concepts in PostgreSQL</p>
            </div>

            <div className="modbd-navigation">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`nav-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => { setActiveTab(t.id); setMessage(''); if (t.id === 'validation') fetchValidation() }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Resilience banners */}
            {activeTab === 'replication' && dbResilienceStatus.genres.status === 'partial' && (
                <div className="resilience-alert warning">
                    <span className="dot dot-amber" />
                    <div><strong>Resilience active:</strong> {dbResilienceStatus.genres.message}</div>
                </div>
            )}
            {activeTab === 'distributed' && dbResilienceStatus.dist.status === 'partial' && (
                <div className="resilience-alert warning">
                    <span className="dot dot-amber" />
                    <div><strong>Resilience active:</strong> {dbResilienceStatus.dist.message}</div>
                </div>
            )}
            {activeTab === 'replication' && dbResilienceStatus.genres.status === 'success' && dbResilienceStatus.genres.message && (
                <div className="resilience-alert success">
                    <span className="dot dot-green" />
                    <div><strong>Distributed system connected:</strong> {dbResilienceStatus.genres.message}</div>
                </div>
            )}
            {activeTab === 'distributed' && dbResilienceStatus.dist.status === 'success' && dbResilienceStatus.dist.message && (
                <div className="resilience-alert success">
                    <span className="dot dot-green" />
                    <div><strong>Distributed system connected:</strong> {dbResilienceStatus.dist.message}</div>
                </div>
            )}

            {/* ============ VERTICAL ============ */}
            {activeTab === 'vertical' && (
                <div className="flow">
                    <div className="flow-intro">
                        <p>Updating the logical view <code>oltp.v_user_profile</code> triggers an <code>INSTEAD OF</code> function that splits the data across two physical tables — public and secured.</p>
                    </div>

                    {/* STEP 1 — action */}
                    <section className="step">
                        <div className="step-head"><span className="step-num">1</span><h3>Update the profile through the view</h3></div>
                        <form className="step-body form-inline" onSubmit={handleProfileUpdate}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>User</label>
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => {
                                            const uid = parseInt(e.target.value)
                                            setSelectedUser(uid)
                                            const sel = profiles.find(p => p.user_id === uid)
                                            if (sel) { setBio(sel.bio || ''); setFavGenre(sel.favorite_genre || ''); setApiKey(sel.api_key || ''); setLoginIp(sel.last_login_ip || '') }
                                        }}>
                                        {profiles.map(p => <option key={p.user_id} value={p.user_id}>ID {p.user_id}: {p.username}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Favorite genre <span className="tag tag-public">public</span></label>
                                    <input type="text" value={favGenre} onChange={e => setFavGenre(e.target.value)} />
                                </div>
                                <div className="form-group form-group-wide">
                                    <label>Bio <span className="tag tag-public">public</span></label>
                                    <textarea value={bio} onChange={e => setBio(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>API key <span className="tag tag-secure">secured</span></label>
                                    <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Last login IP <span className="tag tag-secure">secured</span></label>
                                    <input type="text" value={loginIp} onChange={e => setLoginIp(e.target.value)} />
                                </div>
                            </div>
                            <button type="submit" className="submit-btn">Execute transparent UPDATE</button>
                            {message && <div className="status-msg">{message}</div>}
                        </form>
                    </section>

                    <div className="flow-arrow">↓ &nbsp;the INSTEAD OF trigger distributes the columns</div>

                    {/* STEP 2 — physical fragments */}
                    <section className="step">
                        <div className="step-head"><span className="step-num">2</span><h3>The data is split across two physical tables</h3></div>
                        <div className="step-body two-col">
                            <div className="mini">
                                <div className="mini-title"><span className="tag tag-secure">secured</span> user_profile_sec</div>
                                <table>
                                    <thead><tr><th>ID</th><th>API key</th><th>IP</th></tr></thead>
                                    <tbody>
                                        {secFragments.map(f => (
                                            <tr key={f.user_id} className={f.user_id === selectedUser ? 'hl' : ''}>
                                                <td>{f.user_id}</td><td>{maskApiKey(f.api_key)}</td><td>{f.last_login_ip || 'null'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mini">
                                <div className="mini-title"><span className="tag tag-public">public</span> user_profile_data</div>
                                <table>
                                    <thead><tr><th>ID</th><th>Bio</th><th>Genre</th></tr></thead>
                                    <tbody>
                                        {dataFragments.map(f => (
                                            <tr key={f.user_id} className={f.user_id === selectedUser ? 'hl' : ''}>
                                                <td>{f.user_id}</td><td>{f.bio || 'null'}</td><td>{f.favorite_genre || 'null'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <div className="flow-arrow">↓ &nbsp;the view reassembles the fragments with a JOIN</div>

                    {/* STEP 3 — reassembled view */}
                    <section className="step">
                        <div className="step-head"><span className="step-num">3</span><h3>The application sees one unified profile</h3></div>
                        <div className="step-body">
                            <p className="step-note"><code>SELECT * FROM oltp.v_user_profile</code></p>
                            <table>
                                <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>API key</th><th>Bio</th><th>Genre</th></tr></thead>
                                <tbody>
                                    {profiles.map(p => (
                                        <tr key={p.user_id} className={p.user_id === selectedUser ? 'hl' : ''}>
                                            <td>{p.user_id}</td><td>{p.username}</td>
                                            <td><span className={`badge role-${(p.role || 'user').toLowerCase()}`}>{p.role}</span></td>
                                            <td>{maskApiKey(p.api_key)}</td><td>{p.bio || 'null'}</td><td>{p.favorite_genre || 'null'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {/* ============ REPLICATION ============ */}
            {activeTab === 'replication' && (
                <div className="flow">
                    <div className="flow-intro">
                        <p>Inserting or deleting a genre in <code>oltp.genres</code> fires an <code>AFTER</code> trigger that instantly propagates the change to the replica.</p>
                    </div>

                    <section className="step">
                        <div className="step-head"><span className="step-num">1</span><h3>Add a genre to the source table</h3></div>
                        <form className="step-body form-inline" onSubmit={handleCreateGenre}>
                            <div className="form-grid">
                                <div className="form-group form-group-wide">
                                    <label>New genre name</label>
                                    <input type="text" placeholder="e.g. synthwave" value={newGenreName} onChange={e => setNewGenreName(e.target.value)} />
                                </div>
                            </div>
                            <button type="submit" className="submit-btn">Add replicated genre</button>
                        </form>
                    </section>

                    <div className="flow-arrow">↓ &nbsp;the AFTER trigger propagates the change</div>

                    <section className="step">
                        <div className="step-head"><span className="step-num">2</span><h3>Source and replica stay in sync</h3></div>
                        <div className="step-body two-col">
                            <div className="mini">
                                <div className="mini-title">Source — genres</div>
                                <table>
                                    <thead><tr><th>ID</th><th>Name</th><th></th></tr></thead>
                                    <tbody>
                                        {genres.map(g => (
                                            <tr key={g.id}>
                                                <td>{g.id}</td><td>{g.name}</td>
                                                <td>
                                                    {(g.name.startsWith('modbd-') || g.name.startsWith('test-'))
                                                        ? <button className="delete-small-btn" onClick={() => handleDeleteGenre(g.id, g.name)}>Delete</button>
                                                        : <span className="protected">Protected</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mini">
                                <div className="mini-title">Replica — genres_replica</div>
                                <table>
                                    <thead><tr><th>ID</th><th>Name</th><th>Synced at</th></tr></thead>
                                    <tbody>
                                        {replicas.map(r => (
                                            <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{formatTime(r.replicated_at || r.replicated_from_am)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* ============ HORIZONTAL ============ */}
            {activeTab === 'distributed' && (
                <div className="flow">
                    <div className="flow-intro">
                        <p>Inserting into <code>oltp.v_listening_records_global</code> triggers geo-routing: European regions go to the Europe node (via FDW), the rest to the America node.</p>
                    </div>

                    <section className="step">
                        <div className="step-head"><span className="step-num">1</span><h3>Insert a listening record and pick a region</h3></div>
                        <form className="step-body form-inline" onSubmit={handleCreateListeningRecord}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>User ID</label>
                                    <input type="number" value={distUserId} onChange={e => setDistUserId(parseInt(e.target.value) || 1)} />
                                </div>
                                <div className="form-group">
                                    <label>Region</label>
                                    <select value={distRegion} onChange={e => setDistRegion(e.target.value)}>
                                        <option value="RO">RO — Romania (Europe)</option>
                                        <option value="DE">DE — Germany (Europe)</option>
                                        <option value="FR">FR — France (Europe)</option>
                                        <option value="ES">ES — Spain (Europe)</option>
                                        <option value="US">US — United States (America)</option>
                                        <option value="CA">CA — Canada (America)</option>
                                        <option value="MX">MX — Mexico (America)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Track ID</label>
                                    <input type="number" value={distTrackId} onChange={e => setDistTrackId(parseInt(e.target.value) || 100)} />
                                </div>
                                <div className="form-group">
                                    <label>Ms played</label>
                                    <input type="number" value={distMsPlayed} onChange={e => setDistMsPlayed(parseInt(e.target.value) || 180000)} />
                                </div>
                            </div>
                            <div className={`route-hint ${isEuropeSelected ? 'route-eu' : 'route-am'}`}>
                                {isEuropeSelected
                                    ? `Region ${distRegion} → routed to the EUROPE node`
                                    : `Region ${distRegion} → stored in the AMERICA node`}
                            </div>
                            <button type="submit" className="submit-btn">Insert transparently via view</button>
                            {message && <div className="status-msg">{message}</div>}
                        </form>
                    </section>

                    <div className="flow-arrow">↓ &nbsp;the INSTEAD OF trigger routes the row by region</div>

                    {/* STEP 2 — physical nodes */}
                    <section className="step">
                        <div className="step-head"><span className="step-num">2</span><h3>The row lands in the correct physical node</h3></div>
                        <div className="step-body two-col">
                            <div className="mini">
                                <div className="mini-title"><span className="badge region-am">AM</span> listening_records_am</div>
                                <table>
                                    <thead><tr><th>ID</th><th>User</th><th>Track</th><th>Region</th></tr></thead>
                                    <tbody>
                                        {amRecords.map(r => (
                                            <tr key={r.id}><td>{r.id}</td><td>{r.user_id}</td><td>{r.track_id}</td><td><span className="badge region-am">{r.region}</span></td></tr>
                                        ))}
                                        {amRecords.length === 0 && <tr><td colSpan="4" className="empty">No records</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mini">
                                <div className="mini-title"><span className="badge region-eu">EU</span> listening_records_eu</div>
                                <table>
                                    <thead><tr><th>ID</th><th>User</th><th>Track</th><th>Region</th></tr></thead>
                                    <tbody>
                                        {euRecords.map(r => (
                                            <tr key={r.id}><td>{r.id}</td><td>{r.user_id}</td><td>{r.track_id}</td><td><span className="badge region-eu">{r.region}</span></td></tr>
                                        ))}
                                        {euRecords.length === 0 && <tr><td colSpan="4" className="empty">No records</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <div className="flow-arrow">↓ &nbsp;the global view unifies both nodes with UNION ALL</div>

                    {/* STEP 3 — global unified view */}
                    <section className="step">
                        <div className="step-head"><span className="step-num">3</span><h3>The application sees one unified table</h3></div>
                        <div className="step-body">
                            <p className="step-note"><code>SELECT * FROM oltp.v_listening_records_global</code></p>
                            <table>
                                <thead><tr><th>ID</th><th>User</th><th>Track</th><th>Played at</th><th>Ms</th><th>Region</th></tr></thead>
                                <tbody>
                                    {listeningRecords.map((r, idx) => (
                                        <tr key={idx} className={r.user_id === distUserId ? 'hl' : ''}>
                                            <td>{r.id}</td><td>{r.user_id}</td><td>{r.track_id}</td>
                                            <td>{formatTime(r.played_at)}</td><td>{r.ms_played}</td>
                                            <td><span className={`badge region-${EU_REGIONS.includes(r.region) ? 'eu' : 'am'}`}>{r.region}</span></td>
                                        </tr>
                                    ))}
                                    {listeningRecords.length === 0 && <tr><td colSpan="6" className="empty">No global records</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {/* ============ VALIDATION ============ */}
            {activeTab === 'validation' && (
                <div className="validation-tab-container">
                    <div className="validation-header-card">
                        <div>
                            <h3>Data Integrity Validation</h3>
                            <p>Automated formal checks of the distributed rules: completeness, disjunction, reconstruction and replica consistency.</p>
                        </div>
                        <div className="node-status-badge-container">
                            <span className="status-label">Europe node:</span>
                            {validationData?.europeNodeOnline
                                ? <span className="status-badge-online"><span className="dot dot-green" /> Online</span>
                                : <span className="status-badge-offline"><span className="dot dot-amber" /> Offline (fallback active)</span>}
                            <button type="button" className="refresh-validation-btn" onClick={fetchValidation} disabled={validationLoading}>
                                {validationLoading ? 'Checking…' : 'Re-check'}
                            </button>
                        </div>
                    </div>

                    {validationLoading && !validationData ? (
                        <div className="validation-loading-spinner"><div className="spinner" /><p>Running consistency checks…</p></div>
                    ) : validationData && (
                        <>
                            <div className="validation-cards-grid">
                                <ValidationCard
                                    status={validationData.verticalCompleteness.status}
                                    title="Vertical completeness"
                                    desc="Every user account must have its profile fragmented in both physical tables."
                                    metrics={[
                                        ['Total users', validationData.verticalCompleteness.totalUsers],
                                        ['Secured rows', validationData.verticalCompleteness.secCount],
                                        ['Public rows', validationData.verticalCompleteness.dataCount],
                                    ]}
                                    passLabel="Valid" failLabel="Invalid"
                                />
                                <ValidationCard
                                    status={validationData.horizontalReconstruction.status}
                                    title="Global view reconstruction"
                                    desc="Transparent reconstruction through the global view (AM UNION ALL EU)."
                                    metrics={[
                                        ['Global view', validationData.horizontalReconstruction.globalCount === -1 ? 'N/A' : validationData.horizontalReconstruction.globalCount],
                                        ['AM fragment', validationData.horizontalReconstruction.amCount],
                                        ['EU fragment', validationData.horizontalReconstruction.euCount === -1 ? 'Unavailable' : validationData.horizontalReconstruction.euCount],
                                    ]}
                                    passLabel="Valid" unavailableLabel="Unavailable (EU offline)" failLabel="Reconstruction error"
                                />
                                <ValidationCard
                                    status={validationData.horizontalDisjunction.status}
                                    title="Fragment disjunction"
                                    desc="No listening record overlaps on the unique logical key."
                                    metrics={[
                                        ['Key', 'user + track + played_at'],
                                        ['Overlaps', validationData.horizontalDisjunction.overlapCount === -1 ? 'N/A' : validationData.horizontalDisjunction.overlapCount],
                                    ]}
                                    passLabel="Valid (disjoint)" unavailableLabel="Unavailable (EU offline)" failLabel="Overlaps detected"
                                />
                                <ValidationCard
                                    status={validationData.regionRouting.status}
                                    title="Region routing"
                                    desc="European records live only on EU, American records only on AM."
                                    metrics={[
                                        ['AM location errors', validationData.regionRouting.invalidAmCount],
                                        ['EU location errors', validationData.regionRouting.invalidEuCount === -1 ? 'Unavailable' : validationData.regionRouting.invalidEuCount],
                                    ]}
                                    passLabel="Correct routing" failLabel="Routing error"
                                />
                                <ValidationCard
                                    status={validationData.genreReplication.localDiffCount === 0 ? 'PASS' : 'FAIL'}
                                    title="Local fallback replica"
                                    desc="Genre catalog synced with the local safety replica on the America node."
                                    metrics={[['Local asymmetry', validationData.genreReplication.localDiffCount]]}
                                    passLabel="Synced" failLabel="Inconsistent"
                                />
                                <ValidationCard
                                    status={validationData.genreReplication.status}
                                    title="Trans-server Europe replica"
                                    desc="Bidirectional trans-server sync with the genre catalog on the Europe node."
                                    metrics={[['Trans-server asymmetry', validationData.genreReplication.remoteDiffCount === -1 ? 'N/A' : validationData.genreReplication.remoteDiffCount]]}
                                    passLabel="Synced" unavailableLabel="Unavailable (EU offline)" failLabel="Inconsistent"
                                />
                            </div>

                            <div className="seed-reconciliation-card">
                                <div className="seed-info">
                                    <h4>Reconciliation &amp; catalog sync (seed)</h4>
                                    <p>The catalog updates in real time via trans-server triggers. To guarantee a consistent initial state, run a full sync: it propagates missing genres, updates renamed ones and removes orphans from both replicas.</p>
                                </div>
                                <button type="button" className="execute-seed-btn" onClick={handleSyncGenres} disabled={syncLoading}>
                                    {syncLoading ? 'Syncing…' : 'Sync existing data (seed)'}
                                </button>
                            </div>
                            {message && <div className={`validation-message-banner ${message.toLowerCase().includes('error') ? 'error' : 'success'}`}>{message}</div>}
                        </>
                    )}
                </div>
            )}

            {/* SQL console */}
            <div className="modbd-sql-log">
                <h3>SQL Execution Console</h3>
                <p className="step-note">Statements executed in the background to simulate transparency and replication.</p>
                <div className="log-console">
                    {sqlLog.length === 0
                        ? <span className="log-empty">Interact with the forms above to see the generated SQL…</span>
                        : sqlLog.map((log, index) => <pre key={index} className="log-item">{log}</pre>)}
                </div>
            </div>
        </div>
    )
}

function ValidationCard({ status, title, desc, metrics, passLabel, failLabel, unavailableLabel }) {
    const label = status === 'PASS' ? passLabel
        : status === 'UNAVAILABLE' ? (unavailableLabel || 'Unavailable')
        : failLabel
    return (
        <div className={`validation-card-item ${status}`}>
            <div className="card-item-header">
                <span className={`v-dot v-${status}`} />
                <h4>{title}</h4>
            </div>
            <p className="card-item-desc">{desc}</p>
            <div className="card-item-metrics">
                {metrics.map(([k, v], i) => <div key={i}>{k}: <strong>{v}</strong></div>)}
            </div>
            <div className="card-item-status-footer">
                Status: <span className={`badge-status ${status}`}>{label}</span>
            </div>
        </div>
    )
}

export default MODBDPage
