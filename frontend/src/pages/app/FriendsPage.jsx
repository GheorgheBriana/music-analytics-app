import { useEffect, useState } from 'react'
import { 
    getMyFriends, getIncomingRequests, getOutgoingRequests, 
    searchUsers, sendFriendRequest, acceptRequest, rejectRequest, 
    cancelRequest, unfriend 
} from '../../api/friendsApi'
import './FriendsPage.css'

function FriendsPage() {
    const [tab, setTab] = useState('friends')
    const [friends, setFriends] = useState([])
    const [incoming, setIncoming] = useState([])
    const [outgoing, setOutgoing] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searched, setSearched] = useState(false)
    const [message, setMessage] = useState('')
    const [messageType, setMessageType] = useState('info') // 'info' or 'error'

    function showMsg(text, type = 'info') {
        setMessage(text)
        setMessageType(type)
        setTimeout(() => {
            setMessage('')
        }, 4000)
    }

    async function loadAll() {
        try {
            const [f, inc, out] = await Promise.all([
                getMyFriends(), getIncomingRequests(), getOutgoingRequests()
            ])
            setFriends(f)
            setIncoming(inc)
            setOutgoing(out)
            
            // Sync with navigation layout badge count in real-time
            window.dispatchEvent(new CustomEvent('friendRequestsUpdated', {
                detail: { incomingCount: inc.length }
            }))
        } catch (e) {
            showMsg('Failed to load friends data', 'error')
        }
    }

    useEffect(() => {
        loadAll()
        setSearchResults([])
        setSearched(false)
    }, [tab])

    async function handleSearch() {
        if (searchQuery.trim().length < 2) {
            setSearchResults([])
            setSearched(false)
            return
        }
        try {
            const results = await searchUsers(searchQuery)
            setSearchResults(results)
            setSearched(true)
        } catch (e) {
            showMsg('Search failed', 'error')
        }
    }

    async function handleSendRequest(userId) {
        try {
            await sendFriendRequest(userId)
            showMsg('Friend request sent!', 'info')
            handleSearch()
            loadAll()
        } catch (e) {
            showMsg(e.message, 'error')
        }
    }

    async function handleAccept(id) {
        try {
            await acceptRequest(id)
            showMsg('Friend request accepted!', 'info')
            loadAll()
        } catch (e) {
            showMsg('Failed to accept request', 'error')
        }
    }

    async function handleReject(id) {
        try {
            await rejectRequest(id)
            showMsg('Friend request rejected', 'info')
            loadAll()
        } catch (e) {
            showMsg('Failed to reject request', 'error')
        }
    }

    async function handleCancel(id) {
        try {
            await cancelRequest(id)
            showMsg('Request cancelled', 'info')
            loadAll()
        } catch (e) {
            showMsg('Failed to cancel request', 'error')
        }
    }

    async function handleUnfriend(userId) {
        if (!confirm('Remove this friend?')) return
        try {
            await unfriend(userId)
            showMsg('Friend removed', 'info')
            loadAll()
        } catch (e) {
            showMsg('Failed to unfriend', 'error')
        }
    }

    return (
        <div className="friends-container">
            <div className="friends-section-header">
                <h2>Friends</h2>
                <p>Manage your connections and compare music analytics side-by-side</p>
            </div>

            {message && (
                <div className={`friends-toast-message ${messageType}`}>
                    {message}
                </div>
            )}

            <div className="friends-tabs-header">
                <button 
                    className={`friend-tab-btn ${tab === 'friends' ? 'active' : ''}`} 
                    onClick={() => setTab('friends')}
                >
                    My Friends ({friends.length})
                </button>
                <button 
                    className={`friend-tab-btn ${tab === 'incoming' ? 'active' : ''}`} 
                    onClick={() => setTab('incoming')}
                >
                    Requests {incoming.length > 0 && <span className="incoming-badge-count">{incoming.length}</span>}
                </button>
                <button 
                    className={`friend-tab-btn ${tab === 'outgoing' ? 'active' : ''}`} 
                    onClick={() => setTab('outgoing')}
                >
                    Sent ({outgoing.length})
                </button>
                <button 
                    className={`friend-tab-btn ${tab === 'search' ? 'active' : ''}`} 
                    onClick={() => setTab('search')}
                >
                    Find Friends
                </button>
            </div>

            <div className="friends-tab-body">
                {tab === 'friends' && (
                    <div className="friends-list-grid">
                        {friends.length === 0 ? (
                            <div className="friends-empty-state">
                                <p>No friends added yet. Go to "Find Friends" to connect with other users!</p>
                            </div>
                        ) : (
                            friends.map(f => (
                                <div key={f.userId} className="friend-info-card">
                                    <div className="friend-card-details">
                                        <span className="friend-card-name">{f.username}</span>
                                        <span className="friend-card-date">
                                            Friends since {new Date(f.friendsSince).toLocaleDateString('ro-RO')}
                                        </span>
                                    </div>
                                    <button onClick={() => handleUnfriend(f.userId)} className="friend-action-btn unfriend">
                                        Unfriend
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {tab === 'incoming' && (
                    <div className="friends-list-grid">
                        {incoming.length === 0 ? (
                            <div className="friends-empty-state">
                                <p>No pending incoming friend requests.</p>
                            </div>
                        ) : (
                            incoming.map(r => (
                                <div key={r.requestId} className="friend-info-card">
                                    <div className="friend-card-details">
                                        <span className="friend-card-name">{r.otherUsername}</span>
                                        <span className="friend-card-date">Wants to compare music profiles</span>
                                    </div>
                                    <div className="friend-card-action-group">
                                        <button onClick={() => handleAccept(r.requestId)} className="friend-action-btn accept">
                                            Accept
                                        </button>
                                        <button onClick={() => handleReject(r.requestId)} className="friend-action-btn reject">
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {tab === 'outgoing' && (
                    <div className="friends-list-grid">
                        {outgoing.length === 0 ? (
                            <div className="friends-empty-state">
                                <p>No pending outgoing requests sent.</p>
                            </div>
                        ) : (
                            outgoing.map(r => (
                                <div key={r.requestId} className="friend-info-card">
                                    <div className="friend-card-details">
                                        <span className="friend-card-name">{r.otherUsername}</span>
                                        <span className="friend-card-date">Waiting for response</span>
                                    </div>
                                    <button onClick={() => handleCancel(r.requestId)} className="friend-action-btn cancel">
                                        Cancel
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {tab === 'search' && (
                    <div className="friends-search-panel">
                        <div className="friends-search-row">
                            <input
                                type="text" 
                                placeholder="Search by username (min. 2 characters)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="friends-search-input"
                            />
                            <button onClick={handleSearch} className="friends-search-btn">
                                Search
                            </button>
                        </div>
                        
                        {searched && searchResults.length === 0 ? (
                            <div className="friends-empty-state">
                                <p>No users found matching "{searchQuery}"</p>
                            </div>
                        ) : (
                            <div className="friends-search-results-grid">
                                {searchResults.map(u => (
                                    <div key={u.userId} className="friend-info-card search-result">
                                        <span className="friend-card-name">{u.username}</span>
                                        
                                        {u.friendshipStatus === 'NONE' && (
                                            <button onClick={() => handleSendRequest(u.userId)} className="friend-action-btn add">
                                                Add Friend
                                            </button>
                                        )}
                                        {u.friendshipStatus === 'PENDING_OUTGOING' && (
                                            <span className="friendship-status-pill pending">Request Sent</span>
                                        )}
                                        {u.friendshipStatus === 'PENDING_INCOMING' && (
                                            <div className="friend-card-action-group">
                                                <span className="friendship-status-pill incoming">Sent you request</span>
                                            </div>
                                        )}
                                        {u.friendshipStatus === 'FRIENDS' && (
                                            <span className="friendship-status-pill friends">Already Friends</span>
                                        )}
                                        {u.friendshipStatus === 'REJECTED' && (
                                            <button onClick={() => handleSendRequest(u.userId)} className="friend-action-btn add">
                                                Add Friend
                                            </button>
                                        )}
                                        {u.friendshipStatus === 'BLOCKED' && (
                                            <span className="friendship-status-pill blocked">Blocked</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default FriendsPage
