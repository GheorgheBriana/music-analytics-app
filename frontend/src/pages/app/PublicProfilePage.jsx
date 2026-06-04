import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPublicProfile } from '../../api/profileApi'
import { useAuth } from '../../contexts/AuthContext'
import '../SpotifyStatsPage.css'

export default function PublicProfilePage() {
    const { userId } = useParams()
    const { user } = useAuth()
    const viewerId = user?.id || localStorage.getItem('userId')
    const navigate = useNavigate()

    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [avatarError, setAvatarError] = useState(false)

    useEffect(() => {
        if (!userId || !viewerId) return
        setLoading(true)
        setError(null)
        setAvatarError(false)
        fetchPublicProfile(viewerId, userId)
            .then(p => setProfile(p))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [userId, viewerId])

    if (loading) {
        return (
            <div className="profile-page-loading">
                <p style={{ padding: 40, color: '#aaa', textAlign: 'center' }}>Loading profile...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="profile-page-loading">
                <p style={{ padding: 40, color: '#ff6b6b', textAlign: 'center' }}>Error: {error}</p>
                <div style={{ textAlign: 'center' }}>
                    <button onClick={() => navigate(-1)} className="profile-action-btn back">Back</button>
                </div>
            </div>
        )
    }

    if (!profile) return null

    const initial = (profile.username || '?').charAt(0).toUpperCase()

    return (
        <div className="profile-page-container">
            <style dangerouslySetInnerHTML={{__html: `
                .profile-page-container {
                    display: flex;
                    flex-direction: column;
                    gap: 28px;
                    padding: 12px 0 24px 0;
                    text-align: left;
                }

                .profile-hero {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 24px;
                }

                .profile-avatar {
                    width: 90px;
                    height: 90px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1db954, #0a5527);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 38px;
                    font-weight: 800;
                    color: #fff;
                    overflow: hidden;
                    flex-shrink: 0;
                    box-shadow: 0 8px 24px rgba(29, 185, 84, 0.2);
                }

                .profile-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .profile-hero-info h1 {
                    font-size: 28px;
                    margin: 0;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 800;
                    color: #fff;
                }

                .profile-role {
                    display: inline-block;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #1db954;
                    margin-top: 4px;
                    font-weight: 700;
                }

                .profile-quick-stats {
                    display: flex;
                    gap: 14px;
                    margin-top: 14px;
                    flex-wrap: wrap;
                }

                .profile-quick-stats span {
                    color: #aeb3c5;
                    font-size: 13px;
                    background: rgba(255, 255, 255, 0.03);
                    padding: 6px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                }

                .profile-quick-stats strong {
                    color: #fff;
                }

                .profile-section {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 24px;
                }

                .fragment-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                    margin-bottom: 6px;
                }

                .fragment-header h2 {
                    font-size: 20px;
                    margin: 0;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 700;
                    color: #fff;
                }

                .fragment-badge {
                    font-size: 11px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }

                .fragment-badge.public {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.15);
                }

                .section-hint {
                    color: #8a90a6;
                    font-size: 13px;
                    margin: 4px 0 20px 0;
                    line-height: 1.5;
                }

                .section-hint code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 2px 6px;
                    border-radius: 6px;
                    color: #22c55e;
                    font-size: 12px;
                    font-family: monospace;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                }

                .info-label {
                    display: block;
                    color: #8a90a6;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    margin-bottom: 8px;
                }

                .profile-genre-pill {
                    font-size: 11px;
                    color: #1db954;
                    background: rgba(29, 185, 84, 0.1);
                    padding: 4px 12px;
                    border-radius: 20px;
                    border: 1px solid rgba(29, 185, 84, 0.2);
                    display: inline-block;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .profile-genre-pill strong {
                    color: #fff;
                    font-weight: 700;
                }

                .profile-bio-box {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.85);
                    font-style: italic;
                    margin: 0;
                    line-height: 1.5;
                    border-left: 2px solid rgba(29, 185, 84, 0.4);
                    padding: 10px 14px;
                    background: rgba(255, 255, 255, 0.01);
                    border-radius: 0 8px 8px 0;
                }

                .profile-action-btn {
                    border: none;
                    border-radius: 20px;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                    white-space: nowrap;
                }

                .profile-action-btn.compare {
                    background: rgba(34, 197, 94, 0.12);
                    border: 1px solid rgba(34, 197, 94, 0.25);
                    color: #22c55e;
                }

                .profile-action-btn.compare:hover {
                    background: #22c55e;
                    color: #fff;
                    box-shadow: 0 0 15px rgba(29, 185, 84, 0.35);
                    transform: translateY(-1px);
                }

                .profile-action-btn.back {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: #aeb3c5;
                }

                .profile-action-btn.back:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    transform: translateY(-1px);
                }
            `}} />

            {/* ============ HEADER PROFIL ============ */}
            <header className="profile-hero">
                <div className="profile-avatar">
                    {profile.avatarUrl && !avatarError ? (
                        <img src={profile.avatarUrl} alt="avatar" onError={() => setAvatarError(true)} />
                    ) : (
                        <span>{initial}</span>
                    )}
                </div>
                <div className="profile-hero-info">
                    <h1>{profile.username}</h1>
                    <span className="profile-role">{profile.role}</span>
                    
                    {profile.stats && (
                        <div className="profile-quick-stats">
                            <span><strong>{profile.stats.totalPlays.toLocaleString()}</strong> plays</span>
                            <span><strong>{profile.stats.topGenre || 'N/A'}</strong> top genre</span>
                            <span><strong>{profile.stats.yearsOfHistory}</strong> years history</span>
                            <span>Listening since <strong>{profile.stats.firstYear || 'N/A'}</strong></span>
                        </div>
                    )}
                </div>
            </header>

            {/* ============ FRAGMENT PUBLIC ============ */}
            <section className="profile-section">
                <div className="fragment-header">
                    <h2>Public Profile Info</h2>
                    <span className="fragment-badge public" title="Retrieved from vertical fragment user_profile_data">
                        🟢 public fragment (user_profile_data)
                    </span>
                </div>
                <p className="section-hint">
                    This public fragment contains details visible to friends. All sensitive details (IP, login history, and configuration details) are excluded.
                </p>

                <div className="public-profile-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                    {profile.favoriteGenre && (
                        <div className="info-item">
                            <span className="info-label">Favorite Genre</span>
                            <span className="profile-genre-pill">
                                Favorite: <strong>{profile.favoriteGenre}</strong>
                            </span>
                        </div>
                    )}

                    <div className="info-item">
                        <span className="info-label">Biography</span>
                        {profile.bio && profile.bio.trim() !== '' && profile.bio.toLowerCase() !== 'null' && profile.bio.toLowerCase() !== 'direct test bio' && profile.bio.toLowerCase() !== 'test bio' && profile.bio.toLowerCase() !== 'no bio yet' ? (
                            <p className="profile-bio-box">
                                "{profile.bio}"
                            </p>
                        ) : (
                            <p style={{ color: '#8a90a6', fontStyle: 'italic', margin: 0, fontSize: '13px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '10px' }}>No bio added by the user.</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button 
                            onClick={() => navigate(`/app/social?compareWith=${profile.userId}`)} 
                            className="profile-action-btn compare"
                        >
                            Compare Music Taste
                        </button>
                        <button 
                            onClick={() => navigate(-1)} 
                            className="profile-action-btn back"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}
