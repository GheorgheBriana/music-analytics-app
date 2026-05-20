const API_BASE_URL = 'http://localhost:8080'

function getUserIdQueryParam() {
    const userId = localStorage.getItem('userId') || localStorage.getItem('original_user_id')
    if (!userId) {
        throw new Error('Missing userId for analytics request')
    }
    return `userId=${userId}`
}

async function requestJson(url, options = {}) {
    const separator = url.includes('?') ? '&' : '?'
    const finalUrl = url + separator + getUserIdQueryParam()

    const response = await fetch(finalUrl, options)

    if (!response.ok) {
        throw new Error('Analytics request failed')
    }

    return await response.json()
}

export async function getWarehouseStatus() {
    // Status doesn't necessarily need userId but we can pass it
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

export async function getAdvancedOverview() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/advanced-overview`)
}

export async function getPartOfDayStats() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/part-of-day`)
}

export async function getPlatforms() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/platforms`)
}

export async function getCompletionRate() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/completion-rate-by-artist`)
}

export async function getPeakListeningTime() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/peak-listening-time`)
}

export async function getListeningPersonality() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/listening-personality`)
}

export async function getTopGenreByMonth() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/top-genre-by-month`)
}

export async function getArtistRankingEvolution() {
    return requestJson(`${API_BASE_URL}/api/analytics/reports/artist-ranking-evolution`)
}

export async function runMusicBrainzEnrichment(limit = 20) {
    return requestJson(`${API_BASE_URL}/api/analytics/enrichment/musicbrainz-genres?limit=${limit}`, {
        method: 'POST'
    })
}
