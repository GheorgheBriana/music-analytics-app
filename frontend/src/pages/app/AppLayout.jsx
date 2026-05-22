import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import '../SpotifyStatsPage.css'

function AppLayout() {
    const navigate = useNavigate()

    function handleLogout() {
        localStorage.removeItem('userId')
        localStorage.removeItem('authType')
        navigate('/')
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

                    <button className="back-btn" onClick={handleLogout}>
                        Logout
                    </button>
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
                        to="/app/dw-pipeline"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        DW Pipeline
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
                        to="/app/profile"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                    >
                        Profile / Import
                    </NavLink>
                </div>

                <Outlet />
            </div>
        </div>
    )
}

export default AppLayout