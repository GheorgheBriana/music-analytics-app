import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import SpotifyAccessPage from './pages/SpotifyAccessPage'

function App() {
    const [currentPage, setCurrentPage] = useState('landing')

    return currentPage === 'landing'
        ? <LandingPage onSpotifyClick={() => setCurrentPage('spotify')} />
        : <SpotifyAccessPage onBackClick={() => setCurrentPage('landing')} />
}

export default App