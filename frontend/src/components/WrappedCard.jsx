import React, { useRef } from 'react'
import html2canvas from 'html2canvas'
import './WrappedCard.css'

function WrappedCard({ stats, topGenre, onClose }) {
    const cardRef = useRef(null)

    if (!stats) return null

    const topArtist = stats.top10Artists && stats.top10Artists.length > 0 ? stats.top10Artists[0].artistName : 'N/A'
    const topTrack = stats.top10Tracks && stats.top10Tracks.length > 0 ? stats.top10Tracks[0].trackName : 'N/A'
    
    let mostActiveMonth = 'N/A'
    if (stats.listeningActivityByMonth && stats.listeningActivityByMonth.length > 0) {
        // Sort to find the month with highest totalMsPlayed
        const sorted = [...stats.listeningActivityByMonth].sort((a, b) => b.totalMsPlayed - a.totalMsPlayed)
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        mostActiveMonth = monthNames[sorted[0].month - 1] || 'N/A'
    }

    const downloadAsImage = async () => {
        if (!cardRef.current) return
        
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#121212',
                scale: 2 // High resolution
            })
            const image = canvas.toDataURL("image/png")
            const link = document.createElement('a')
            link.href = image
            link.download = 'my-music-wrapped.png'
            link.click()
        } catch (error) {
            console.error('Failed to generate image', error)
        }
    }

    return (
        <div className="wrapped-card-overlay">
            <div className="wrapped-card-container">
                <div className="wrapped-card-header">
                    <h2>Your Music Wrapped</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="wrapped-card-content" ref={cardRef}>
                    <div className="wrapped-card-bg"></div>
                    <div className="wrapped-card-inner">
                        <div className="wrapped-logo">AllTimeWrapped</div>
                        
                        <div className="wrapped-stat-grid">
                            <div className="wrapped-stat-item highlight">
                                <span className="stat-label">Top Artist</span>
                                <span className="stat-value">{topArtist}</span>
                            </div>
                            
                            <div className="wrapped-stat-item">
                                <span className="stat-label">Top Track</span>
                                <span className="stat-value">{topTrack}</span>
                            </div>
                            
                            <div className="wrapped-stat-item">
                                <span className="stat-label">Listening Time</span>
                                <span className="stat-value">{stats.totalHoursPlayed} hours</span>
                            </div>
                            
                            <div className="wrapped-stat-item">
                                <span className="stat-label">Most Active Month</span>
                                <span className="stat-value">{mostActiveMonth}</span>
                            </div>
                            
                            <div className="wrapped-stat-item highlight-alt">
                                <span className="stat-label">Music DNA</span>
                                <span className="stat-value">{topGenre || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="wrapped-card-actions">
                    <button className="download-btn" onClick={downloadAsImage}>
                        Share my Wrapped
                    </button>
                </div>
            </div>
        </div>
    )
}

export default WrappedCard
