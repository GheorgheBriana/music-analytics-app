const API_BASE_URL = 'http://localhost:8080'

function authHeaders(userId) {
    const uid = userId || localStorage.getItem('userId')
    return {
        'Content-Type': 'application/json',
        'X-User-Id': String(uid),
    }
}

/** Profilul propriu — include fragmentul sensibil. */
export async function fetchOwnProfile(userId) {
    const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: authHeaders(userId),
    })
    if (!res.ok) throw new Error(`Profile request failed: ${res.status}`)
    return res.json()
}

/** Actualizare profil propriu (bio, gen favorit, avatar). */
export async function updateOwnProfile(userId, payload) {
    const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: 'PUT',
        headers: authHeaders(userId),
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Profile update failed: ${res.status}`)
    return res.json()
}

/** Profilul PUBLIC al altui user — fără date sensibile. */
export async function fetchPublicProfile(viewerUserId, targetUserId) {
    const res = await fetch(`${API_BASE_URL}/api/profile/${targetUserId}`, {
        headers: authHeaders(viewerUserId),
    })
    if (!res.ok) throw new Error(`Public profile request failed: ${res.status}`)
    return res.json()
}

/** Modificare parolă cont local. */
export async function changePassword(userId, oldPassword, newPassword) {
    const res = await fetch(`${API_BASE_URL}/api/profile/change-password`, {
        method: 'PUT',
        headers: authHeaders(userId),
        body: JSON.stringify({ oldPassword, newPassword }),
    })
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed' }))
        throw new Error(error.message || 'Password could not be updated')
    }
    return res.json()
}
