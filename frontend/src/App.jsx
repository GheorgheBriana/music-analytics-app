import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import SpotifyAccessPage from './pages/SpotifyAccessPage'
import ManualAccessPage from './pages/ManualAccessPage'
import SpotifyStatsPage from './pages/SpotifyStatsPage'

function App() {
    const params = new URLSearchParams(window.location.search)
    const userIdFromUrl = params.get('userId')

    if (userIdFromUrl) {
        localStorage.setItem('userId', userIdFromUrl)
        localStorage.setItem('authType', 'spotify')
    }

    const storedUserId = localStorage.getItem('userId')
    const storedAuthType = localStorage.getItem('authType')

    const initialPage = window.location.pathname === '/spotify/callback' && userIdFromUrl
        ? 'stats'
        : storedUserId && storedAuthType
            ? 'stats'
            : 'landing'

    // the page currently shown
    const [currentPage, setCurrentPage] = useState(initialPage)

    // the current authenticated user id, from Spotify login or manual login
    const [userId, setUserId] = useState(userIdFromUrl || storedUserId)

    const goToLandingPage = () => {
        localStorage.removeItem('userId')
        localStorage.removeItem('authType')
        setUserId(null)
        setCurrentPage('landing')
        window.history.replaceState({}, '', '/')
    }

    const goToStatsPageAfterManualAuth = (manualUserId) => {
        localStorage.setItem('userId', manualUserId)
        localStorage.setItem('authType', 'manual')
        setUserId(manualUserId)
        setCurrentPage('stats')
    }

    // shows the Spotify access page
    if (currentPage === 'spotify') {
        return <SpotifyAccessPage onBackClick={goToLandingPage} />
    }

    // shows the manual register/login page
    if (currentPage === 'manual') {
        return (
            <ManualAccessPage
                onBackClick={goToLandingPage}
                onAuthSuccess={goToStatsPageAfterManualAuth}
            />
        )
    }

    // shows the statistics dashboard after Spotify or manual login
    if (currentPage === 'stats') {
        return (
            <SpotifyStatsPage
                userId={userId}
                onBackClick={goToLandingPage}
            />
        )
    }

    // shows the landing page by default
    return (
        <LandingPage
            onSpotifyClick={() => setCurrentPage('spotify')}
            onManualClick={() => setCurrentPage('manual')}
        />
    )
}

export default App