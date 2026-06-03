import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { getTasteEvolution } from '../../api/evolutionApi';

// Custom StreamGraph using native D3 stacking and drawing
function StreamGraph({ streams, months, colorScale }) {
    const svgRef = useRef();

    useEffect(() => {
        if (!streams || streams.length === 0 || !months || months.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 30 };
        const width = svgRef.current.parentElement.clientWidth || 800;
        const height = 400;

        svg.attr('width', '100%')
           .attr('height', height)
           .attr('viewBox', `0 0 ${width} ${height}`);

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Format data for d3.stack (an array of objects, one per month)
        const data = months.map((month, i) => {
            const row = { monthIndex: i, month: month };
            streams.forEach(s => {
                row[s.genreName] = s.data[i] || 0;
            });
            return row;
        });

        const keys = streams.map(s => s.genreName);

        // Stack layout
        const stack = d3.stack()
            .keys(keys)
            .offset(d3.stackOffsetSilhouette);

        const series = stack(data);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, months.length - 1])
            .range([0, chartWidth]);

        const yMin = d3.min(series, s => d3.min(s, d => d[0]));
        const yMax = d3.max(series, s => d3.max(s, d => d[1]));

        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([chartHeight, 0]);

        // Area Generator
        const area = d3.area()
            .x(d => xScale(d.data.monthIndex))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveBasis);

        // Dynamic HTML Tooltip
        const tooltip = d3.select('body').append('div')
            .style('position', 'absolute')
            .style('background', 'rgba(18, 18, 24, 0.95)')
            .style('border', '1px solid rgba(255, 255, 255, 0.08)')
            .style('padding', '12px 16px')
            .style('border-radius', '12px')
            .style('color', '#fff')
            .style('font-size', '13px')
            .style('font-family', "'Outfit', sans-serif")
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', '9999')
            .style('backdrop-filter', 'blur(10px)')
            .style('box-shadow', '0 10px 30px rgba(0, 0, 0, 0.5)');

        // Draw areas
        g.selectAll('.stream-path')
            .data(series)
            .enter()
            .append('path')
            .attr('class', 'stream-path')
            .attr('d', area)
            .attr('fill', d => colorScale(d.key))
            .attr('opacity', 0.85)
            .style('transition', 'opacity 0.2s ease, filter 0.2s ease')
            .on('mouseover', function(event, d) {
                g.selectAll('.stream-path').attr('opacity', 0.25);
                d3.select(this)
                  .attr('opacity', 1)
                  .style('filter', 'drop-shadow(0 0 10px rgba(255,255,255,0.05))');
                tooltip.style('opacity', 1);
            })
            .on('mousemove', function(event, d) {
                const [mouseX] = d3.pointer(event);
                const rawIdx = xScale.invert(mouseX);
                const monthIdx = Math.max(0, Math.min(months.length - 1, Math.round(rawIdx)));
                const monthName = months[monthIdx];
                const valuePercent = d.data[monthIdx][d.key] * 100;

                // Human month name mapping helper
                const parts = monthName.split('-');
                const monthNames = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
                let humanMonth = monthName;
                try {
                    const idx = parseInt(parts[1]) - 1;
                    humanMonth = monthNames[idx] + ' ' + parts[0];
                } catch(e) {}

                tooltip.html(`
                    <div style="font-weight: 800; color: ${colorScale(d.key)}; font-size: 15px; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">
                        ${d.key}
                    </div>
                    <div style="color: #aeb3c5; font-size: 12px; margin-bottom: 2px;">Lună: <span style="color: #fff; font-weight: 600;">${humanMonth}</span></div>
                    <div style="color: #aeb3c5; font-size: 12px;">Proporție: <span style="color: #1DB954; font-weight: 700;">${valuePercent.toFixed(1)}%</span></div>
                `)
                .style('left', (event.pageX + 18) + 'px')
                .style('top', (event.pageY - 20) + 'px');
            })
            .on('mouseleave', function() {
                g.selectAll('.stream-path')
                  .attr('opacity', 0.85)
                  .style('filter', 'none');
                tooltip.style('opacity', 0);
            });

        // Add X Axis (Month labels)
        const xAxis = d3.axisBottom(xScale)
            .ticks(Math.min(months.length, 8))
            .tickFormat(d => {
                const monthStr = months[Math.round(d)];
                if (!monthStr) return '';
                const parts = monthStr.split('-');
                const monthNames = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
                try {
                    const idx = parseInt(parts[1]) - 1;
                    return monthNames[idx] + ' ' + parts[0];
                } catch(e) {
                    return monthStr;
                }
            });

        const xAxisG = g.append('g')
            .attr('transform', `translate(0, ${chartHeight + 10})`)
            .call(xAxis);

        xAxisG.selectAll('text')
            .attr('fill', '#aeb3c5')
            .style('font-size', '11px')
            .style('font-weight', '600')
            .style('font-family', "'Outfit', sans-serif");
        xAxisG.selectAll('line').attr('stroke', 'rgba(255, 255, 255, 0.08)');
        xAxisG.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.08)');

        return () => {
            tooltip.remove();
        };
    }, [streams, months, colorScale]);

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
}

// Custom Volatility SVG component
function VolatilityChart({ volatility, months }) {
    if (!volatility || volatility.length === 0) return null;

    // We exclude the first month as volatility is a consecutive transition distance
    const chartMonths = months.slice(1);
    
    // Calculate statistics locally for the anomaly threshold line
    const distances = volatility.map(v => v.distance);
    const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    const threshold = meanDistance + 1.5 * stdDev;

    const maxDistance = Math.max(1.0, Math.max(threshold * 1.2, ...distances));

    const height = 180;
    const width = 800;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Get points coordinate
    const getCoordinates = () => {
        return volatility.map((v, i) => {
            const x = padding.left + (i / (volatility.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - (v.distance / maxDistance) * chartHeight;
            return { x, y, data: v };
        });
    };

    const points = getCoordinates();
    
    // Make path string
    let pathD = '';
    if (points.length > 0) {
        pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    }

    // Threshold y coordinate
    const thresholdY = padding.top + chartHeight - (threshold / maxDistance) * chartHeight;

    const formatHumanMonth = (monthStr) => {
        if (!monthStr || !monthStr.includes('-')) return monthStr;
        const parts = monthStr.split('-');
        const monthNames = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
        try {
            const idx = parseInt(parts[1]) - 1;
            return monthNames[idx] + ' ' + parts[0];
        } catch(e) {
            return monthStr;
        }
    };

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', minWidth: '600px' }}>
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((val, idx) => {
                    const y = padding.top + chartHeight - (val / maxDistance) * chartHeight;
                    return (
                        <g key={idx}>
                            <line 
                                x1={padding.left} 
                                y1={y} 
                                x2={width - padding.right} 
                                y2={y} 
                                stroke="rgba(255, 255, 255, 0.05)" 
                                strokeDasharray="3,3" 
                            />
                            <text 
                                x={padding.left - 8} 
                                y={y + 4} 
                                fill="#aeb3c5" 
                                fontSize={10} 
                                fontWeight="bold"
                                textAnchor="end"
                                fontFamily="'Outfit', sans-serif"
                            >
                                {val.toFixed(2)}
                            </text>
                        </g>
                    );
                })}

                {/* Anomaly Threshold Line */}
                {threshold < maxDistance && (
                    <g>
                        <line 
                            x1={padding.left} 
                            y1={thresholdY} 
                            x2={width - padding.right} 
                            y2={thresholdY} 
                            stroke="#ef4444" 
                            strokeWidth={1.5}
                            strokeDasharray="5,5" 
                            opacity={0.8}
                        />
                        <text 
                            x={width - padding.right - 6} 
                            y={thresholdY - 6} 
                            fill="#ef4444" 
                            fontSize={9} 
                            fontWeight="800"
                            textAnchor="end"
                            fontFamily="'Outfit', sans-serif"
                            letterSpacing="0.5px"
                        >
                            PRAG DE ANOMALIE (μ + 1.5σ) = {threshold.toFixed(3)}
                        </text>
                    </g>
                )}

                {/* Main line path */}
                {pathD && (
                    <path 
                        d={pathD} 
                        fill="none" 
                        stroke="linear-gradient(90deg, #1DB954 0%, #8b5cf6 100%)" 
                        strokeWidth={3} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ stroke: '#1DB954' }}
                    />
                )}

                {/* Data points */}
                {points.map((p, idx) => {
                    const isTp = p.data.isTurningPoint;
                    return (
                        <g key={idx} className="volatility-dot-group">
                            <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r={isTp ? 7 : 4} 
                                fill={isTp ? '#ef4444' : '#1DB954'} 
                                stroke={isTp ? 'rgba(239, 68, 68, 0.4)' : '#121212'}
                                strokeWidth={isTp ? 5 : 2}
                                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                            />
                            {/* Monthly ticks along the X axis */}
                            {(idx % Math.max(1, Math.round(points.length / 8)) === 0 || isTp) && (
                                <g>
                                    <line 
                                        x1={p.x} 
                                        y1={padding.top + chartHeight} 
                                        x2={p.x} 
                                        y2={padding.top + chartHeight + 6} 
                                        stroke="rgba(255, 255, 255, 0.15)" 
                                    />
                                    <text 
                                        x={p.x} 
                                        y={padding.top + chartHeight + 18} 
                                        fill={isTp ? '#ef4444' : '#aeb3c5'} 
                                        fontSize={10} 
                                        fontWeight={isTp ? 'bold' : 'normal'}
                                        textAnchor="middle"
                                        fontFamily="'Outfit', sans-serif"
                                    >
                                        {formatHumanMonth(p.data.toMonth)}
                                    </text>
                                </g>
                            )}
                            <title>
                                {`Tranziție: ${formatHumanMonth(p.data.fromMonth)} → ${formatHumanMonth(p.data.toMonth)}\nDistance: ${p.data.distance.toFixed(4)}${isTp ? ' (Moment de cotitură)' : ''}`}
                            </title>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// Anchor Colors
const GENRE_COLORS = {
    'pop': '#1DB954',
    'rock': '#e11d48',
    'hip hop': '#3b82f6',
    'rap': '#8b5cf6',
    'indie': '#f59e0b',
    'jazz': '#14b8a6',
    'classical': '#10b981',
    'electronic': '#ec4899',
    'altele': '#6b7280',
    'metal': '#b91c1c',
    'house': '#6366f1',
    'techno': '#a855f7',
    'r&b': '#d946ef',
    'dance': '#ff007f',
};

function getGenreColor(genreName) {
    const cleaned = genreName.toLowerCase().trim();
    if (GENRE_COLORS[cleaned]) return GENRE_COLORS[cleaned];
    // Hash function to choose color stably
    let hash = 0;
    for (let i = 0; i < cleaned.length; i++) {
        hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#14b8a6', '#06b6d4', '#f43f5e', '#a855f7'
    ];
    return colors[Math.abs(hash) % colors.length];
}

// Story card configuration based on card.type
const getCardMeta = (type) => {
    switch (type) {
        case 'MOST_DIVERSE_YEAR':
            return { icon: '🎨', title: 'Anul Cel Mai Divers', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)' };
        case 'MOST_LOYAL_YEAR':
            return { icon: '🤝', title: 'Cel Mai Fidel An', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' };
        case 'ANCHOR_GENRE':
            return { icon: '⚓', title: 'Genul-Ancoră', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)' };
        case 'METEOR_GENRE':
            return { icon: '☄️', title: 'Genul-Meteor', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)' };
        case 'TURNING_POINT':
            return { icon: '⚡', title: 'Punct de Cotitură', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' };
        case 'MOST_STABLE_YEAR':
            return { icon: '🛡️', title: 'Cel Mai Stabil An', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.08)', border: 'rgba(20, 184, 166, 0.2)' };
        case 'MOST_EXPLORATORY_YEAR':
            return { icon: '🧭', title: 'Cel Mai Exploratoriu An', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)' };
        case 'FUTURE_DIRECTION':
            return { icon: '🔮', title: 'Direcția Viitoare', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)' };
        case 'NOCTURNAL_GENRE':
            return { icon: '🌙', title: 'Genul Nocturn', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.08)', border: 'rgba(129, 140, 248, 0.2)' };
        case 'RED_THREAD_TRACK':
            return { icon: '🧵', title: 'Melodia Fir-Roșu', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.2)' };
        default:
            return { icon: '🎵', title: 'Muzica Mea', color: '#1DB954', bg: 'rgba(29, 185, 84, 0.08)', border: 'rgba(29, 185, 84, 0.2)' };
    }
};

function TasteEvolutionPage() {
    const [evolution, setEvolution] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const activeUserId = localStorage.getItem('userId');

    useEffect(() => {
        async function loadEvolution() {
            if (!activeUserId) {
                setError('Nu am găsit niciun utilizator autentificat.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError('');
                const data = await getTasteEvolution(activeUserId);
                setEvolution(data);
            } catch (err) {
                setError('Evoluția gusturilor nu a putut fi încărcată.');
            } finally {
                setLoading(false);
            }
        }

        loadEvolution();
    }, [activeUserId]);

    if (loading) {
        return (
            <div className="all-time-section">
                <h2>Taste Evolution</h2>
                <p className="empty-stats-message">Analizăm evoluția gusturilor tale muzicale...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="all-time-section">
                <h2>Taste Evolution</h2>
                <p className="empty-stats-message" style={{ color: '#ef4444' }}>{error}</p>
            </div>
        );
    }

    if (!evolution || !evolution.hasEnoughData) {
        return (
            <div className="all-time-section">
                <h2>Taste Evolution</h2>
                <div className="all-time-panel" style={{ padding: '32px', textAlign: 'center' }}>
                    <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>🧭</span>
                    <h3>Date Insuficiente</h3>
                    <p style={{ color: '#aeb3c5', maxWidth: '600px', margin: '12px auto 0', lineHeight: '1.6' }}>
                        {evolution?.message || 'Evoluția gusturilor tale muzicale necesită mai multe audiții de-a lungul timpului. Asigură-te că ai realizat un import complet.'}
                    </p>
                </div>
            </div>
        );
    }

    // Reconstruct months list in chronological order
    const months = [];
    if (evolution.volatility && evolution.volatility.length > 0) {
        months.push(evolution.volatility[0].fromMonth);
        evolution.volatility.forEach(shift => {
            months.push(shift.toMonth);
        });
    } else {
        // Fallback if volatility is somehow empty
        months.push(evolution.firstMonth);
    }

    return (
        <div className="all-time-section" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="all-time-header">
                <div>
                    <h2>Taste Evolution Analysis</h2>
                    <p>Analiza detaliată a modului în care preferințele tale muzicale s-au schimbat de-a lungul celor {evolution.monthsCount} luni ({months[0]} → {months[months.length - 1]}).</p>
                </div>
            </div>

            {/* STREAM GRAPH PANEL */}
            <div className="all-time-panel" style={{ padding: '24px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <h3 style={{ margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>Fluxul Genurilor Muzicale (D3 Stream Graph)</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#a8a8b8' }}>
                    Reprezentarea dinamică a proporției de audiții lunare pentru fiecare gen. Mișcă mouse-ul peste fluxuri pentru a vedea detaliile din fiecare lună.
                </p>
                
                <StreamGraph 
                    streams={evolution.streams} 
                    months={months} 
                    colorScale={getGenreColor} 
                />

                {/* Genre Stream Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center', marginTop: '24px' }}>
                    {evolution.streams.map((stream, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getGenreColor(stream.genreName) }}></span>
                            <span style={{ color: '#fff' }}>{stream.genreName}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* VOLATILITY PANEL */}
            <div className="all-time-panel" style={{ padding: '24px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <h3 style={{ margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>Volatilitatea Gusturilor (Distanța Cosine consecutivă)</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#a8a8b8' }}>
                    Măsura distanței matematice (1 - Cosine Similarity) dintre două luni consecutive. Punctele roșii marchează momentele de viraj brusc în ascultare (outliers care depășesc pragul de detecție statistică).
                </p>

                <VolatilityChart 
                    volatility={evolution.volatility} 
                    months={months} 
                />
            </div>

            {/* STORY CARDS GRID */}
            <div>
                <h3 style={{ margin: '0 0 16px', fontFamily: "'Outfit', sans-serif", fontSize: '20px' }}>Reperele Călătoriei Tale Muzicale</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {evolution.cards.map((card, idx) => {
                        const meta = getCardMeta(card.type);
                        return (
                            <div 
                                key={idx} 
                                style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid rgba(255, 255, 255, 0.05)`,
                                    borderRadius: '20px',
                                    padding: '24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                className="story-card"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.borderColor = meta.color;
                                    e.currentTarget.style.boxShadow = `0 10px 24px rgba(0, 0, 0, 0.3)`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Background glow accent */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    right: '-20px',
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: meta.color,
                                    filter: 'blur(35px)',
                                    opacity: 0.1,
                                    pointerEvents: 'none'
                                }} />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ 
                                        fontSize: '20px', 
                                        width: '40px', 
                                        height: '40px', 
                                        borderRadius: '12px',
                                        background: meta.bg, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        border: `1px solid ${meta.border}`
                                    }}>
                                        {meta.icon}
                                    </span>
                                    <strong style={{ color: '#aeb3c5', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        {meta.title}
                                    </strong>
                                </div>

                                <div>
                                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#fff', fontFamily: "'Outfit', sans-serif", marginBottom: '8px' }}>
                                        {card.value}
                                    </div>
                                    <p style={{ fontSize: '13.5px', color: '#c7c7d1', lineHeight: '1.5', margin: 0 }}>
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* GENRE PROJECTIONS PANEL */}
            {evolution.projections && evolution.projections.length > 0 && (
                <div className="all-time-panel" style={{ padding: '24px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <h3 style={{ margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>Direcții de Creștere & Proiecții (Regresie Liniară Ponderată - WLS)</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#a8a8b8' }}>
                        Genurile cu pantă de creștere pozitivă (m &gt; 0) în ultimele 6 luni, calculate prin modelul de regresie ponderată exponențial (Weighted Least Squares - WLS) care prioritizează redările recente. Acest set reprezintă baza algoritmului de Discovery (content-based fallback).
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                        {evolution.projections.map((p, idx) => (
                            <div key={idx} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{p.genreName}</span>
                                    <span style={{ 
                                        fontSize: '10px', 
                                        fontWeight: '800', 
                                        padding: '2px 6px', 
                                        borderRadius: '6px', 
                                        background: p.confidenceLabel === 'HIGH' ? 'rgba(29, 185, 84, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                        color: p.confidenceLabel === 'HIGH' ? '#1db954' : '#f59e0b'
                                    }}>
                                        {p.confidenceLabel}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '11px', color: '#aeb3c5' }}>Pantă (m)</span>
                                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1db954' }}>+{p.slope.toFixed(3)} plays/lună</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '11px', color: '#aeb3c5' }}>Coeficient R²</span>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{p.rSquared.toFixed(3)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TasteEvolutionPage;
