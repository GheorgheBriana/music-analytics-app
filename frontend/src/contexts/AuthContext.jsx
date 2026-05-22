import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load user on mount if userId exists in localStorage
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setLoading(false);
            return;
        }
        loadCurrentUser(userId);
    }, []);

    const loadCurrentUser = async (userId) => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/me', {
                headers: { 'X-User-Id': userId }
            });
            if (!response.ok) {
                localStorage.removeItem('userId');
                localStorage.removeItem('authType');
                setUser(null);
            } else {
                const data = await response.json();
                setUser(data);
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (userId, authType) => {
        localStorage.setItem('userId', userId);
        localStorage.setItem('authType', authType);
        setLoading(true);
        await loadCurrentUser(userId);
    };

    const logout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('authType');
        setUser(null);
    };

    const isAdmin = () => user?.role === 'ADMIN';
    const isUser = () => user?.role === 'USER';

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
