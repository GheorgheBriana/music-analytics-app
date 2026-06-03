const API_BASE_URL = 'http://localhost:8080'

export async function getDiscoveryRecommendations(userId, level = 'comfort') {
    const response = await fetch(`${API_BASE_URL}/api/discovery/user/${userId}?level=${level}`)
    if (!response.ok) {
        throw new Error('Failed to load music discovery recommendations')
    }
    return await response.json()
}
