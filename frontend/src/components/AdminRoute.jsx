import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }) {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return <div style={{ color: 'white', padding: '20px' }}>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (!isAdmin()) {
        return <Navigate to="/app/dashboard" replace />;
    }

    return children;
}
