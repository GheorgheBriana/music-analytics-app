import './SpotifyAccessPage.css'

function SpotifyAccessPage({onBackClick}) {
    return (
        <div className="spotify-page">
            <div className = "spotify-card">
                <button className="back-btn" onClick={onBackClick}>Back to landing page</button>
                <h1>Spotify Access</h1>
                <p>Connect your Spotify account to explore your music insights automatically.</p>
                <button className="spotify-btn">Continue with Spotify</button>
            </div>
        </div>
    )
}

export default SpotifyAccessPage