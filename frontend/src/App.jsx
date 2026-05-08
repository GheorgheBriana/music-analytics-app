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
}

    const initialPage = window.location.pathname === '/spotify/callback' && userIdFromUrl
        ? 'stats'
        : 'landing'

    // the page currently shown
    const [currentPage, setCurrentPage] = useState(initialPage)

    // the logged-in Spotify user id
    const [userId] = useState(userIdFromUrl)

    const goToLandingPage = () => {
        setCurrentPage('landing')
        window.history.replaceState({}, '', '/')
    }

    // shows the spotify access page
    if (currentPage === 'spotify') {
        return <SpotifyAccessPage onBackClick={goToLandingPage} />
    }

    // shows the manual upload page
    if (currentPage === 'manual') {
        return <ManualAccessPage onBackClick={goToLandingPage} />
    }

    // shows demo statistics after Spotify login
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