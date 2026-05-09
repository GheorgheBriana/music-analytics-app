// backend url
const API_BASE_URL = "http://localhost:8080"

// sends the Spotify ZIP file to the backend import endpoint
export async function uploadSpotifyZip(file, userId) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', userId)

    const response = await fetch('http://localhost:8080/api/import/spotify-zip', {
        method: 'POST',
        body: formData,
    })

    if (!response.ok) {
        throw new Error('Failed to upload Spotify ZIP file')
    }

    return await response.json()
}