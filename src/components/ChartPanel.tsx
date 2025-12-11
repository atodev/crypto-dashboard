import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, type IChartApi, type Time, type ISeriesApi } from 'lightweight-charts';
import type { ChartData } from '../utils/indicators';
import type { Trade } from '../hooks/useTradingSession';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, DollarSign } from 'lucide-react';
import '../App.css';

interface ChartPanelProps {
    symbol: string;
    data: ChartData[];
    loading: boolean;
    activeTrade?: Trade;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ symbol, data, loading, activeTrade }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const activeTradeRef = useRef<Trade | undefined>(activeTrade);

    useEffect(() => {
        activeTradeRef.current = activeTrade;
        if (candlestickSeriesRef.current) {
            if (activeTradeRef.current) {
                console.log('ChartPanel Update: ', {
                    id: activeTradeRef.current.id,
                    entry: activeTradeRef.current.entryPrice,
                    originalEntry: activeTradeRef.current.originalEntryPrice,
                    tp: activeTradeRef.current.takeProfit
                });
            }
            candlestickSeriesRef.current.applyOptions({
                autoscaleInfoProvider: (original: any) => {
                    if (!activeTradeRef.current || !original.priceRange) return null;

                    const { takeProfit, stopLoss, entryPrice } = activeTradeRef.current;

                    // Start with the tightest band: Stop Loss and Take Profit
                    let tradeMin = stopLoss;
                    let tradeMax = takeProfit;

                    if (entryPrice) {
                        tradeMin = Math.min(tradeMin, entryPrice);
                        tradeMax = Math.max(tradeMax, entryPrice);
                    }
                    // For "Original Entry", we DO NOT want to zoom out to it if it's far away.
                    // The user wants to see the CURRENT band expanded.
                    // But if we exclude it, we might lose context.
                    // However, request is "band takes up a third".
                    // The "Band" is SL to TP.

                    const bandHeight = tradeMax - tradeMin;

                    // Total screen height should correspond to 3 * bandHeight (1/3 for band, 1/3 top, 1/3 bottom).
                    const padding = bandHeight;

                    return {
                        priceRange: {
                            minValue: tradeMin - padding,
                            maxValue: tradeMax + padding,
                        },
                    };
                }
            });
        }
    }, [activeTrade]);
    const fastSMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const slowSMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const tpLineRef = useRef<any>(null);
    const slLineRef = useRef<any>(null);
    const profitBandRef = useRef<HTMLDivElement>(null);
    const lossBandRef = useRef<HTMLDivElement>(null);
    const originalEntryLineRef = useRef<any>(null);
    const [showTpEffect, setShowTpEffect] = useState(false);
    const prevEntryPriceRef = useRef<number | null>(null);

    // Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
                horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                borderColor: 'rgba(148, 163, 184, 0.1)',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: 'rgba(148, 163, 184, 0.1)',
            },
        });

        chartRef.current = chart;

        candlestickSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        fastSMASeriesRef.current = chart.addSeries(LineSeries, {
            color: '#facc15',
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        slowSMASeriesRef.current = chart.addSeries(LineSeries, {
            color: '#22d3ee',
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []); // Run once on mount

    // Update Data
    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;

        const candleData = data.map(d => ({
            time: (d.openTime / 1000) as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        const fastSMAData = data
            .filter(d => d.fastSMA !== null)
            .map(d => ({
                time: (d.openTime / 1000) as Time,
                value: d.fastSMA!,
            }));

        const slowSMAData = data
            .filter(d => d.slowSMA !== null)
            .map(d => ({
                time: (d.openTime / 1000) as Time,
                value: d.slowSMA!,
            }));

        candlestickSeriesRef.current?.setData(candleData);
        fastSMASeriesRef.current?.setData(fastSMAData);
        slowSMASeriesRef.current?.setData(slowSMAData);

        if (candleData.length > 0) {
            const lastTime = candleData[candleData.length - 1].time as number;
            const twentyFourHours = 24 * 60 * 60;
            const fromTime = (lastTime - twentyFourHours) as Time;

            chartRef.current.timeScale().setVisibleRange({
                from: fromTime,
                to: lastTime as Time
            });
        }

    }, [data, symbol]);

    // Update Active Trade Lines
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        // Clear existing lines
        if (tpLineRef.current) {
            candlestickSeriesRef.current.removePriceLine(tpLineRef.current);
            tpLineRef.current = null;
        }
        if (slLineRef.current) {
            candlestickSeriesRef.current.removePriceLine(slLineRef.current);
            slLineRef.current = null;
        }
        if (originalEntryLineRef.current) {
            candlestickSeriesRef.current.removePriceLine(originalEntryLineRef.current);
            originalEntryLineRef.current = null;
        }

        if (activeTrade) {
            tpLineRef.current = candlestickSeriesRef.current.createPriceLine({
                price: activeTrade.takeProfit,
                color: 'rgba(0,0,0,0)', // Transparent, showing band edge instead
                lineWidth: 1,
                lineStyle: 0,
                axisLabelVisible: false,
                title: '',
            });

            slLineRef.current = candlestickSeriesRef.current.createPriceLine({
                price: activeTrade.stopLoss,
                color: 'rgba(0,0,0,0)',
                lineWidth: 1,
                lineStyle: 0,
                axisLabelVisible: false,
                title: '',
            });

            // Draw Broad Dashed Line for Original Entry
            if (activeTrade.originalEntryPrice) {
                originalEntryLineRef.current = candlestickSeriesRef.current.createPriceLine({
                    price: activeTrade.originalEntryPrice,
                    color: '#94a3b8', // Slate 400
                    lineWidth: 3,     // Broad
                    lineStyle: 2,     // Dashed
                    axisLabelVisible: false,
                    title: '',
                });
            }

            // Check for Scaling Event (TP Hit)
            if (prevEntryPriceRef.current !== null && activeTrade.entryPrice > prevEntryPriceRef.current) {
                // Play Sound
                try {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContext) {
                        const ctx = new AudioContext();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();

                        osc.connect(gain);
                        gain.connect(ctx.destination);

                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
                        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Swipe up

                        gain.gain.setValueAtTime(0.3, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

                        osc.start();
                        osc.stop(ctx.currentTime + 0.5);
                    }
                } catch (e) {
                    console.error("Audio play failed", e);
                }

                // Show Icon Effect
                setShowTpEffect(true);
                setTimeout(() => setShowTpEffect(false), 2000);
            }
            prevEntryPriceRef.current = activeTrade.entryPrice;

        } else {
            // Hide bands if no active trade
            if (profitBandRef.current) profitBandRef.current.style.display = 'none';
            if (lossBandRef.current) lossBandRef.current.style.display = 'none';
            prevEntryPriceRef.current = null;
        }
    }, [activeTrade]);

    // Update Bands Position
    const updateBands = useCallback(() => {
        if (!candlestickSeriesRef.current || !activeTrade || !profitBandRef.current || !lossBandRef.current) {
            return;
        }

        const series = candlestickSeriesRef.current;
        const entryPrice = activeTrade.entryPrice;
        const tpPrice = activeTrade.takeProfit;
        const slPrice = activeTrade.stopLoss;

        // Recalculate coordinates inside the update to ensure freshness
        if (profitBandRef.current) {
            const tpY = series.priceToCoordinate(tpPrice);
            const entryY = series.priceToCoordinate(entryPrice);
            if (tpY !== null && entryY !== null) {
                const top = Math.min(tpY, entryY);
                const height = Math.abs(tpY - entryY);
                profitBandRef.current.style.display = 'block';
                profitBandRef.current.style.top = `${top}px`;
                profitBandRef.current.style.height = `${height}px`;
            } else {
                profitBandRef.current.style.display = 'none';
            }
        }

        if (lossBandRef.current) {
            const slY = series.priceToCoordinate(slPrice);
            const entryY = series.priceToCoordinate(entryPrice);
            if (slY !== null && entryY !== null) {
                const top = Math.min(slY, entryY);
                const height = Math.abs(slY - entryY);
                lossBandRef.current.style.display = 'block';
                lossBandRef.current.style.top = `${top}px`;
                lossBandRef.current.style.height = `${height}px`;
            } else {
                lossBandRef.current.style.display = 'none';
            }
        }
    }, [activeTrade]);

    // Subscribe to chart updates for band syncing
    useEffect(() => {
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const handleChartUpdate = () => {
            requestAnimationFrame(updateBands);
        };

        chart.timeScale().subscribeVisibleTimeRangeChange(handleChartUpdate);

        // Initial update
        // We also need to update when data loads or trade changes, which changes dependencies
        // But activeTrade change also triggers the other effect? No, updateBands deps on activeTrade.
        // We should call updateBands regularly or when things change.
        setTimeout(updateBands, 50);

        return () => {
            chart.timeScale().unsubscribeVisibleTimeRangeChange(handleChartUpdate);
        };
    }, [updateBands, data]);

    // Trigger update when activeTrade changes
    useEffect(() => {
        if (activeTrade) {
            // Small delay to ensure chart rendered trade
            requestAnimationFrame(updateBands);
        }
    }, [activeTrade, updateBands]);

    return (
        <div className="chart-panel">
            <div className="chart-panel__header">
                <div className="chart-panel__icon">
                    <Activity size={24} />
                </div>
                <div className="chart-panel__title">
                    <h2>{symbol.replace('USDT', '')} Analysis</h2>
                    <div className="chart-panel__legend">
                        <span className="legend-item">
                            <div className="legend-dot" style={{ backgroundColor: '#facc15' }} /> Fast SMA (7)
                        </span>
                        <span className="legend-item">
                            <div className="legend-dot" style={{ backgroundColor: '#22d3ee' }} /> Slow SMA (25)
                        </span>
                        {activeTrade && (
                            <>
                                <span className="legend-item">
                                    <div className="legend-dot" style={{ backgroundColor: '#34d399' }} /> TP
                                </span>
                                <span className="legend-item">
                                    <div className="legend-dot" style={{ backgroundColor: '#ef4444' }} /> SL
                                </span>
                                {activeTrade.originalEntryPrice && (
                                    <span className="legend-item">
                                        <div className="legend-dot" style={{ backgroundColor: '#94a3b8' }} /> Entry
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <motion.div
                layout
                className="chart-panel__container"
                style={{ padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
            >
                <AnimatePresence mode="wait">
                    {loading && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="chart-loading"
                            style={{ zIndex: 10, background: 'rgba(15, 23, 42, 0.5)' }}
                        >
                            <div className="spinner" />
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }} />

                {/* Bands Overlay - Placed AFTER chart container but absolute positioned? 
                    Actually ChartJS/Lightweight renders into the div. 
                    If we put overlay INSIDE chartContainerRef, library might remove it.
                    Better to put it separate.
                */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    {/* Profit Band */}
                    <div
                        ref={profitBandRef}
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green 500 equivalent with opacity
                            display: 'none',
                        }}
                    />

                    {/* Loss Band */}
                    <div
                        ref={lossBandRef}
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(239, 68, 68, 0.2)', // Red 500 equivalent with opacity
                            display: 'none',
                        }}
                    />
                </div>

                <AnimatePresence>
                    {showTpEffect && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, y: 0 }}
                            animate={{ opacity: 1, scale: 1.5, y: -50 }}
                            exit={{ opacity: 0 }}
                            className="tp-effect"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'none',
                                zIndex: 100,
                                color: '#34d399',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textShadow: '0 0 20px rgba(52, 211, 153, 0.5)'
                            }}
                        >
                            <DollarSign size={80} strokeWidth={3} />
                            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px' }}>SCALED UP!</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
