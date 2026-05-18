const API_BASE_URL = 'http://localhost:8080'

async function requestJson(url, options = {}) {
    const response = await fetch(url, options)

    if (!response.ok) {
        throw new Error('Analytics request failed')
    }

    return await response.json()
}

export async function getWarehouseStatus() {
    return requestJson(`${API_BASE_URL}/api/analytics/status`)
}

export async function rebuildAnalyticsPipeline(backfillLimit = 200, refreshLimit = 500) {
    const queryParams = new URLSearchParams()
    queryParams.append('backfillLimit', backfillLimit)
    queryParams.append('refreshLimit', refreshLimit)

    return requestJson(`${API_BASE_URL}/api/analytics/pipeline/rebuild?${queryParams.toString()}`, {
        method: 'POST'
    })
}

export async function getWarehouseSummary() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/summary`)
}

export async function getMonthlyListening() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/monthly-listening`)
}

export async function getTopGenres() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/top-genres`)
}

export async function getWeekendVsWeekdayStats() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/weekend-vs-weekday`)
}

export async function getListeningHeatmap() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/listening-heatmap`)
}

export async function getMonthlyGrowth() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/monthly-growth`)
}

export async function getArtistLoyalty() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/artist-loyalty`)
}

export async function getMusicInsights() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/music-insights`)
}
