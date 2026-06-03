const API_BASE_URL = 'http://localhost:8080'

export async function getTasteEvolution(userId) {
    const response = await fetch(`${API_BASE_URL}/api/evolution/user/${userId}`)
    if (!response.ok) {
        throw new Error('Failed to load taste evolution analysis')
    }
    return await response.json()
}
