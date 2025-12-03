import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, type IChartApi, type Time, type ISeriesApi } from 'lightweight-charts';
import type { ChartData } from '../utils/indicators';
import type { Trade } from '../hooks/useTradingSession';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
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
    const fastSMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const slowSMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const tpLineRef = useRef<any>(null);
    const slLineRef = useRef<any>(null);

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
            title: 'Fast SMA (7)',
        });

        slowSMASeriesRef.current = chart.addSeries(LineSeries, {
            color: '#22d3ee',
            lineWidth: 2,
            title: 'Slow SMA (25)',
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

        chartRef.current.timeScale().fitContent();

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

        if (activeTrade) {
            tpLineRef.current = candlestickSeriesRef.current.createPriceLine({
                price: activeTrade.takeProfit,
                color: '#34d399',
                lineWidth: 2,
                lineStyle: 0, // Solid
                axisLabelVisible: true,
                title: 'Take Profit',
            });

            slLineRef.current = candlestickSeriesRef.current.createPriceLine({
                price: activeTrade.stopLoss,
                color: '#ef4444',
                lineWidth: 2,
                lineStyle: 0, // Solid
                axisLabelVisible: true,
                title: 'Stop Loss',
            });
        }
    }, [activeTrade]);

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
                            </>
                        )}
                    </div>
                </div>
            </div>

            <motion.div
                layout
                className="chart-panel__container"
                style={{ padding: 0, display: 'flex', flexDirection: 'column' }}
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
                <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />
            </motion.div>
        </div>
    );
};
