import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Ticker } from '../services/api';
import '../App.css';

interface CryptoCardProps {
    ticker: Ticker;
    isSelected: boolean;
    isTrading?: boolean;
    onClick: () => void;
}

export const CryptoCard: React.FC<CryptoCardProps> = ({ ticker, isSelected, isTrading, onClick }) => {
    const isPositive = parseFloat(ticker.priceChangePercent) >= 0;

    return (
        <div
            className={`crypto-card ${isSelected ? 'crypto-card--selected' : ''}`}
            onClick={onClick}
        >
            {isSelected && <div className="crypto-card__glow" style={{ backgroundColor: isPositive ? '#10b981' : '#ef4444' }} />}

            <div className="crypto-card__header">
                <div className="crypto-card__symbol">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3>{ticker.symbol.replace('USDT', '')}</h3>
                        {isTrading && (
                            <div className="trading-dot-container" title="Active Trade">
                                <div className="trading-dot" />
                                <div className="trading-dot-ring" />
                            </div>
                        )}
                    </div>
                    <span>USDT</span>
                </div>
                <div className={`crypto-card__change ${isPositive ? 'crypto-card__change--positive' : 'crypto-card__change--negative'}`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {parseFloat(ticker.priceChangePercent).toFixed(2)}%
                </div>
            </div>

            <div className="crypto-card__price">
                ${parseFloat(ticker.lastPrice).toFixed(parseFloat(ticker.lastPrice) < 1 ? 4 : 2)}
            </div>

            <div className="crypto-card__volume">
                Vol: ${(parseFloat(ticker.quoteVolume) / 1000000).toFixed(2)}M
            </div>
        </div>
    );
};
