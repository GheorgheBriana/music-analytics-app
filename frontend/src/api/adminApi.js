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
    
    refreshWarehouseForUser: async (userId, limit = 20000) => {
        const res = await fetch(`${BASE_URL}/dw/refresh/user/${userId}?limit=${limit}`, { 
            method: 'POST', 
            headers: getHeaders() 
        });
        if (!res.ok) throw new Error('Failed to refresh warehouse for user');
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
    },

    getRecentActions: async () => {
        const res = await fetch(`${BASE_URL}/actions/recent`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch recent actions');
        return res.json();
    },

    getDataQualityStats: async () => {
        const res = await fetch(`${BASE_URL}/dw/quality`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch data quality stats');
        return res.json();
    },

    getOltpTables: async () => {
        const res = await fetch(`${BASE_URL}/schema/tables/oltp`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch OLTP tables');
        return res.json();
    },

    getDwTables: async () => {
        const res = await fetch(`${BASE_URL}/schema/tables/dw`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch DW tables');
        return res.json();
    },

    getMaterializedViews: async () => {
        const res = await fetch(`${BASE_URL}/schema/materialized-views`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch materialized views schema');
        return res.json();
    },

    getDwIndexes: async () => {
        const res = await fetch(`${BASE_URL}/schema/indexes/dw`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch DW indexes');
        return res.json();
    },

    getPartitions: async () => {
        const res = await fetch(`${BASE_URL}/schema/partitions`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch partitions');
        return res.json();
    }
};
