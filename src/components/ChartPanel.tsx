import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, type IChartApi, type Time } from 'lightweight-charts';
import { getKlines } from '../services/api';
import { enrichWithSMA } from '../utils/indicators';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import '../App.css';

interface ChartPanelProps {
    symbol: string;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ symbol }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [loading, setLoading] = useState(false);

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

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        const fastSMASeries = chart.addSeries(LineSeries, {
            color: '#facc15',
            lineWidth: 2,
            title: 'Fast SMA (7)',
        });

        const slowSMASeries = chart.addSeries(LineSeries, {
            color: '#22d3ee',
            lineWidth: 2,
            title: 'Slow SMA (25)',
        });

        const fetchData = async () => {
            setLoading(true);
            const klines = await getKlines(symbol, '1h', 200);
            const enriched = enrichWithSMA(klines);

            const candleData = enriched.map(d => ({
                time: (d.openTime / 1000) as Time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));

            const fastSMAData = enriched
                .filter(d => d.fastSMA !== null)
                .map(d => ({
                    time: (d.openTime / 1000) as Time,
                    value: d.fastSMA!,
                }));

            const slowSMAData = enriched
                .filter(d => d.slowSMA !== null)
                .map(d => ({
                    time: (d.openTime / 1000) as Time,
                    value: d.slowSMA!,
                }));

            candlestickSeries.setData(candleData);
            fastSMASeries.setData(fastSMAData);
            slowSMASeries.setData(slowSMAData);

            chart.timeScale().fitContent();
            setLoading(false);
        };

        fetchData();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol]);

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
