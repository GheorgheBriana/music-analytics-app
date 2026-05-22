import { useEffect, useState } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#1DB954', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6'];

const CustomizedContent = (props) => {
    const { root, depth, x, y, width, height, index, colors, name, value } = props;

    // Only render for depth 1 (the actual genres, since we removed the artificial wrapper)
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
    const [loading, setLoading] = useState(true);
    
    const activeUserId = localStorage.getItem('userId');

    useEffect(() => {
        async function fetchDnaData() {
            if (!activeUserId) return;
            
            try {
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
                
                const recRes = await fetch(`http://localhost:8080/api/stats/user/${activeUserId}/recommendations`);
                const recData = await recRes.json();
                setRecommendations(recData);
            } catch (error) {
                console.error("Failed to load Music DNA", error);
            } finally {
                setLoading(false);
            }
        }
        
        fetchDnaData();
    }, [activeUserId]);

    const COLORS = ['#1DB954', '#1aa34a', '#14833b', '#0f662e', '#0b4d23', '#083318'];

    if (loading) return <div className="all-time-section"><h2>Music DNA</h2><p className="empty-stats-message">Loading your musical profile...</p></div>;

    return (
        <div className="all-time-section">
            <div className="all-time-header">
                <div>
                    <h2>Music DNA & Recommendations</h2>
                    <p>Discover your top genres and get AI recommendations based on your unique taste.</p>
                </div>
            </div>

            <div className="all-time-grid">
                <div className="all-time-panel" style={{ minHeight: '400px' }}>
                    <h3>Your Genre Distribution (Treemap)</h3>
                    {genres && genres.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <Treemap
                                data={genres}
                                dataKey="size"
                                stroke="#121212"
                                content={<CustomizedContent />}
                            >
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#282828', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value, name) => [`${value} plays`, name]}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    ) : (
                        <p className="empty-stats-message">No enriched genres available yet.</p>
                    )}
                </div>

                <div className="all-time-panel">
                    <h3>Recommended Artists</h3>
                    <p className="empty-stats-message" style={{textAlign: 'left', marginBottom: '20px'}}>
                        Based on your top genres, here are some artists you haven't listened to yet:
                    </p>
                    <div className="bar-chart-list">
                        {recommendations.length > 0 ? (
                            recommendations.map((artist, index) => (
                                <div className="bar-row" key={index} style={{ padding: '15px', backgroundColor: '#333', borderRadius: '8px', marginBottom: '10px' }}>
                                    <div className="bar-label">
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1DB954' }}>{artist}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="empty-stats-message">No recommendations available.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MusicDnaPage;
