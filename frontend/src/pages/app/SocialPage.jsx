import { useEffect, useState } from 'react'
import { getMyFriends } from '../../api/friendsApi'
import { compareUsers } from '../../api/socialApi'
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
        async function loadFriends() {
            try {
                setLoading(true)
                const myFriends = await getMyFriends()
                setUsers(myFriends.map(f => ({ id: f.userId, username: f.username })))
            } catch (err) {
                setError('Failed to load friends.')
            } finally {
                setLoading(false)
            }
        }
        if (activeUserId) {
            loadFriends()
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
                <p>Loading friends...</p>
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

            {users.length === 0 ? (
                <div className="empty-friends-message">
                    <p>You need friends in order to compare music profiles.</p>
                    <a href="/app/friends" className="go-friends-link-btn">Go to Friends to add some!</a>
                </div>
            ) : (
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
            )}

            {comparison && (
                <div className="comparison-results">
                    {/* Top Row: Overall Similarity Score Circle & Academic Methodology Card */}
                    <div className="top-comparison-row">
                        <div className="compatibility-score">
                            <h3>You and {comparison.user2Name} have</h3>
                            <div className="score-circle">
                                <span className="score-value">{comparison.similarityScore}%</span>
                                <span className="score-label">Compatibility</span>
                            </div>
                        </div>

                        {/* Academic Explanation Card */}
                        <div className="academic-explainer-card">
                            <div className="explainer-header">
                                <span className="explainer-icon">🔬</span>
                                <h4>Academic Similarity Engine</h4>
                            </div>
                            <p className="explainer-desc">
                                To achieve rigorous mathematical comparison for your dissertation, this module computes a <strong>hybrid similarity model</strong> combining two classical set-theoretic and vector-space algorithms across all listening events:
                            </p>
                            <div className="algorithm-details">
                                <div className="algo-item">
                                    <h5>📐 Jaccard Similarity (Binary Catalog Overlap)</h5>
                                    <div className="formula">J(A, B) = |A ∩ B| / |A ∪ B|</div>
                                    <p>Measures the shared unique items (presence/absence) relative to your combined total library. Ignores listening frequencies.</p>
                                </div>
                                <div className="algo-item">
                                    <h5>📊 Cosine Similarity (Weighted Play Frequencies)</h5>
                                    <div className="formula">Cosine(A, B) = (A · B) / (||A|| × ||B||)</div>
                                    <p>Projects all tracks/artists into high-dimensional frequency vectors. Measures the cosine of the angle between them, focusing on play-count intensity and style alignment.</p>
                                </div>
                            </div>
                            <div className="formula-summary">
                                <strong>🧬 Weighted Multi-Dimensional Score:</strong>
                                <br />
                                <code>40% Artists + 30% Tracks + 20% Genres + 10% Rhythm</code>
                            </div>
                        </div>
                    </div>

                    {/* Double Progress Bars for 4 Dimensions */}
                    <div className="dimensions-grid-container">
                        <h4 className="section-title">📊 Multi-Dimensional Taste Breakdown</h4>
                        <div className="dimensions-grid">
                            {[
                                { name: 'Artists', score: comparison.artistScore, weight: '40%', icon: '👤' },
                                { name: 'Tracks', score: comparison.trackScore, weight: '30%', icon: '🎵' },
                                { name: 'Genres', score: comparison.genreScore, weight: '20%', icon: '🔮' },
                                { name: 'Listening Rhythm', score: comparison.rhythmScore, weight: '10%', icon: '⏱️' }
                            ].map((dim, idx) => {
                                const jaccardPct = Math.round((dim.score?.jaccard || 0) * 100);
                                const cosinePct = Math.round((dim.score?.cosine || 0) * 100);
                                const finalPercent = dim.score?.finalPercent || 0;
                                return (
                                    <div key={`dim-${idx}`} className="dimension-card">
                                        <div className="dim-header">
                                            <span className="dim-title-span">
                                                {dim.icon} <strong>{dim.name}</strong> <span className="dim-weight">({dim.weight} weight)</span>
                                            </span>
                                            <span className="dim-badge">{finalPercent}% Match</span>
                                        </div>

                                        <div className="bar-group">
                                            <div className="bar-label-container">
                                                <span>Jaccard Index (Set Overlap)</span>
                                                <span>{jaccardPct}%</span>
                                            </div>
                                            <div className="custom-progress-bg">
                                                <div className="custom-progress-fill jaccard-fill" style={{ width: `${jaccardPct}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="bar-group">
                                            <div className="bar-label-container">
                                                <span>Cosine Similarity (Listening Intensity)</span>
                                                <span>{cosinePct}%</span>
                                            </div>
                                            <div className="custom-progress-bg">
                                                <div className="custom-progress-fill cosine-fill" style={{ width: `${cosinePct}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Genre Compass - 3 Columns Layout */}
                    <div className="genre-compass-container">
                        <h4 className="section-title">🗺️ Genre Compass (Comparative Analysis)</h4>
                        <p className="section-subtitle">Comparing the macro-styles of your libraries to find common trends and personal uniqueness.</p>
                        <div className="genre-compass-grid">
                            {/* Column 1: Only Me */}
                            <div className="compass-column only-user1-col">
                                <h5>Only in Your Library</h5>
                                <div className="genres-list-pills">
                                    {comparison.onlyUser1Genres && comparison.onlyUser1Genres.length > 0 ? (
                                        comparison.onlyUser1Genres.map((genre, idx) => (
                                            <span key={`u1-genre-${idx}`} className="genre-pill u1-pill">{genre}</span>
                                        ))
                                    ) : (
                                        <p className="no-genres">No unique genres found.</p>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Common Ground */}
                            <div className="compass-column common-col">
                                <h5>Common Music DNA</h5>
                                <div className="genres-list-pills">
                                    {comparison.commonGenres && comparison.commonGenres.length > 0 ? (
                                        comparison.commonGenres.map((genre, idx) => (
                                            <span key={`common-genre-${idx}`} className="genre-pill common-pill">{genre}</span>
                                        ))
                                    ) : (
                                        <p className="no-genres">No shared genres found.</p>
                                    )}
                                </div>
                            </div>

                            {/* Column 3: Only Friend */}
                            <div className="compass-column only-user2-col">
                                <h5>Only in {comparison.user2Name}'s Library</h5>
                                <div className="genres-list-pills">
                                    {comparison.onlyUser2Genres && comparison.onlyUser2Genres.length > 0 ? (
                                        comparison.onlyUser2Genres.map((genre, idx) => (
                                            <span key={`u2-genre-${idx}`} className="genre-pill u2-pill">{genre}</span>
                                        ))
                                    ) : (
                                        <p className="no-genres">No unique genres found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Common Artists and Tracks Side-by-side */}
                    <div className="common-items-container" style={{ marginTop: '32px' }}>
                        <div className="common-section">
                            <h4>🤝 Shared Artists (Top Catalog)</h4>
                            {comparison.commonArtists && comparison.commonArtists.length > 0 ? (
                                <ul>
                                    {comparison.commonArtists.map((artist, idx) => (
                                        <li key={`artist-${idx}`}>{artist}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-common">No common artists found.</p>
                            )}
                        </div>

                        <div className="common-section">
                            <h4>🎵 Shared Tracks (Top Listenings)</h4>
                            {comparison.commonTracks && comparison.commonTracks.length > 0 ? (
                                <ul>
                                    {comparison.commonTracks.map((track, idx) => (
                                        <li key={`track-${idx}`}>{track}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-common">No common tracks found.</p>
                            )}
                        </div>
                    </div>

                    {/* Recommendations Card */}
                    {comparison.recommendations && comparison.recommendations.length > 0 && (
                        <div className="common-section recommendations-card" style={{ marginTop: '32px', width: '100%', maxWidth: '800px', margin: '32px auto 0 auto' }}>
                            <h4 style={{ color: '#1db954', borderBottom: '1px solid rgba(29, 185, 84, 0.2)', paddingBottom: '8px', marginBottom: '12px' }}>
                                💡 Recommended for You (from your friend's DNA)
                            </h4>
                            <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '12px' }}>
                                Based on Item-Based Collaborative Filtering, here are popular tracks in {comparison.user2Name}'s profile that you haven't discovered yet:
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {comparison.recommendations.map((rec, idx) => (
                                    <li key={`rec-${idx}`} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', borderLeft: '3px solid #1db954', display: 'flex', alignItems: 'center' }}>
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
