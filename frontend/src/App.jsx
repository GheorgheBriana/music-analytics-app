import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'

import LandingPage from './pages/LandingPage'
import SpotifyAccessPage from './pages/SpotifyAccessPage'
import ManualAccessPage from './pages/ManualAccessPage'

import AppLayout from './pages/app/AppLayout'
import DashboardPage from './pages/app/DashboardPage'
import AnalyticsPage from './pages/app/AnalyticsPage'
import AnalyticsPipelinePage from './pages/app/AnalyticsPipelinePage'
import BIDashboardPage from './pages/app/BIDashboardPage'
import CalendarPage from './pages/app/CalendarPage'
import MusicDnaPage from './pages/app/MusicDnaPage'
import SpotifyLivePage from './pages/app/SpotifyLivePage'
import ProfileImportPage from './pages/app/ProfileImportPage'
import PredictionsPage from './pages/app/PredictionsPage'

function LandingRoute() {
    const navigate = useNavigate()

    return (
        <LandingPage
            onSpotifyClick={() => navigate('/spotify-access')}
            onManualClick={() => navigate('/manual-access')}
        />
    )
}

function SpotifyAccessRoute() {
    const navigate = useNavigate()

    return (
        <SpotifyAccessPage
            onBackClick={() => navigate('/')}
        />
    )
}

function ManualAccessRoute() {
    const navigate = useNavigate()

    return (
        <ManualAccessPage
            onBackClick={() => navigate('/')}
            onAuthSuccess={(manualUserId) => {
                localStorage.setItem('userId', manualUserId)
                localStorage.setItem('authType', 'manual')
                navigate('/app/dashboard')
            }}
        />
    )
}

function SpotifyCallbackRoute() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    useEffect(() => {
        const userIdFromUrl = searchParams.get('userId')

        if (userIdFromUrl) {
            localStorage.setItem('userId', userIdFromUrl)
            localStorage.setItem('authType', 'spotify')
            navigate('/app/dashboard', { replace: true })
            return
        }

        navigate('/spotify-access', { replace: true })
    }, [searchParams, navigate])

    return (
        <div className="stats-page">
            <div className="stats-card">
                <p className="stats-subtitle">Connecting your Spotify account...</p>
            </div>
        </div>
    )
}

function RequireAuth({ children }) {
    const userId = localStorage.getItem('userId')
    const authType = localStorage.getItem('authType')

    if (!userId || !authType) {
        return <Navigate to="/" replace />
    }

    return children
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingRoute />} />
                <Route path="/spotify-access" element={<SpotifyAccessRoute />} />
                <Route path="/manual-access" element={<ManualAccessRoute />} />
                <Route path="/spotify/callback" element={<SpotifyCallbackRoute />} />

                <Route
                    path="/app"
                    element={
                        <RequireAuth>
                            <AppLayout />
                        </RequireAuth>
                    }
                >
                    <Route index element={<Navigate to="/app/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="dw-pipeline" element={<AnalyticsPipelinePage />} />
                    <Route path="bi-dashboard" element={<BIDashboardPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="dna" element={<MusicDnaPage />} />
                    <Route path="spotify-live" element={<SpotifyLivePage />} />
                    <Route path="predictions" element={<PredictionsPage />} />
                    <Route path="profile" element={<ProfileImportPage />} />
                    
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App