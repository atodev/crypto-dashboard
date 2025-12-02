import React, { useEffect, useState } from 'react';
import { Play, Square, Timer, DollarSign, TrendingUp } from 'lucide-react';
import { TradingState } from '../hooks/useTradingSession';
import { motion } from 'framer-motion';
import '../App.css';

interface TradingPanelProps {
    state: TradingState;
    onStart: () => void;
    onStop: () => void;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({ state, onStart, onStop }) => {
    const [duration, setDuration] = useState<string>('00:00:00');

    useEffect(() => {
        if (!state.isActive || !state.startTime) {
            setDuration('00:00:00');
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = now - state.startTime!;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setDuration(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [state.isActive, state.startTime]);

    const totalPnL = state.equity - state.initialBalance;
    const isPositive = totalPnL >= 0;

    return (
        <div className="trading-panel">
            <div className="trading-panel__header">
                <h2>Session Manager</h2>
                <div className={`status-indicator ${state.isActive ? 'active' : 'inactive'}`}>
                    {state.isActive ? 'LIVE' : 'OFFLINE'}
                </div>
            </div>

            <div className="trading-stats">
                <div className="stat-card">
                    <div className="stat-icon">
                        <Timer size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Duration</span>
                        <span className="stat-value font-mono">{duration}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Equity</span>
                        <span className="stat-value">${state.equity.toFixed(2)}</span>
                    </div>
                </div>

                <div className={`stat-card ${isPositive ? 'positive' : 'negative'}`}>
                    <div className="stat-icon">
                        <TrendingUp size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Session PnL</span>
                        <span className="stat-value">
                            {isPositive ? '+' : ''}{totalPnL.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="active-trades">
                <h3>Active Trades ({state.trades.length})</h3>
                <div className="trades-list">
                    {state.trades.length === 0 ? (
                        <div className="no-trades">No active trades</div>
                    ) : (
                        state.trades.map(trade => (
                            <motion.div
                                key={trade.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="trade-item"
                            >
                                <div className="trade-info">
                                    <span className="trade-amt">${trade.amount.toFixed(2)}</span>
                                    <span className="trade-price">@ {trade.entryPrice.toFixed(4)}</span>
                                </div>
                                <div className={`trade-pnl ${trade.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            <div className="trading-controls">
                {!state.isActive ? (
                    <button className="btn-start" onClick={onStart}>
                        <Play size={18} fill="currentColor" /> Start Session
                    </button>
                ) : (
                    <button className="btn-stop" onClick={onStop}>
                        <Square size={18} fill="currentColor" /> Stop Session
                    </button>
                )}
            </div>
        </div>
    );
};
