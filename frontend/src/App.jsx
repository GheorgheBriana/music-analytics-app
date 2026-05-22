import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'

import LandingPage from './pages/LandingPage'
import SpotifyAccessPage from './pages/SpotifyAccessPage'
import ManualAccessPage from './pages/ManualAccessPage'

import UserLayout from './pages/app/UserLayout'
import DashboardPage from './pages/app/DashboardPage'
import AnalyticsPage from './pages/app/AnalyticsPage'
import BIDashboardPage from './pages/app/BIDashboardPage'
import CalendarPage from './pages/app/CalendarPage'
import MusicDnaPage from './pages/app/MusicDnaPage'
import SpotifyLivePage from './pages/app/SpotifyLivePage'
import ProfileImportPage from './pages/app/ProfileImportPage'
import PredictionsPage from './pages/app/PredictionsPage'
import SocialPage from './pages/app/SocialPage'

import AdminLayout from './pages/admin/AdminLayout'
import AdminPage from './pages/AdminPage'

import UserRoute from './components/UserRoute'
import AdminRoute from './components/AdminRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'

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
    const { login } = useAuth()

    return (
        <ManualAccessPage
            onBackClick={() => navigate('/')}
            onAuthSuccess={async (manualUserId) => {
                await login(manualUserId, 'manual')
                navigate('/app')
            }}
        />
    )
}

function SpotifyCallbackRoute() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { login } = useAuth()

    useEffect(() => {
        const userIdFromUrl = searchParams.get('userId')

        if (userIdFromUrl) {
            login(userIdFromUrl, 'spotify').then(() => {
                navigate('/app', { replace: true })
            })
            return
        }

        navigate('/spotify-access', { replace: true })
    }, [searchParams, navigate, login])

    return (
        <div className="stats-page">
            <div className="stats-card">
                <p className="stats-subtitle">Connecting your Spotify account...</p>
            </div>
        </div>
    )
}

function RoleRedirect() {
    const { user, loading, isAdmin } = useAuth()
    
    if (loading) return <div style={{ color: 'white', padding: '20px' }}>Loading...</div>;
    if (!user) return <Navigate to="/" replace />;
    
    return <Navigate to={isAdmin() ? '/app/admin' : '/app/dashboard'} replace />;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingRoute />} />
                    <Route path="/spotify-access" element={<SpotifyAccessRoute />} />
                    <Route path="/manual-access" element={<ManualAccessRoute />} />
                    <Route path="/spotify/callback" element={<SpotifyCallbackRoute />} />

                    {/* Role Router */}
                    <Route path="/app" element={<RoleRedirect />} />

                    {/* USER routes — protected by UserRoute */}
                    <Route
                        path="/app"
                        element={
                            <UserRoute>
                                <UserLayout />
                            </UserRoute>
                        }
                    >
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="bi-dashboard" element={<BIDashboardPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="dna" element={<MusicDnaPage />} />
                        <Route path="spotify-live" element={<SpotifyLivePage />} />
                        <Route path="predictions" element={<PredictionsPage />} />
                        <Route path="social" element={<SocialPage />} />
                        <Route path="profile" element={<ProfileImportPage />} />
                    </Route>

                    {/* ADMIN routes — protected by AdminRoute */}
                    <Route
                        path="/app/admin"
                        element={
                            <AdminRoute>
                                <AdminLayout />
                            </AdminRoute>
                        }
                    >
                        <Route index element={<AdminPage />} />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App