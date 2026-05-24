import { useEffect, useState } from 'react'
import { getAllUsers, compareUsers } from '../../api/socialApi'
import './SocialPage.css'

function SocialPage() {
    const [users, setUsers] = useState([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [comparison, setComparison] = useState(null)
    const [loading, setLoading] = useState(true)
    const [comparing, setComparing] = useState(false)
    const [error, setError] = useState('')

    const activeUserId = localStorage.getItem('userId')

    useEffect(() => {
        async function fetchUsers() {
            try {
                setLoading(true)
                const allUsers = await getAllUsers()
                // filter out the current user
                setUsers(allUsers.filter(u => u.id.toString() !== activeUserId))
            } catch (err) {
                setError('Failed to load users.')
            } finally {
                setLoading(false)
            }
        }
        if (activeUserId) {
            fetchUsers()
        }
    }, [activeUserId])

    async function handleCompare() {
        if (!selectedUserId) return
        
        try {
            setComparing(true)
            setError('')
            const result = await compareUsers(activeUserId, selectedUserId)
            setComparison(result)
        } catch (err) {
            setError('Failed to compare users.')
        } finally {
            setComparing(false)
        }
    }

    if (loading) {
        return (
            <div className="social-page-container">
                <h2>Social / Compare</h2>
                <p>Loading users...</p>
            </div>
        )
    }

    return (
        <div className="social-page-container">
            <div className="social-header">
                <h2>Compare with a Friend</h2>
                <p>See how your music taste matches up with other users.</p>
            </div>

            {error && <p className="social-error">{error}</p>}

            <div className="social-selector">
                <label>Select a friend to compare with:</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <select 
                        value={selectedUserId} 
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="friend-select"
                    >
                        <option value="">-- Choose a user --</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                    </select>
                    <button 
                        onClick={handleCompare}
                        disabled={!selectedUserId || comparing}
                        className="compare-btn"
                    >
                        {comparing ? 'Comparing...' : 'Compare'}
                    </button>
                </div>
            </div>

            {comparison && (
                <div className="comparison-results">
                    <div className="compatibility-score">
                        <h3>You and {comparison.user2Name} have</h3>
                        <div className="score-circle">
                            <span className="score-value">{comparison.similarityScore}%</span>
                            <span className="score-label">Compatibility</span>
                        </div>
                    </div>

                    <div className="common-items-container">
                        <div className="common-section">
                            <h4>Common Artists</h4>
                            {comparison.commonArtists && comparison.commonArtists.length > 0 ? (
                                <ul>
                                    {comparison.commonArtists.map((artist, idx) => (
                                        <li key={`artist-${idx}`}>{artist}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-common">No common artists found in Top 100.</p>
                            )}
                        </div>

                        <div className="common-section">
                            <h4>Common Tracks</h4>
                            {comparison.commonTracks && comparison.commonTracks.length > 0 ? (
                                <ul>
                                    {comparison.commonTracks.map((track, idx) => (
                                        <li key={`track-${idx}`}>{track}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-common">No common tracks found in Top 100.</p>
                            )}
                        </div>
                    </div>

                    {comparison.recommendations && comparison.recommendations.length > 0 && (
                        <div className="common-section" style={{ marginTop: '24px', width: '100%', maxWidth: '600px', margin: '24px auto 0 auto' }}>
                            <h4 style={{ color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.2)', paddingBottom: '8px', marginBottom: '12px' }}>
                                💡 Recommended for You (from your friend's DNA)
                            </h4>
                            <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '12px' }}>
                                Based on Item-Based Collaborative Filtering, here are popular tracks in {comparison.user2Name}'s profile that you haven't discovered yet:
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {comparison.recommendations.map((rec, idx) => (
                                    <li key={`rec-${idx}`} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', fontSize: '14px', borderLeft: '3px solid #1db954' }}>
                                        🎵 {rec}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default SocialPage
