import './ManualAccessPage.css'

function ManualAccessPage({onBackClick}) {
    return (
        <div className = "manual-page">
            <div className = "manual-card">
                <button className="back-btn"OnClick={onBackClick}>Back to landing page</button>
                <h1>Manual Access</h1>
                <p>Create an account, upload your listening file, and explore your music data without Spotify login.</p>
                <button className="manual-btn">Create account</button>
            </div>
        </div>
    )

}

export default ManualAccessPage