import './LandingPage.css'

function LandingPage() {
    return (
        <div className = "landing-page">
            <div className = "navbar">
                <h2 className = "logo"> All Time Wrapped </h2>

                <div className = "nav-links">
                    <a href = "#">How it works</a>
                    <a href = "#">Features</a>
                </div>
            </div>
            <div className = "hero-section">
                <h1> All Time Wrapped</h1>
                <p>Discover your music story anytime, not just once a year.</p>
                <p>
                    Use your Spotify account for automatic insights, or create an account
                    and upload your listening data manually.
                </p>
                <div className = "hero-buttons">
                    <button className = "login-btn">Continue with Spotify</button>
                    <button className = "register-btn splash-btn">Use Manual Mode</button>
                </div>
            </div>
            <div className="access-section">
                <div className="access-card">
                    <h3>Spotify Access</h3>
                    <p>Connect your Spotify account and get your listening insights automatically.</p>
                </div>

                <div className="access-card">
                    <h3>Manual Access</h3>
                    <p>Create an account, upload your file, and use the app without Spotify login.</p>
                </div>
            </div>
            <div className="how-it-works">
                <h2>How it works</h2>
                <div className="steps">
                    <div className="step-card">
                        <h3>1. Choose your access method</h3>
                        <p>Continue with Spotify or use manual mode.</p>
                    </div>

                    <div className="step-card">
                        <h3>2. Import your music data</h3>
                        <p>Your listening data is loaded automatically or from your uploaded file.</p>
                    </div>

                    <div className="step-card">
                        <h3>3. Explore your insights</h3>
                        <p>See your top songs, artists, genres, and listening patterns.</p>
                    </div>
                </div>
            </div>
            <div className = "features-section">
                <h2>What you can explore</h2>

                <div className = "features-grid">
                    <div className = "feature-card">
                        <h3>Top Songs</h3>
                        <p>See the songs that define your listening habits.</p>
                    </div>

                    <div className = "feature-card">
                        <h3>Top Artists</h3>
                        <p>Discover the artists you return to the most.</p>
                    </div>

                    <div className = "feature-card">
                        <h3>Mood Insights</h3>
                        <p>Explore the emotional vibe of your music preferences.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LandingPage
