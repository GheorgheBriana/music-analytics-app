// backend url
const API_BASE_URL = 'http://localhost:8080'

// loads statistics generated from the imported Spotify history
export async function getUserStats(userId) {
    const response = await fetch(`${API_BASE_URL}/api/stats/user/${userId}`)

    if (!response.ok) {
        throw new Error('Failed to load user statistics')
    }

    return await response.json()
}