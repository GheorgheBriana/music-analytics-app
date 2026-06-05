import { useState } from 'react';
import { getSpotifyLinkUrl, syncSpotify } from '../api/spotifyLinkApi';
import { useAuth } from '../contexts/AuthContext';

export default function SpotifyLinkCard({ isLinked = false, onSyncComplete }) {
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId');
    const [linking, setLinking] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // OAuth redirect flow to link accounts
    async function handleLink() {
        setLinking(true);
        setError(null);
        try {
            const { url } = await getSpotifyLinkUrl(userId);
            window.location.href = url;
        } catch (e) {
            setError(e.message);
            setLinking(false);
        }
    }

    // Sync recently played tracks
    async function handleSync() {
        setSyncing(true);
        setError(null);
        setResult(null);
        try {
            const r = await syncSpotify(userId);
            setResult(r);
            if (onSyncComplete) {
                onSyncComplete();
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div className="spotify-link-card">
            <div className="slc-header">
                <div className="slc-badge">
                    <span className="slc-icon">🎧</span>
                </div>
                <div className="slc-info">
                    <h3>Spotify Connection</h3>
                    <p className="slc-sub">
                        {isLinked
                            ? 'Your Spotify account is connected! Sync your recently played activity to update your history.'
                            : 'Link your Spotify account to automatically fetch your music stream, top tracks, and live analysis.'}
                    </p>
                </div>
            </div>

            <div className="slc-action-wrapper">
                {!isLinked ? (
                    <button className="slc-btn link" onClick={handleLink} disabled={linking}>
                        {linking ? (
                            <>
                                <span className="slc-spinner"></span>
                                Redirecting to Spotify...
                            </>
                        ) : (
                            'Link Spotify Account'
                        )}
                    </button>
                ) : (
                    <button className="slc-btn sync" onClick={handleSync} disabled={syncing}>
                        {syncing ? (
                            <>
                                <span className="slc-spinner"></span>
                                Sincronizare în curs...
                            </>
                        ) : (
                            'Sincronizează redările recente'
                        )}
                    </button>
                )}
            </div>

            {/* Sync results display */}
            {result && (
                <div className="slc-result animate-slide-down">
                    <div className="slc-result-header">
                        <h4>Sync Complete</h4>
                        <span className="slc-status-dot"></span>
                    </div>
                    <div className="slc-stats-grid">
                        <div className="slc-stat-item">
                            <span className="slc-stat-val val-fetched">{result.fetchedFromSpotify}</span>
                            <span className="slc-stat-lbl">Fetched</span>
                        </div>
                        <div className="slc-stat-item">
                            <span className="slc-stat-val val-added">{result.added}</span>
                            <span className="slc-stat-lbl">Added</span>
                        </div>
                        <div className="slc-stat-item">
                            <span className="slc-stat-val val-dup">{result.alreadyExisted}</span>
                            <span className="slc-stat-lbl">Duplicates</span>
                        </div>
                    </div>
                    <p className="slc-result-msg">{result.message}</p>
                </div>
            )}

            {error && (
                <div className="slc-err animate-slide-down">
                    <span className="slc-err-icon">⚠️</span>
                    <p>Error: {error}</p>
                </div>
            )}

            <div className="slc-note-box">
                <p className="slc-note">
                    <strong>Note:</strong> Spotify API exposes only the latest ~50 recently played tracks. To fetch history spanning months or years, use the <strong>ZIP Import</strong> tab. Our deduplication filter checks song metadata and timestamp details to ensure no duplicated items are written.
                </p>
            </div>

            <style>{`
                .spotify-link-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 24px;
                    max-width: 850px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(10px);
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .spotify-link-card:hover {
                    border-color: rgba(29, 185, 84, 0.15);
                    box-shadow: 0 12px 40px rgba(29, 185, 84, 0.05);
                }
                .slc-header {
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                }
                .slc-badge {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: rgba(29, 185, 84, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    border: 1px solid rgba(29, 185, 84, 0.15);
                }
                .slc-icon {
                    font-size: 24px;
                }
                .slc-info {
                    flex: 1;
                }
                .slc-info h3 {
                    margin: 0 0 6px 0;
                    font-family: 'Outfit', sans-serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #fff;
                }
                .slc-sub {
                    margin: 0;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: #8a90a6;
                }
                .slc-action-wrapper {
                    display: flex;
                    align-items: center;
                }
                .slc-btn {
                    border: none;
                    border-radius: 30px;
                    padding: 12px 28px;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: 'Outfit', sans-serif;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .slc-btn.link {
                    background: linear-gradient(135deg, #1db954, #159a43);
                    color: #000;
                    box-shadow: 0 4px 14px rgba(29, 185, 84, 0.2);
                }
                .slc-btn.link:hover:not(:disabled) {
                    background: linear-gradient(135deg, #1ed760, #1ab34e);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(29, 185, 84, 0.3);
                }
                .slc-btn.sync {
                    background: linear-gradient(135deg, #1db954, #159a43);
                    color: #000;
                    box-shadow: 0 4px 14px rgba(29, 185, 84, 0.2);
                }
                .slc-btn.sync:hover:not(:disabled) {
                    background: linear-gradient(135deg, #1ed760, #1ab34e);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(29, 185, 84, 0.3);
                }
                .slc-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none !important;
                }
                .slc-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(0, 0, 0, 0.2);
                    border-top-color: #000;
                    border-radius: 50%;
                    animation: slc-spin 0.8s linear infinite;
                    display: inline-block;
                }
                @keyframes slc-spin {
                    to { transform: rotate(360deg); }
                }
                .slc-result {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    border-radius: 16px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .slc-result-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .slc-result-header h4 {
                    margin: 0;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #aeb3c5;
                    font-weight: 700;
                }
                .slc-status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #1db954;
                    box-shadow: 0 0 8px #1db954;
                }
                .slc-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                    padding-bottom: 12px;
                }
                .slc-stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .slc-stat-val {
                    font-size: 24px;
                    font-weight: 800;
                    font-family: 'Outfit', sans-serif;
                }
                .slc-stat-val.val-fetched { color: #3b82f6; }
                .slc-stat-val.val-added { color: #1db954; }
                .slc-stat-val.val-dup { color: #f59e0b; }
                .slc-stat-lbl {
                    font-size: 11px;
                    color: #8a90a6;
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }
                .slc-result-msg {
                    margin: 0;
                    font-size: 13px;
                    color: #aeb3c5;
                    line-height: 1.4;
                }
                .slc-err {
                    background: rgba(239, 68, 68, 0.08);
                    border: 1px solid rgba(239, 68, 68, 0.15);
                    border-radius: 14px;
                    padding: 12px 18px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .slc-err-icon {
                    font-size: 18px;
                }
                .slc-err p {
                    margin: 0;
                    font-size: 13px;
                    color: #ff6b6b;
                    font-weight: 600;
                }
                .slc-note-box {
                    background: rgba(255, 255, 255, 0.01);
                    border-left: 3px solid rgba(255, 255, 255, 0.08);
                    padding: 4px 0 4px 14px;
                }
                .slc-note {
                    margin: 0;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #727685;
                }
                .slc-note strong {
                    color: #aeb3c5;
                }
                .animate-slide-down {
                    animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
