import './ManualAccessPage.css'

function ManualAccessPage({ onBackClick }) {
    return (
        <div className="manual-page">
            <div className="manual-card">
                {/* returns to the landing page */}
                <button className="back-btn" onClick={onBackClick}>
                    Back to landing page
                </button>

                <h1>Manual Access</h1>

                <p>
                    Upload your Spotify listening history ZIP file and explore
                    your music data without connecting a Spotify account.
                </p>

                {/* ZIP upload will be added here */}
                <button className="manual-btn">
                    Upload Spotify ZIP
                </button>
            </div>
        </div>
    )
}

export default ManualAccessPage