import { useState } from 'react'
import './SpotifyStatsPage.css'

function SpotifyStatsPage({ userId, onBackClick }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [uploadStatus, setUploadStatus] = useState('')

    const handleFileChange = (event) => {
        const file = event.target.files[0]
        setSelectedFile(file)
        setUploadStatus('')
    }

    const handleUpload = async () => {
        const storedUserId = localStorage.getItem('userId') || userId

        if (!storedUserId) {
            setUploadStatus('No logged-in user was found. Please connect with Spotify again.')
            return
        }

        if (!selectedFile) {
            setUploadStatus('Please select a Spotify ZIP file first.')
            return
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        try {
            setUploadStatus('Importing your Spotify history...')

            const response = await fetch(
                `http://127.0.0.1:8080/api/import/spotify-zip?userId=${storedUserId}`,
                {
                    method: 'POST',
                    body: formData
                }
            )

            if (!response.ok) {
                throw new Error('Import failed')
            }

            const result = await response.text()
            setUploadStatus(result || 'Spotify history imported successfully.')
        } catch (error) {
            setUploadStatus('Something went wrong while importing the ZIP file.')
        }
    }

    return (
        <div className="stats-page">
            <div className="stats-card">
                <button className="back-btn" onClick={onBackClick}>
                    Back to landing page
                </button>

                <h1>Your Spotify Statistics</h1>

                <p className="stats-subtitle">
                    Spotify account connected successfully. User ID: {userId}
                </p>

                <div className="stats-grid">
                    <div className="stat-box">
                        <span className="stat-label">Total listening time</span>
                        <strong>248 hours</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Total plays</span>
                        <strong>1,284</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Top artist</span>
                        <strong>Bad Omens</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Top track</span>
                        <strong>The Worst in Me</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Most active month</span>
                        <strong>April</strong>
                    </div>

                    <div className="stat-box">
                        <span className="stat-label">Favorite genre</span>
                        <strong>Alternative Metal</strong>
                    </div>
                </div>

                                <div className="upload-section">
                    <h2>Upload your Spotify history</h2>

                    <p>
                        Upload the ZIP file exported from Spotify to generate your all-time listening statistics.
                    </p>

                    <input
                        type="file"
                        accept=".zip"
                        onChange={handleFileChange}
                    />

                    <button className="upload-btn" onClick={handleUpload}>
                        Upload Spotify ZIP
                    </button>

                    {uploadStatus && (
                        <p className="upload-status">
                            {uploadStatus}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SpotifyStatsPage