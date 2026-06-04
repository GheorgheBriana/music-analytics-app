import { useEffect, useState } from 'react';
import { fetchOwnProfile, updateOwnProfile, changePassword } from '../../api/profileApi';
import { useAuth } from '../../contexts/AuthContext';


const AVATAR_PRESETS = [
    { name: 'Emerald Synth', url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&h=150&fit=crop' },
    { name: 'Neon Vinyl', url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=150&h=150&fit=crop' },
    { name: 'Cyber Beats', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop' },
    { name: 'Ambient Sunset', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop' },
];

export default function ProfilePage() {
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId');
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    // Câmpuri editabile (stocate în fragmentul public user_profile_data)
    const [bio, setBio] = useState('');
    const [favoriteGenre, setFavoriteGenre] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarError, setAvatarError] = useState(false);

    useEffect(() => {
        setAvatarError(false);
    }, [avatarUrl]);

    // Detecție eroare imagine avatar în header
    const [headerImgError, setHeaderImgError] = useState(false);

    useEffect(() => {
        setHeaderImgError(false);
    }, [profile?.avatarUrl]);

    // Vizibilitate date private
    const [showEmail, setShowEmail] = useState(false);

    // Modificare parolă
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passSaving, setPassSaving] = useState(false);
    const [passMessage, setPassMessage] = useState('');
    const [passError, setPassError] = useState('');

    useEffect(() => {
        if (!userId) return;
        loadProfile();
    }, [userId]);



    function loadProfile() {
        setLoading(true);
        fetchOwnProfile(userId)
            .then((p) => {
                setProfile(p);
                setBio(p.bio || '');
                setFavoriteGenre(p.favoriteGenre || '');
                setAvatarUrl(p.avatarUrl || '');
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    async function handleSave() {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const updated = await updateOwnProfile(userId, { bio, favoriteGenre, avatarUrl });
            setProfile(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleChangePassword() {
        if (!oldPassword || !newPassword) {
            setPassError('Please fill in both password fields.');
            return;
        }
        setPassSaving(true);
        setPassError('');
        setPassMessage('');
        try {
            await changePassword(userId, oldPassword, newPassword);
            setPassMessage('Password updated successfully!');
            setOldPassword('');
            setNewPassword('');
        } catch (e) {
            setPassError(e.message);
        } finally {
            setPassSaving(false);
        }
    }



    if (loading && !profile) {
        return <div className="profile-page-loading"><p style={{ padding: 40, color: '#aaa', textAlign: 'center' }}>Loading profile...</p></div>;
    }
    if (error && !profile) {
        return <div className="profile-page-loading"><p style={{ padding: 40, color: '#ff6b6b', textAlign: 'center' }}>Error: {error}</p></div>;
    }
    if (!profile) return null;

    const initial = (profile.username || '?').charAt(0).toUpperCase();

    return (
        <div className="profile-page-container">
            {/* ============ HEADER PROFIL ============ */}
            <header className="profile-hero">
                <div className="profile-avatar">
                    {profile.avatarUrl && !headerImgError
                        ? <img src={profile.avatarUrl} alt="avatar" onError={() => setHeaderImgError(true)} />
                        : <span>{initial}</span>}
                </div>
                <div className="profile-hero-info">
                    <h1>{profile.username}</h1>
                    <span className="profile-role">{profile.role}</span>
                    {profile.stats && (
                        <div className="profile-quick-stats">
                            <span><strong>{profile.stats.totalPlays.toLocaleString()}</strong> plays</span>
                            <span><strong>{profile.stats.topGenre}</strong> top genre</span>
                            <span><strong>{profile.stats.yearsOfHistory}</strong> years history</span>
                            {favoriteGenre && (
                                <span style={{ borderColor: 'rgba(29, 185, 84, 0.2)', background: 'rgba(29, 185, 84, 0.05)' }}>
                                    ❤️ Favorite: <strong style={{ color: '#1db954' }}>{favoriteGenre}</strong>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* ============ FRAGMENT PUBLIC (editabil) ============ */}
            <section className="profile-section">
                <div className="fragment-header">
                    <h2>Public Profile</h2>
                    <span className="fragment-badge public" title="Stocat în fragmentul user_profile_data">
                        🟢 public fragment (user_profile_data)
                    </span>
                </div>
                <p className="section-hint">
                    These details are stored in the physical vertical fragment <code>user_profile_data</code> and are visible to your friends.
                </p>

                <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} autoComplete="off">
                    <label>
                        Bio
                        <textarea
                            id="profileBio"
                            name="profileBio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us about your music taste..."
                            rows={3}
                            autoComplete="off"
                        />
                    </label>
                    <label>
                        Favorite Genre
                        <input
                            id="profileFavoriteGenre"
                            name="profileFavoriteGenre"
                            value={favoriteGenre}
                            onChange={(e) => setFavoriteGenre(e.target.value)}
                            placeholder="e.g. rock, electronic, classical"
                            autoComplete="off"
                        />
                    </label>
                    
                    <label>
                        Avatar URL
                        <input
                            id="profileAvatarUrl"
                            name="profileAvatarUrl"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://..."
                            autoComplete="off"
                        />
                    </label>

                    {/* Previzualizare avatar live */}
                    {avatarUrl && !avatarError && (
                        <div className="avatar-live-preview">
                            <span className="preview-label">Live Preview:</span>
                            <img src={avatarUrl} alt="Avatar Live Preview" onError={() => setAvatarError(true)} />
                        </div>
                    )}

                    {/* Presets */}
                    <div className="avatar-presets-box">
                        <span className="preset-label">Or choose a preset theme:</span>
                        <div className="avatar-presets-grid">
                            {AVATAR_PRESETS.map((p) => (
                                <button
                                    key={p.name}
                                    type="button"
                                    className={`preset-item-btn ${avatarUrl === p.url ? 'active' : ''}`}
                                    onClick={() => setAvatarUrl(p.url)}
                                >
                                    <img src={p.url} alt={p.name} />
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="profile-actions">
                        <button type="submit" className="btn-save" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                        {saved && <span className="save-ok">✓ Saved — routed transparently via view trigger</span>}
                        {error && <span className="save-err">Error: {error}</span>}
                    </div>
                </form>
            </section>

            {/* ============ FRAGMENT SENSIBIL (read-only) ============ */}
            <section className="profile-section">
                <div className="fragment-header">
                    <h2>Private Data</h2>
                    <span className="fragment-badge secure" title="Stocat în fragmentul user_profile_sec">
                        🔒 secure fragment (user_profile_sec)
                    </span>
                </div>
                <p className="section-hint">
                    These sensitive details are stored in a separate vertical fragment (<code>user_profile_sec</code>) and are never exposed to other users.
                </p>

                <div className="sensitive-grid">
                    <div className="sensitive-item">
                        <span className="sensitive-label">Email Address</span>
                        <span className="sensitive-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{showEmail ? profile.email : '••••••••••••'}</span>
                            <button 
                                type="button" 
                                className="visibility-toggle-btn"
                                onClick={() => setShowEmail(!showEmail)}
                            >
                                {showEmail ? '👁️ Hide' : '👁️ Show'}
                            </button>
                        </span>
                    </div>
                    <div className="sensitive-item">
                        <span className="sensitive-label">Last Login Time</span>
                        <span className="sensitive-value">{formatDate(profile.lastLoginAt)}</span>
                    </div>
                </div>
            </section>

            {/* ============ SCHIMBARE PAROLĂ (Doar conturi locale sau info OAuth) ============ */}
            {profile.isLocal ? (
                <section className="profile-section">
                    <div className="fragment-header">
                        <h2>Change Password</h2>
                        <span className="fragment-badge secure" title="Modify the local account password stored in oltp.app_users">
                            🔒 secure operations
                        </span>
                    </div>
                    <p className="section-hint">
                        Update your credential access password. This operation directly alters the encrypted <code>password_hash</code> in <code>app_users</code>.
                    </p>

                    <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} autoComplete="off">
                        <label>
                            Current Password
                            <input
                                id="profileOldPassword"
                                name="profileOldPassword"
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Enter current password..."
                                autoComplete="new-password"
                            />
                        </label>
                        <label>
                            New Password
                            <input
                                id="profileNewPassword"
                                name="profileNewPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password..."
                                autoComplete="new-password"
                            />
                        </label>
                        <div className="profile-actions">
                            <button type="submit" className="btn-save" disabled={passSaving}>
                                {passSaving ? 'Updating...' : 'Update Password'}
                            </button>
                            {passMessage && <span className="save-ok">{passMessage}</span>}
                            {passError && <span className="save-err">{passError}</span>}
                        </div>
                    </form>
                </section>
            ) : (
                <section className="profile-section oauth-password-info">
                    <div className="fragment-header">
                        <h2>Change Password</h2>
                        <span className="fragment-badge secure" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.15)' }} title="Autentificat prin OAuth 2.0 cu Spotify">
                            ℹ️ OAuth Spotify
                        </span>
                    </div>
                    <p className="section-hint" style={{ color: '#8a90a6' }}>
                        Authenticated via <strong>Spotify (OAuth 2.0)</strong>. Your password and secure credentials are managed and protected by Spotify. To change your password, please visit your account settings on the official Spotify website.
                    </p>
                </section>
            )}



            {/* ============ MODBD EXPLAINER ============ */}
            <section className="profile-section modbd-note" style={{ borderLeft: '4px solid #22c55e' }}>
                <h3>🧩 Vertical Fragmentation & Transparency (MODBD)</h3>
                <p style={{ marginBottom: '12px' }}>
                    The user profile is physically split into <strong>two distinct tables</strong> in the database: non-sensitive public data (<code>user_profile_data</code> - bio, favorite genre, avatar) and private security data (<code>user_profile_sec</code> - IP, email, access date). 
                </p>
                <p style={{ marginBottom: '12px' }}>
                    The application interacts exclusively with a <strong>logical transparency view</strong> (<code>v_user_profile</code>). Upon saving, an <strong>INSTEAD OF</strong> trigger (<code>trg_update_v_user_profile</code>) automatically intercepts the UPDATE statement and distributes the columns to the corresponding physical tables.
                </p>
                <p style={{ color: '#ef4444', fontWeight: 'bold', margin: '14px 0 4px 0' }}>
                    🔒 The role of fragmentation and privacy:
                </p>
                <p style={{ marginTop: '4px' }}>
                    Fields in the <strong>public fragment</strong> are the only ones shared with other users (such as in the Friends tab or in Social comparisons). Fields in the <strong>secured fragment</strong> (such as the IP address or login history) are never exposed in any public interface and cannot be accessed by friends, offering native privacy built directly into the database architecture.
                </p>
            </section>

            <StyleBlock />
        </div>
    );
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return iso;
    }
}

// =============================================================================
// STILURI
// =============================================================================
function StyleBlock() {
    return (
        <style>{`
            .profile-page-container {
                display: flex;
                flex-direction: column;
                gap: 28px;
                padding: 12px 0 24px 0;
            }

            .profile-page-loading {
                padding: 40px 0;
                text-align: center;
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
                font-size: 26px;
                margin: 0;
                font-family: 'Outfit', sans-serif;
                font-weight: 800;
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

            .fragment-badge.secure {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
                border: 1px solid rgba(245, 158, 11, 0.15);
            }

            .section-hint {
                color: #8a90a6;
                font-size: 13px;
                margin: 4px 0 20px 0;
                line-height: 1.5;
            }

            .section-hint code, .modbd-note code {
                background: rgba(0, 0, 0, 0.3);
                padding: 2px 6px;
                border-radius: 6px;
                color: #22c55e;
                font-size: 12px;
                font-family: monospace;
                border: 1px solid rgba(255, 255, 255, 0.04);
            }

            .profile-form {
                display: flex;
                flex-direction: column;
                gap: 18px;
            }

            .profile-form label {
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-size: 13px;
                color: #aeb3c5;
                font-weight: 600;
                font-family: 'Outfit', sans-serif;
            }

            .profile-form input, .profile-form textarea {
                background: rgba(0, 0, 0, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 14px;
                padding: 12px 18px;
                color: #fff;
                font-size: 14px;
                font-family: inherit;
                outline: none;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .profile-form input:focus, .profile-form textarea:focus {
                border-color: #22c55e;
                background: rgba(34, 197, 94, 0.04);
                box-shadow: 0 0 12px rgba(34, 197, 94, 0.12);
            }

            .profile-actions {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-top: 8px;
            }

            .btn-save {
                background: #1db954;
                color: #000;
                border: none;
                border-radius: 30px;
                padding: 12px 28px;
                font-weight: 700;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.25s ease;
            }

            .btn-save:hover:not(:disabled) {
                background: #1ed760;
                transform: scale(1.02);
            }

            .btn-save:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            .save-ok {
                color: #22c55e;
                font-size: 13px;
                font-weight: 600;
            }

            .save-err {
                color: #ef4444;
                font-size: 13px;
                font-weight: 600;
            }

            .sensitive-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
                gap: 16px;
            }

            .sensitive-item {
                background: rgba(0, 0, 0, 0.15);
                border-radius: 14px;
                padding: 16px 20px;
                border: 1px solid rgba(255, 255, 255, 0.03);
                border-left: 4px solid #f59e0b;
            }

            .sensitive-label {
                display: block;
                color: #8a90a6;
                font-size: 11px;
                text-transform: uppercase;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .sensitive-value {
                display: block;
                color: #fff;
                font-size: 14px;
                margin-top: 6px;
                font-weight: 600;
                word-break: break-all;
            }

            /* ============ AVATAR PRESETS & PREVIEW ============ */
            .avatar-live-preview {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-top: 6px;
                background: rgba(255, 255, 255, 0.02);
                padding: 12px 16px;
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                width: fit-content;
            }

            .avatar-live-preview img {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #22c55e;
                box-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
            }

            .preview-label {
                font-size: 13px;
                color: #aeb3c5;
                font-weight: 600;
            }

            .avatar-presets-box {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-top: 8px;
            }

            .preset-label {
                font-size: 13px;
                color: #aeb3c5;
                font-weight: 600;
            }

            .avatar-presets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 12px;
            }

            .preset-item-btn {
                background: rgba(0, 0, 0, 0.25) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
                border-radius: 16px !important;
                padding: 10px !important;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                color: #aeb3c5;
                margin: 0 !important;
                width: auto !important;
                height: auto !important;
                min-width: 0 !important;
                box-sizing: border-box;
            }

            .preset-item-btn img {
                width: 100% !important;
                aspect-ratio: 1 / 1 !important;
                border-radius: 12px !important;
                object-fit: cover !important;
                margin: 0 !important;
                display: block;
                transition: transform 0.25s ease;
            }

            .preset-item-btn span {
                font-size: 11px !important;
                font-weight: 700 !important;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                display: block;
                color: inherit;
            }

            .preset-item-btn:hover {
                border-color: rgba(34, 197, 94, 0.4) !important;
                background: rgba(34, 197, 94, 0.04) !important;
                color: #fff !important;
            }

            .preset-item-btn:hover img {
                transform: scale(1.04);
            }

            .preset-item-btn.active {
                border-color: #22c55e !important;
                background: rgba(34, 197, 94, 0.08) !important;
                color: #fff !important;
                box-shadow: 0 0 12px rgba(34, 197, 94, 0.15) !important;
            }

            /* ============ UPLOAD SECTION ============ */
            .upload-section p {
                margin: 0 0 16px 0;
            }

            .file-dropzone {
                width: 100%;
                margin-bottom: 20px;
            }

            .file-dropzone input[type="file"] {
                display: block;
                width: 100%;
                background: rgba(0, 0, 0, 0.2);
                border: 2px dashed rgba(255, 255, 255, 0.1);
                border-radius: 14px;
                padding: 24px;
                color: #aeb3c5;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.25s ease;
                text-align: center;
            }

            .file-dropzone input[type="file"]:hover {
                border-color: #1db954;
                background: rgba(29, 185, 84, 0.03);
            }

            .upload-btn {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
                padding: 12px 28px;
                font-weight: 700;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.25s ease;
            }

            .upload-btn:hover:not(:disabled) {
                background: #1db954;
                color: #000;
                border-color: #1db954;
                transform: scale(1.02);
            }

            .upload-btn:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            .progress-container {
                margin-top: 20px;
                width: 100%;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                overflow: hidden;
                height: 12px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #1db954, #22c55e);
                transition: width 0.3s ease;
            }

            .upload-status {
                margin-top: 14px;
                font-size: 13px;
                color: #1db954;
                font-weight: 600;
            }

            .modbd-note {
                background: rgba(0, 0, 0, 0.15);
                border-radius: 16px;
                padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.03);
            }

            .modbd-note h3 {
                margin: 0 0 10px 0;
                font-size: 15px;
                font-family: 'Outfit', sans-serif;
                font-weight: 700;
            }

            .modbd-note p {
                color: #aeb3c5;
                font-size: 13px;
                line-height: 1.6;
                margin: 0;
            }
        `}</style>
    );
}
