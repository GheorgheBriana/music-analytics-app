import { useState, useEffect } from 'react'
import './ManualAccessPage.css'

function ManualAccessPage({ initialMode = 'login', onBackClick, onAuthSuccess }) {
    const [mode, setMode] = useState(initialMode)
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Sync mode state with initialMode prop when it changes
    useEffect(() => {
        setMode(initialMode)
        setError('')
    }, [initialMode])

    const isRegisterMode = mode === 'register'

    function resetForm(newMode) {
        setMode(newMode)
        setUsername('')
        setEmail('')
        setPassword('')
        setError('')
    }

    function validateForm() {
        if (!username.trim()) {
            setError('Please enter a username.')
            return false
        }

        if (isRegisterMode && !email.trim()) {
            setError('Please enter an email address.')
            return false
        }

        if (!password.trim()) {
            setError('Please enter a password.')
            return false
        }

        return true
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsLoading(true)
        setError('')

        const endpoint = isRegisterMode
            ? 'http://localhost:8080/api/auth/local/register'
            : 'http://localhost:8080/api/auth/local/login'

        const requestBody = isRegisterMode
            ? { username, email, password }
            : { username, password }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                throw new Error('Authentication failed')
            }

            const data = await response.json()

            localStorage.setItem('userId', data.userId)
            localStorage.setItem('authType', data.authType)

            onAuthSuccess(data.userId)
        } catch (error) {
            setError(
                isRegisterMode
                    ? 'The account could not be created. Please try another username or email.'
                    : 'Invalid username or password.'
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="manual-page">
            <div className="manual-card">
                <button className="back-btn" onClick={onBackClick}>
                    Back to landing page
                </button>

                <h1>Sign In to All Time Wrapped</h1>

                <p>
                    Log in or create a local account to import your Spotify extended listening history ZIP
                    and explore your personalized analytics dashboard.
                </p>

                <div className="auth-tabs">
                    <button
                        className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
                        onClick={() => resetForm('login')}
                    >
                        Login
                    </button>

                    <button
                        className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
                        onClick={() => resetForm('register')}
                    >
                        Register
                    </button>
                </div>

                <form className="manual-auth-form" onSubmit={handleSubmit}>
                    <label>
                        Username
                        <input
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="Enter your username"
                        />
                    </label>

                    {isRegisterMode && (
                        <label>
                            Email
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="Enter your email"
                            />
                        </label>
                    )}

                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter your password"
                        />
                    </label>

                    <button className="manual-btn" type="submit" disabled={isLoading}>
                        {isLoading
                            ? 'Please wait...'
                            : isRegisterMode
                                ? 'Create account'
                                : 'Login'}
                    </button>
                </form>

                {error && <p className="error-message">{error}</p>}

                <div className="manual-info-box">
                    <h2>What happens next?</h2>
                    <p>
                        After logging in, you will enter the platform where you can navigate to the
                        <strong> Import ZIP</strong> tab to upload your Spotify listening history and generate your analytics.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default ManualAccessPage