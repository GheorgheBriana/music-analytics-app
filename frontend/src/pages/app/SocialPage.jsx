import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getMyFriends } from '../../api/friendsApi'
import { compareUsers } from '../../api/socialApi'
import './SocialPage.css'

function shouldShowBio(bio) {
    if (!bio) return false;
    const clean = bio.trim().toLowerCase();
    return clean !== '' && clean !== 'null' && clean !== 'direct test bio' && clean !== 'test bio' && clean !== 'no bio yet' && clean !== 'bio descriere';
}

function SocialPage() {
    const [searchParams] = useSearchParams()
    const compareWith = searchParams.get('compareWith')

    const [users, setUsers] = useState([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [comparison, setComparison] = useState(null)
    const [loading, setLoading] = useState(true)
    const [comparing, setComparing] = useState(false)
    const [error, setError] = useState('')

    const activeUserId = localStorage.getItem('userId')
    const selectedFriend = users.find(u => String(u.id) === String(selectedUserId))

    useEffect(() => {
        async function loadFriends() {
            try {
                setLoading(true)
                const myFriends = await getMyFriends()
                const formattedUsers = myFriends.map(f => ({
                    id: f.userId,
                    username: f.username,
                    favoriteGenre: f.favoriteGenre,
                    avatarUrl: f.avatarUrl,
                    bio: f.bio
                }))
                setUsers(formattedUsers)

                // If compareWith query param is present, select and run compare
                if (compareWith) {
                    const friendExists = formattedUsers.some(u => String(u.id) === String(compareWith))
                    if (friendExists) {
                        setSelectedUserId(compareWith)
                        setComparing(true)
                        const result = await compareUsers(activeUserId, compareWith)
                        setComparison(result)
                    }
                }
            } catch (err) {
                setError('Failed to load friends.')
            } finally {
                setLoading(false)
                setComparing(false)
            }
        }
        if (activeUserId) {
            loadFriends()
        }
    }, [activeUserId, compareWith])

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
                            {selectedFriend && (selectedFriend.favoriteGenre || shouldShowBio(selectedFriend.bio)) && (
                                <div className="friend-taste-preview" style={{ marginTop: '20px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '280px', margin: '20px auto 0 auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="friend-avatar" style={{ width: '32px', height: '32px', fontSize: '14px', margin: 0, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #1db954, #0a5527)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', flexShrink: 0 }}>
                                            {selectedFriend.avatarUrl ? (
                                                <img src={selectedFriend.avatarUrl} alt={selectedFriend.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span>{(selectedFriend.username || '?').charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '10px', color: '#8a90a6', textTransform: 'uppercase', fontWeight: 700 }}>Favorite Genre</div>
                                            <div style={{ fontSize: '13px', color: '#1db954', fontWeight: 'bold' }}>{selectedFriend.favoriteGenre || 'unknown'}</div>
                                        </div>
                                    </div>
                                    {shouldShowBio(selectedFriend.bio) && (
                                        <p style={{ fontSize: '12px', color: '#aeb3c5', fontStyle: 'italic', margin: 0, textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                                            "{selectedFriend.bio}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Academic Explanation Card */}
                        <div className="academic-explainer-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Hybrid Similarity Engine</h4>
                                <span title="Jaccard Index: J(A, B) = |A ∩ B| / |A ∪ B|&#10;Cosine Similarity: Cosine(A, B) = (A · B) / (||A|| × ||B||)" style={{ cursor: 'help', borderBottom: '1px dotted #1db954', fontSize: '13px', color: '#1db954', fontWeight: 'bold' }}>[Math Formulas]</span>
                            </div>
                            <p style={{ margin: '0 0 16px 0', color: '#a8a8b8', fontSize: '13px', lineHeight: 1.6 }}>
                                This engine computes a hybrid similarity model combining catalog overlap and listening intensity across all historical events.
                            </p>
                            <div style={{ background: 'rgba(29, 185, 84, 0.05)', border: '1px solid rgba(29, 185, 84, 0.15)', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: '#1db954' }}>
                                <strong>Weighted Multi-Dimensional Score:</strong>
                                <br />
                                <code style={{ color: '#e2e8f0', fontWeight: 'bold', fontFamily: 'monospace' }}>40% Artists + 30% Tracks + 20% Genres + 10% Rhythm</code>
                            </div>
                        </div>
                    </div>

                    {/* Double Progress Bars for 4 Dimensions */}
                    <div className="dimensions-grid-container">
                        <h4 className="section-title">Multi-Dimensional Taste Breakdown</h4>
                        <p className="section-subtitle">A dimensional breakdown of catalog overlap and listening intensity compared to your friend.</p>
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
                                    <div key={`dim-${idx}`} className="dimension-card" title={
                                        dim.name === 'Listening Rhythm'
                                            ? "Rhythm similarity measures the cosine alignment of your 24-hour listening distributions. It reflects when you listen (daily habits/routine) rather than what artists/tracks you listen to."
                                            : `Catalog overlap (Jaccard): ${jaccardPct}% | Listening intensity (Cosine): ${cosinePct}%`
                                    }>
                                        <div className="dim-header">
                                            <span className="dim-title-span">
                                                <strong>{dim.name}</strong> <span className="dim-weight">({dim.weight} weight)</span>
                                            </span>
                                            <span className="dim-badge" style={{ cursor: 'help' }} title={
                                                dim.name === 'Listening Rhythm'
                                                    ? `Rhythm Match: ${finalPercent}% (Cosine Similarity of 24h distribution vector)`
                                                    : `Catalog overlap (Jaccard): ${jaccardPct}%\nListening intensity (Cosine): ${cosinePct}%`
                                            }>
                                                {finalPercent}% Match ⓘ
                                            </span>
                                        </div>

                                        <div className="custom-progress-bg">
                                            <div className="custom-progress-fill cosine-fill" style={{ width: `${finalPercent}%`, background: 'linear-gradient(90deg, #1db954 0%, #10b981 100%)', boxShadow: 'none' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p style={{ marginTop: '16px', fontSize: '12.5px', color: '#a8a8b8', fontStyle: 'italic', lineHeight: '1.4', background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #1db954' }}>
                            💡 <strong>Note on Listening Rhythm:</strong> This metric compares your hourly routines (24-hour play patterns) using Cosine Similarity. Unlike catalog overlaps (Artists/Tracks) which is typically low, two users who listen during similar hours (e.g. work hours or commuting) will have a high Rhythm match regardless of their library content.
                        </p>
                    </div>

                    {/* Genre Compass - 3 Columns Layout */}
                    <div className="genre-compass-container">
                        <h4 className="section-title">Genre Compass (Comparative Analysis)</h4>
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
                            <h4>Shared Artists (Top Catalog)</h4>
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
                            <h4>Shared Tracks (Top Listenings)</h4>
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
                                Recommended for You (from your friend's DNA)
                            </h4>
                            <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '12px' }}>
                                Based on Item-Based Collaborative Filtering, here are popular tracks in {comparison.user2Name}'s profile that you haven't discovered yet:
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {comparison.recommendations.map((rec, idx) => (
                                    <li key={`rec-${idx}`} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', borderLeft: '3px solid #1db954', display: 'flex', alignItems: 'center' }}>
                                        {rec}
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
