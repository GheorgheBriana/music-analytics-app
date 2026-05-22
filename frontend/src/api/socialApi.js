// backend url
const API_BASE_URL = 'http://localhost:8080'

export async function getAllUsers() {
    const response = await fetch(`${API_BASE_URL}/api/social/users`)
    if (!response.ok) {
        throw new Error('Failed to load users')
    }
    return await response.json()
}

export async function compareUsers(userId1, userId2) {
    const response = await fetch(`${API_BASE_URL}/api/social/compare/${userId1}/${userId2}`)
    if (!response.ok) {
        throw new Error('Failed to compare users')
    }
    return await response.json()
}
