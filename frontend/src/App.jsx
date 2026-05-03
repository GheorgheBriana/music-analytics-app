import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import SpotifyAccessPage from './pages/SpotifyAccessPage'
import ManualAccessPage from './pages/ManualAccessPage'

function App() {

    // the page currently shown
    const [currentPage, setCurrentPage] = useState('landing')

    //shows the spotify access page
    if(currentPage === 'spotify') {
        return <SpotifyAccessPage onBackClick={() => setCurrentPage('landing')} />
    }

    // shows the manual upload page
    if(currentPage === 'manual') {
        return <ManualAccessPage onBackClick={() => setCurrentPage('landing')} />
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