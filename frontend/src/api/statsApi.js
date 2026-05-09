// backend url
const API_BASE_URL = 'http://localhost:8080'

// loads statistics generated from the imported Spotify history
// if fromDate and toDate are provided, statistics are filtered by that period
export async function getUserStats(userId, fromDate = '', toDate = '') {
    const queryParams = new URLSearchParams()

    if (fromDate && toDate) {
        queryParams.append('from', fromDate)
        queryParams.append('to', toDate)
    }

    const queryString = queryParams.toString()
    const url = queryString
        ? `${API_BASE_URL}/api/stats/user/${userId}?${queryString}`
        : `${API_BASE_URL}/api/stats/user/${userId}`

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error('Failed to load user statistics')
    }

    return await response.json()
}