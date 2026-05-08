import './SpotifyAccessPage.css'

function SpotifyAccessPage({ onBackClick }) {
    const handleSpotifyLogin = () => {
        window.location.href = "http://127.0.0.1:8080/api/auth/spotify/login";
    };

    return (
        <div className="spotify-page">
            <div className="spotify-card">
                <button className="back-btn" onClick={onBackClick}>
                    Back to landing page
                </button>

                <h1>Spotify Access</h1>

                <p>
                    Connect your Spotify account to explore your music insights automatically.
                </p>

                <button className="spotify-btn" onClick={handleSpotifyLogin}>
                    Continue with Spotify
                </button>
            </div>
        </div>
    )
}

export default SpotifyAccessPage