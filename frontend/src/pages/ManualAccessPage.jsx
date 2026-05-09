import { useState } from 'react'
import { uploadSpotifyZip } from '../api/importApi'
import './ManualAccessPage.css'

function ManualAccessPage({ onBackClick }) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [importResult, setImportResult] = useState(null)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // saves the file selected by the user
    function handleFileChange(event) {
        setSelectedFile(event.target.files[0])
        setImportResult(null)
        setError('')
    }

    // uploads the selected ZIP file to the backend
    async function handleUpload() {
        if (!selectedFile) {
            setError('Please select a ZIP file first.')
            return
        }

        const userId = localStorage.getItem('userId')

        if (!userId) {
            setError('No user is connected. Please connect your Spotify account first.')
            return
        }

        setIsLoading(true)
        setImportResult(null)
        setError('')

        try {
            const result = await uploadSpotifyZip(selectedFile, userId)
            setImportResult(result)
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

                    {importResult && (
                        <div className="import-result">
                            <h2>Import completed</h2>

                            <div className="import-result-grid">
                                <div className="import-result-card">
                                    <span>Processed files</span>
                                    <strong>{importResult.processedFiles}</strong>
                                </div>

                                <div className="import-result-card">
                                    <span>Total records found</span>
                                    <strong>{importResult.totalRecordsFound}</strong>
                                </div>

                                <div className="import-result-card">
                                    <span>Imported records</span>
                                    <strong>{importResult.importedRecords}</strong>
                                </div>

                                <div className="import-result-card">
                                    <span>Duplicate records</span>
                                    <strong>{importResult.duplicateRecords}</strong>
                                </div>

                                <div className="import-result-card">
                                    <span>Skipped records</span>
                                    <strong>{importResult.skippedRecords}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    )
}

export default ManualAccessPage