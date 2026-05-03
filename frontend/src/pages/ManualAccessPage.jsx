import { useState } from 'react'
import { uploadSpotifyZip } from '../api/importApi'
import './ManualAccessPage.css'

const DEMO_USER_ID = 2

function ManualAccessPage({ onBackClick }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // saves the file selected by the user
    function handleFileChange(event) {
        setSelectedFile(event.target.files[0])
        setMessage('')
        setError('')
    }

    // uploads the selected ZIP file to the backend
    async function handleUpload() {
        if (!selectedFile) {
            setError('Please select a ZIP file first.')
            return
        }

        setIsLoading(true)
        setMessage('')
        setError('')

        try {
            const result = await uploadSpotifyZip(selectedFile, DEMO_USER_ID)
            setMessage(result)
        } catch (err) {
            setError('The ZIP file could not be imported.')
        } finally {
            setIsLoading(false)
        }
    }

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

                <div className="upload-box">
                    <input
                        type="file"
                        accept=".zip"
                        onChange={handleFileChange}
                    />

                    {selectedFile && (
                        <p className="file-name">
                            Selected file: {selectedFile.name}
                        </p>
                    )}

                    <button
                        className="manual-btn"
                        onClick={handleUpload}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Importing...' : 'Import Spotify ZIP'}
                    </button>

                    {message && <p className="success-message">{message}</p>}
                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    )
}

export default ManualAccessPage