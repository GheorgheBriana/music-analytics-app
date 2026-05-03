// backend url
const API_BASE_URL = "http://localhost:8080"

// sends the Spotify ZIP file to the backend import endpoint
export async function uploadSpotifyZip(file, userId) {
    const formData = new FormData()

    // add zip file
    formData.append("file", file)

    // backend response
    const response = await fetch(`${API_BASE_URL}/api/import/spotify-zip?userId=${userId}`, {
        method: "POST",
        body: formData,
    })

    if(!response.ok) { // true if => 200, 201, 204
        throw new Error("Failed to import Spotify ZIP file")
    }

    return response.text()

}