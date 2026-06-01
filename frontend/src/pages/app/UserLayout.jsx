import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getIncomingRequests } from '../../api/friendsApi'
import '../SpotifyStatsPage.css'

function UserLayout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [pendingCount, setPendingCount] = useState(0)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState('')

    useEffect(() => {
        if (!user) return

        const fetchPendingCount = async () => {
            try {
                const inc = await getIncomingRequests()
                setPendingCount(inc.length)

                // Show slide-in toast if there are pending requests and not shown in this tab session
                const hasSeenToast = sessionStorage.getItem('hasSeenFriendRequestToast')
                if (inc.length > 0 && !hasSeenToast) {
                    setToastMessage(inc.length === 1 
                        ? `✨ ${inc[0].otherUsername} sent you a friend request!` 
                        : `✨ You have ${inc.length} pending friend requests!`
                    )
                    setShowToast(true)
                    sessionStorage.setItem('hasSeenFriendRequestToast', 'true')
                }
            } catch (e) {
                console.error('Failed to fetch pending requests in UserLayout:', e)
            }
        }

        // Run immediately on mount (when entering the app)
        fetchPendingCount()

        // Soft polling every 30 seconds to catch requests sent while active
        const interval = setInterval(fetchPendingCount, 30000)

        // Event listener for instant state sync when user acts on requests in FriendsPage
        const handleUpdate = (e) => {
            if (e.detail && typeof e.detail.incomingCount === 'number') {
                setPendingCount(e.detail.incomingCount)
            } else {
                fetchPendingCount()
            }
        }
        window.addEventListener('friendRequestsUpdated', handleUpdate)

        return () => {
            clearInterval(interval)
            window.removeEventListener('friendRequestsUpdated', handleUpdate)
        }
    }, [user])

    function handleLogout() {
        logout()
    }

    return (
        <div className="stats-page">
            <div className="stats-card">
                <div className="app-header">
                    <div>
                        <h1>All-Time Wrapped</h1>
                        <p className="stats-subtitle">
                            Your personal music analytics platform
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {user && (
                            <span 
                                className="welcome-message" 
                                style={{ 
                                    color: '#1db954', 
                                    fontWeight: '700', 
                                    fontSize: '14px',
                                    fontFamily: "'Outfit', sans-serif",
                                    letterSpacing: '0.3px',
                                    textShadow: '0 0 10px rgba(29, 185, 84, 0.15)'
                                }}
                            >
                                Welcome, {user.username}!
                            </span>
                        )}
                        <button className="back-btn" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>

                <div className="section-tabs main-tabs">
                    <NavLink
                        to="/app/dashboard"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Dashboard
                    </NavLink>

                    <NavLink
                        to="/app/analytics"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Analytics
                    </NavLink>

                    <NavLink
                        to="/app/stats"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Stats
                    </NavLink>



                    <NavLink
                        to="/app/bi-dashboard"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        BI Dashboard
                    </NavLink>

                    <NavLink
                        to="/app/calendar"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Calendar
                    </NavLink>

                    <NavLink
                        to="/app/dna"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Music DNA
                    </NavLink>

                    <NavLink
                        to="/app/predictions"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Predictions
                    </NavLink>

                    <NavLink
                        to="/app/spotify-live"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Spotify Live
                    </NavLink>

                    <NavLink
                        to="/app/social"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Social
                    </NavLink>

                    <NavLink
                        to="/app/friends"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Friends {pendingCount > 0 && <span className="friends-badge">{pendingCount}</span>}
                    </NavLink>

                    <NavLink
                        to="/app/profile"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Profile / Import
                    </NavLink>
                </div>

                <Outlet />
            </div>

            {showToast && (
                <div className="friend-request-toast">
                    <div className="toast-content">
                        <span className="toast-icon">✨</span>
                        <p className="toast-text">{toastMessage}</p>
                    </div>
                    <div className="toast-actions">
                        <button 
                            className="toast-action-btn view" 
                            onClick={() => {
                                setShowToast(false)
                                navigate('/app/friends')
                            }}
                        >
                            View
                        </button>
                        <button 
                            className="toast-action-btn close" 
                            onClick={() => setShowToast(false)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default UserLayout