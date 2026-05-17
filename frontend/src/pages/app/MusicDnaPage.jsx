import { useEffect, useState } from 'react';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';

// Custom content for Treemap to show the text inside the blocks
const CustomizedContent = (props) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth < 2 ? colors[Math.floor((index / (root?.children?.length || 1)) * 6)] : '#ffffff00',
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {
                depth === 1 ?
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 7}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                >
                    {name}
                </text>
                : null
            }
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
                
                // Format for Recharts Treemap
                // Treemap requires a root node
                const formattedGenres = Object.entries(genreData).map(([name, value]) => ({
                    name,
                    size: value,
                }));
                
                setGenres([{
                    name: 'Genres',
                    children: formattedGenres
                }]);
                
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
                    {genres[0]?.children?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <Treemap
                                data={genres}
                                dataKey="size"
                                stroke="#fff"
                                fill="#1DB954"
                                content={<CustomizedContent colors={COLORS} />}
                            >
                                <Tooltip formatter={(value) => `${value} weight`} />
                            </Treemap>
                        </ResponsiveContainer>
                    ) : (
                        <p className="empty-stats-message">No genres found. Try importing a file to sync genres.</p>
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
