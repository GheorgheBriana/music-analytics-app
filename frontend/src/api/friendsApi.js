const API_BASE_URL = 'http://localhost:8080'

function authHeaders() {
    const userId = localStorage.getItem('userId')
    return { 'Content-Type': 'application/json', 'X-User-Id': userId }
}

export async function getMyFriends() {
    const r = await fetch(`${API_BASE_URL}/api/friends`, { headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to load friends')
    return await r.json()
}

export async function getIncomingRequests() {
    const r = await fetch(`${API_BASE_URL}/api/friends/requests/incoming`, { headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to load incoming requests')
    return await r.json()
}

export async function getOutgoingRequests() {
    const r = await fetch(`${API_BASE_URL}/api/friends/requests/outgoing`, { headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to load outgoing requests')
    return await r.json()
}

export async function searchUsers(query) {
    const r = await fetch(`${API_BASE_URL}/api/friends/search?q=${encodeURIComponent(query)}`, 
                          { headers: authHeaders() })
    if (!r.ok) throw new Error('Search failed')
    return await r.json()
}

export async function sendFriendRequest(toUserId) {
    const r = await fetch(`${API_BASE_URL}/api/friends/request`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ toUserId })
    })
    if (!r.ok) {
        const error = await r.json().catch(() => ({ message: 'Failed' }))
        throw new Error(error.message || 'Failed to send request')
    }
    return await r.json()
}

export async function acceptRequest(id) {
    const r = await fetch(`${API_BASE_URL}/api/friends/request/${id}/accept`, 
                          { method: 'PUT', headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to accept')
}

export async function rejectRequest(id) {
    const r = await fetch(`${API_BASE_URL}/api/friends/request/${id}/reject`, 
                          { method: 'PUT', headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to reject')
}

export async function cancelRequest(id) {
    const r = await fetch(`${API_BASE_URL}/api/friends/request/${id}`, 
                          { method: 'DELETE', headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to cancel')
}

export async function unfriend(otherUserId) {
    const r = await fetch(`${API_BASE_URL}/api/friends/${otherUserId}`, 
                          { method: 'DELETE', headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to unfriend')
}

export async function getFriendingEnabled() {
    const r = await fetch(`${API_BASE_URL}/api/admin/settings/friending`, { headers: authHeaders() })
    if (!r.ok) throw new Error('Failed to load setting')
    return await r.json()
}

export async function setFriendingEnabled(enabled) {
    const r = await fetch(`${API_BASE_URL}/api/admin/settings/friending`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ enabled })
    })
    if (!r.ok) throw new Error('Failed to update setting')
    return await r.json()
}
