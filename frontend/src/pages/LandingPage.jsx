import './LandingPage.css'

/* receives navigation actions from App.jsx */
function LandingPage({ onSpotifyClick, onManualClick }) {
    return (
        <div className="landing-page">
            <div className="navbar">
                <h2 className="logo">All Time Wrapped</h2>

                <div className="nav-links">
                    <a href="#">How it works</a>
                    <a href="#">Features</a>
                </div>
            </div>

            <div className="hero-section">
                <h1>All Time Wrapped</h1>

                <p>Discover your music story anytime, not just once a year.</p>

                <p>
                    Connect your Spotify account for live insights, or create a local account
                    and upload your Spotify listening history ZIP manually.
                </p>

                <div className="hero-buttons">
                    <button className="login-btn" onClick={onSpotifyClick}>
                        Continue with Spotify
                    </button>

                    <button className="register-btn splash-btn" onClick={onManualClick}>
                        Use Manual Mode
                    </button>
                </div>
            </div>

            <div className="access-section">
                <div className="access-card">
                    <h3>Spotify Access</h3>
                    <p>
                        Connect your Spotify account to see live Spotify data such as top tracks,
                        top artists and recently played songs.
                    </p>
                </div>

                <div className="access-card">
                    <h3>Manual Access</h3>
                    <p>
                        Create a local account and upload your Spotify ZIP archive without
                        connecting your Spotify account.
                    </p>
                </div>
            </div>

            <div className="how-it-works">
                <h2>How it works</h2>

                <div className="steps">
                    <div className="step-card">
                        <h3>1. Choose your access method</h3>
                        <p>Continue with Spotify or use manual mode with a local account.</p>
                    </div>

                    <div className="step-card">
                        <h3>2. Import your history</h3>
                        <p>Upload your Spotify extended streaming history ZIP for all-time analytics.</p>
                    </div>

                    <div className="step-card">
                        <h3>3. Explore your insights</h3>
                        <p>See your top songs, artists, albums and listening patterns.</p>
                    </div>
                </div>
            </div>

            <div className="features-section">
                <h2>What you can explore</h2>

                <div className="features-grid">
                    <div className="feature-card">
                        <h3>Top Songs</h3>
                        <p>See the songs that define your listening habits.</p>
                    </div>

                    <div className="feature-card">
                        <h3>Top Artists</h3>
                        <p>Discover the artists you return to the most.</p>
                    </div>

                    <div className="feature-card">
                        <h3>Top Albums</h3>
                        <p>Explore the albums that shaped your listening history.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LandingPage