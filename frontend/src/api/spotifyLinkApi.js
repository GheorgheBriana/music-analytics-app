const API_BASE_URL = 'http://localhost:8080'

function authHeaders(userId) {
    const uid = userId || localStorage.getItem('userId')
    return {
        'Content-Type': 'application/json',
        'X-User-Id': String(uid),
    }
}

/** Obține URL-ul de autorizare Spotify pentru LINK (state=link:userId). */
export async function getSpotifyLinkUrl(userId) {
    const res = await fetch(`${API_BASE_URL}/api/auth/spotify/link-url`, {
        headers: authHeaders(userId),
    });
    if (!res.ok) throw new Error(`Link URL failed: ${res.status}`);
    return res.json(); // { url }
}

/** Sincronizează redările recente din Spotify (fără duplicate). */
export async function syncSpotify(userId) {
    const res = await fetch(`${API_BASE_URL}/api/spotify/sync`, {
        method: 'POST',
        headers: authHeaders(userId),
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Sync failed: ${res.status}`);
    }
    return res.json(); // { fetchedFromSpotify, alreadyExisted, added, message }
}
