const BASE_URL = 'http://localhost:8080/api/admin';

// Helper to get headers
const getHeaders = () => {
    const userId = localStorage.getItem('userId');
    return {
        'Content-Type': 'application/json',
        'X-User-Id': userId || ''
    };
};

export const adminApi = {
    listUsers: async () => {
        const res = await fetch(`${BASE_URL}/users`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    
    getDwStats: async () => {
        const res = await fetch(`${BASE_URL}/dw/stats`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },
    
    refreshWarehouse: async (limit = 20000) => {
        const res = await fetch(`${BASE_URL}/dw/refresh?limit=${limit}`, { 
            method: 'POST', 
            headers: getHeaders() 
        });
        if (!res.ok) throw new Error('Failed to refresh warehouse');
        return res.json();
    },
    
    refreshMaterializedViews: async () => {
        const res = await fetch(`${BASE_URL}/dw/refresh-mvs`, { 
            method: 'POST', 
            headers: getHeaders() 
        });
        if (!res.ok) throw new Error('Failed to refresh MVs');
        return res.json();
    },
    
    getEnrichmentStatus: async () => {
        const res = await fetch(`${BASE_URL}/enrichment/status`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch enrichment status');
        return res.json();
    },
    
    triggerEnrichment: async (limit = 10) => {
        const res = await fetch(`${BASE_URL}/enrichment/trigger?limit=${limit}`, { 
            method: 'POST', 
            headers: getHeaders() 
        });
        if (!res.ok) throw new Error('Failed to trigger enrichment');
        return res.json();
    }
};
