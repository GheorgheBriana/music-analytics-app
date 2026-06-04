import { useEffect, useState } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import { getDiscoveryRecommendations } from '../../api/discoveryApi';

const COLORS = ['#1DB954', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6'];

const CustomizedContent = (props) => {
    const { depth, x, y, width, height, index, name, value } = props;

    // Only render for depth 1 (the actual genres)
    if (depth !== 1) return null;

    // If rectangle is too small, hide text but keep the rect for the tooltip
    const showText = width > 50 && height > 30;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: COLORS[index % COLORS.length],
                    stroke: '#121212',
                    strokeWidth: 2,
                }}
            />
            {showText && (
                <>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - 5}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={13}
                        fontWeight="bold"
                        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                    >
                        {name}
                    </text>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 12}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.8)"
                        fontSize={11}
                        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                    >
                        {value} plays
                    </text>
                </>
            )}
        </g>
    );
};

function MusicDnaPage() {
    const [genres, setGenres] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [fallbackMessage, setFallbackMessage] = useState(null);
    const [loadingDna, setLoadingDna] = useState(true);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [activeLevel, setActiveLevel] = useState('comfort');
    const [expandedIdx, setExpandedIdx] = useState(null);
    
    const activeUserId = localStorage.getItem('userId');

    // Load Genre Treemap (Music DNA)
    useEffect(() => {
        async function fetchDnaData() {
            if (!activeUserId) return;
            
            try {
                setLoadingDna(true);
                const genreRes = await fetch(`http://localhost:8080/api/stats/user/${activeUserId}/genres`);
                const genreData = await genreRes.json();
                
                // Format for Treemap
                const formattedGenres = Object.entries(genreData)
                    .filter(([name]) => name.toLowerCase() !== 'unknown')
                    .map(([name, value]) => ({
                        name: name,
                        size: value,
                    }))
                    .sort((a, b) => b.size - a.size);
                
                setGenres(formattedGenres);
            } catch (error) {
                console.error("Failed to load Music DNA genres", error);
            } finally {
                setLoadingDna(false);
            }
        }
        
        fetchDnaData();
    }, [activeUserId]);

    // Load Discovery Recommendations based on Level
    useEffect(() => {
        async function loadRecommendations() {
            if (!activeUserId) return;
            
            try {
                setLoadingRecs(true);
                setExpandedIdx(null);
                const res = await getDiscoveryRecommendations(activeUserId, activeLevel);
                setRecommendations(res.recommendations || []);
                setFallbackMessage(res.fallbackMessage || null);
            } catch (error) {
                console.error("Failed to load recommendations", error);
            } finally {
                setLoadingRecs(false);
            }
        }
        
        loadRecommendations();
    }, [activeUserId, activeLevel]);

    const handleLevelChange = (level) => {
        setActiveLevel(level);
    };

    const toggleExplanation = (idx) => {
        setExpandedIdx(expandedIdx === idx ? null : idx);
    };

    if (loadingDna) {
        return (
            <div className="all-time-section">
                <h2>Music DNA</h2>
                <p className="empty-stats-message">Loading your music profile...</p>
            </div>
        );
    }

    return (
        <div className="all-time-section" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="all-time-header">
                <div>
                    <h2>Music DNA & Discovery Engine</h2>
                    <p>Explore your dominant genres in a Treemap format and discover smart recommendations based on your social profile and taste evolution.</p>
                </div>
            </div>

            <div className="all-time-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                {/* GENRE TREEMAP */}
                <div className="all-time-panel" style={{ minHeight: '440px' }}>
                    <h3 style={{ margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>Genre Distribution (Treemap)</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#a8a8b8' }}>
                        Visual representation of the total play counts categorized by genres from your data warehouse.
                    </p>
                    {genres && genres.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <Treemap
                                data={genres}
                                dataKey="size"
                                stroke="#121212"
                                content={<CustomizedContent />}
                            >
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#181824', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value, name) => [`${value} tracks listened`, name]}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    ) : (
                        <p className="empty-stats-message">Not enough data to generate your music DNA structure.</p>
                    )}
                </div>

                {/* DISCOVERY PANEL */}
                <div className="all-time-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>Music Discovery Engine</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#a8a8b8' }}>
                        Hybrid recommendations based on user similarity (Collaborative Filtering) with a fallback to your rising genres (Content-based from Evolution).
                    </p>

                    {/* Level Selector Slider/Tabs */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '30px',
                        padding: '4px',
                        marginBottom: '24px'
                    }}>
                        {[
                            { id: 'comfort', label: 'Comfort' },
                            { id: 'balance', label: 'Balance' },
                            { id: 'adventure', label: 'Adventure' }
                        ].map((level) => (
                            <button
                                key={level.id}
                                onClick={() => handleLevelChange(level.id)}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    background: activeLevel === level.id ? '#1DB954' : 'transparent',
                                    color: activeLevel === level.id ? '#fff' : '#aeb3c5',
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    boxShadow: activeLevel === level.id ? '0 4px 12px rgba(29, 185, 84, 0.25)' : 'none'
                                }}
                            >
                                {level.label}
                            </button>
                        ))}
                    </div>

                    {/* Fallback status message */}
                    {fallbackMessage && !loadingRecs && (
                        <div style={{
                            padding: '12px 16px',
                            background: 'rgba(29, 185, 84, 0.08)',
                            border: '1px solid rgba(29, 185, 84, 0.18)',
                            borderRadius: '14px',
                            fontSize: '12.5px',
                            color: '#1DB954',
                            marginBottom: '20px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            lineHeight: '1.4'
                        }}>
                            <span style={{ fontSize: '15px' }}>✨</span>
                            <div>{fallbackMessage}</div>
                        </div>
                    )}

                    {/* Recommendations list */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loadingRecs ? (
                            <p className="empty-stats-message" style={{ margin: 'auto 0' }}>Generating matching recommendations...</p>
                        ) : recommendations.length > 0 ? (
                            recommendations.map((rec, index) => (
                                <div 
                                    key={index} 
                                    style={{ 
                                        padding: '16px', 
                                        backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                                        border: '1px solid rgba(255, 255, 255, 0.04)',
                                        borderRadius: '16px',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', display: 'block', marginBottom: '2px' }}>
                                                {rec.artistName}
                                            </span>
                                            <span style={{ 
                                                fontSize: '11px', 
                                                fontWeight: 'bold', 
                                                textTransform: 'uppercase', 
                                                color: '#aeb3c5',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255, 255, 255, 0.05)'
                                            }}>
                                                {rec.genreName}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => toggleExplanation(index)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '20px',
                                                color: expandedIdx === index ? '#1DB954' : '#fff',
                                                borderColor: expandedIdx === index ? '#1DB954' : 'rgba(255,255,255,0.1)',
                                                padding: '6px 12px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                outline: 'none'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (expandedIdx !== index) {
                                                    e.currentTarget.style.borderColor = '#1DB954';
                                                    e.currentTarget.style.color = '#1DB954';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (expandedIdx !== index) {
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                                    e.currentTarget.style.color = '#fff';
                                                }
                                            }}
                                        >
                                            Why? {expandedIdx === index ? '▲' : '▼'}
                                        </button>
                                    </div>

                                    {/* Collapsible Explanations popover-like container */}
                                    {expandedIdx === index && (
                                        <div style={{
                                            marginTop: '14px',
                                            padding: '12px 16px',
                                            background: 'rgba(0, 0, 0, 0.15)',
                                            borderLeft: '3px solid #1DB954',
                                            borderRadius: '8px',
                                            fontSize: '12.5px',
                                            color: '#c7c7d1',
                                            lineHeight: '1.5',
                                            animation: 'fadeIn 0.2s ease-out'
                                        }}>
                                            <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                                                {rec.simpleReason}
                                            </div>
                                            <div>
                                                {rec.detailedReason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="empty-stats-message" style={{ margin: 'auto 0' }}>Could not generate recommendations. Import more listening history to expand local data.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MusicDnaPage;
