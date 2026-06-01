import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import '../SpotifyStatsPage.css'

function AdminLayout() {
    const { logout } = useAuth()

    function handleLogout() {
        logout()
    }

    return (
        <div className="stats-page">
            <div className="stats-card" style={{ border: '1px solid rgba(255, 68, 68, 0.3)', boxShadow: '0 8px 32px rgba(255, 0, 0, 0.1)' }}>
                <div className="app-header">
                    <div>
                        <h1 style={{ color: '#ff4444' }}>Staff Control Center</h1>
                        <p className="stats-subtitle">
                            All-Time Wrapped Administration
                        </p>
                    </div>

                    <button className="back-btn" onClick={handleLogout} style={{ borderColor: '#ff4444', color: '#ff4444' }}>
                        Logout
                    </button>
                </div>

                <div className="section-tabs main-tabs">
                    <NavLink
                        to="/app/admin"
                        end
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                        style={({ isActive }) => isActive ? { backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', borderColor: 'rgba(255, 68, 68, 0.5)' } : {}}
                    >
                        Admin Page
                    </NavLink>

                    <NavLink
                        to="/app/admin/mobd"
                        className={({ isActive }) => isActive ? 'tab-btn active' : 'tab-btn'}
                        style={({ isActive }) => isActive ? { backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', borderColor: 'rgba(255, 68, 68, 0.5)' } : {}}
                    >
                        📐 MOBD Admin
                    </NavLink>
                    
                    <a 
                        href="http://localhost:8080/swagger-ui.html" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="tab-btn"
                    >
                        API Docs ↗
                    </a>
                </div>

                <Outlet />
            </div>
        </div>
    )
}

export default AdminLayout
