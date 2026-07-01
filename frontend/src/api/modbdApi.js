const BASE_URL = 'http://localhost:8080/api/modbd';

// Helper to get headers
const getHeaders = () => {
    const userId = localStorage.getItem('userId');
    return {
        'Content-Type': 'application/json',
        'X-User-Id': userId || ''
    };
};

export const modbdApi = {
    getProfiles: async () => {
        const res = await fetch(`${BASE_URL}/profiles`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch profiles');
        return res.json();
    },

    getProfileFragments: async () => {
        const res = await fetch(`${BASE_URL}/profiles/fragments`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch profile fragments');
        return res.json();
    },

    updateProfile: async (userId, body) => {
        const res = await fetch(`${BASE_URL}/profiles/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to update profile');
        return res.json();
    },

    getReplicatedGenres: async () => {
        const res = await fetch(`${BASE_URL}/genres`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch replicated genres');
        return res.json();
    },

    createGenre: async (body) => {
        const res = await fetch(`${BASE_URL}/genres`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to create genre');
        return res.json();
    },

    deleteGenre: async (id) => {
        const res = await fetch(`${BASE_URL}/genres/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete genre');
        return res.json();
    },

    getGlobalListeningRecords: async () => {
        const res = await fetch(`${BASE_URL}/distributed/listening-records`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch global listening records');
        return res.json();
    },

    getHorizontalFragments: async () => {
        const res = await fetch(`${BASE_URL}/distributed/listening-records/fragments`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch horizontal fragments');
        return res.json();
    },

    createListeningRecord: async (body) => {
        const res = await fetch(`${BASE_URL}/distributed/listening-records`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to create listening record');
        return res.json();
    }
};
