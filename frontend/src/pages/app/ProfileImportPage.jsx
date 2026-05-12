import { useEffect, useState } from 'react'

function ProfileImportPage() {
    const [selectedFile, setSelectedFile] = useState(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const [spotifyProfile, setSpotifyProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)

    const activeUserId = localStorage.getItem('userId')
    const authType = localStorage.getItem('authType')
    const isSpotifyMode = authType === 'spotify'

    useEffect(() => {
        async function loadSpotifyProfile() {
            if (!activeUserId || !isSpotifyMode) {
                setProfileLoading(false)
                return
            }

            try {
                setProfileLoading(true)

                const response = await fetch(
                    `http://127.0.0.1:8080/api/spotify-data/${activeUserId}/profile`
                )

                if (!response.ok) {
                    setSpotifyProfile(null)
                    return
                }

                const data = await response.json()
                setSpotifyProfile(data)
            } catch (error) {
                setSpotifyProfile(null)
            } finally {
                setProfileLoading(false)
            }
        }

        loadSpotifyProfile()
    }, [activeUserId, isSpotifyMode])

    function handleFileChange(event) {
        const file = event.target.files[0]
        setSelectedFile(file)
        setUploadStatus('')
    }

    async function handleUpload() {
        if (!activeUserId) {
            setUploadStatus('No logged-in user was found.')
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
                `http://127.0.0.1:8080/api/import/spotify-zip?userId=${activeUserId}`,
                {
                    method: 'POST',
                    body: formData
                }
            )

            if (!response.ok) {
                throw new Error('Import failed')
            }

            const result = await response.json()

            setUploadStatus(
                `Import completed: ${result.importedRecords} imported, ${result.duplicateRecords} duplicates, ${result.skippedRecords} skipped.`
            )
        } catch (error) {
            setUploadStatus('Something went wrong while importing the ZIP file.')
        }
    }

    return (
        <>
            <div className="all-time-section">
                <div className="all-time-header">
                    <div>
                        <h2>Profile / Import</h2>
                        <p>
                            Manage your account information and import your Spotify extended streaming history.
                        </p>
                    </div>
                </div>

                {isSpotifyMode && (
                    <div className="profile-card">
                        <h2>Connected Spotify Account</h2>

                        {profileLoading && (
                            <p className="empty-stats-message">
                                Loading Spotify profile...
                            </p>
                        )}

                        {!profileLoading && spotifyProfile && (
                            <div className="profile-grid">
                                <div>
                                    <span>Username</span>
                                    <strong>{spotifyProfile.username || 'Not available'}</strong>
                                </div>

                                <div>
                                    <span>Email</span>
                                    <strong>{spotifyProfile.email || 'Not available'}</strong>
                                </div>

                                <div>
                                    <span>Country</span>
                                    <strong>{spotifyProfile.spotifyCountry || 'Not available'}</strong>
                                </div>

                                <div>
                                    <span>Account type</span>
                                    <strong>{spotifyProfile.spotifyProduct || 'Not available'}</strong>
                                </div>
                            </div>
                        )}

                        {!profileLoading && !spotifyProfile && (
                            <p className="empty-stats-message">
                                Spotify profile could not be loaded.
                            </p>
                        )}
                    </div>
                )}

                {!isSpotifyMode && (
                    <div className="profile-card">
                        <h2>Manual Account</h2>

                        <p className="empty-stats-message">
                            You are using manual mode. You can still upload your Spotify history ZIP and generate imported history analytics.
                        </p>
                    </div>
                )}

                <div className="upload-section">
                    <h2>Upload your Spotify history</h2>

                    <p>
                        Upload your Spotify ZIP export to generate all-time statistics,
                        top tracks, top artists, top albums and listening activity.
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
        </>
    )
}

export default ProfileImportPage