import './LandingPage.css'

/* receives navigation actions from App.jsx */
function LandingPage({ onLoginClick, onRegisterClick }) {
    return (
        <div className="landing-page">
            <div className="navbar">
                <h2 className="logo">All Time Wrapped</h2>

                <div className="nav-links">
                    <a href="#how-it-works" onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}>How it works</a>
                    <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>Features</a>
                </div>
            </div>

            <div className="hero-section">
                <h1>All Time Wrapped</h1>

                <p>Discover your music story anytime, not just once a year.</p>

                <p>
                    Create a local account and upload your Spotify listening history ZIP archive
                    to explore your personalized, interactive music dashboard.
                </p>

                <div className="hero-buttons">
                    <button className="login-btn" onClick={onLoginClick}>
                        Login
                    </button>

                    <button className="register-btn splash-btn" onClick={onRegisterClick}>
                        Register
                    </button>
                </div>
            </div>

            <div className="access-section">
                <div className="access-card">
                    <h3>Privacy-First Analytics</h3>
                    <p>
                        Create a secure local account and upload your Spotify listening history.
                        All your statistics, predictive models (SARIMA), and charts are computed
                        natively, ensuring private, secure, and lightning-fast data analysis.
                    </p>
                </div>

                <div className="access-card">
                    <h3>MusicBrainz Integration</h3>
                    <p>
                        Automatically enrich your listening history using the public MusicBrainz API.
                        The system queries and matches missing artist details, genres, and metadata
                        asynchronously to provide deeper insights.
                    </p>
                </div>
            </div>

            <div id="how-it-works" className="how-it-works">
                <h2>How it works</h2>

                <div className="steps">
                    <div className="step-card">
                        <h3>1. Create your account</h3>
                        <p>Register a local account and log in securely to access your dashboard.</p>
                    </div>

                    <div className="step-card">
                        <h3>2. Import your history</h3>
                        <p>Upload your Spotify extended streaming history ZIP for all-time analytics.</p>
                    </div>

                    <div className="step-card">
                        <h3>3. Explore your insights</h3>
                        <p>See your top songs, artists, albums, predictive trend forecasts and listening patterns.</p>
                    </div>
                </div>
            </div>

            <div id="features" className="features-section">
                <h2>What you can explore</h2>

                <div className="features-grid">
                    <div className="feature-card">
                        <h3>Top Songs & Artists</h3>
                        <p>See the songs and artists that define your listening habits.</p>
                    </div>

                    <div className="feature-card">
                        <h3>BI Dashboard & Heatmap</h3>
                        <p>Explore your habits with GitHub-style calendars and hourly clocks.</p>
                    </div>

                    <div className="feature-card">
                        <h3>Predictive Analytics</h3>
                        <p>Forecast your next month's listening volume using our SARIMA model.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LandingPage