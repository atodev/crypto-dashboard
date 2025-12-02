import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Ticker } from '../services/api';
import '../App.css';

interface CryptoCardProps {
    ticker: Ticker;
    isSelected: boolean;
    onClick: () => void;
}

export const CryptoCard: React.FC<CryptoCardProps> = ({ ticker, isSelected, onClick }) => {
    const isPositive = parseFloat(ticker.priceChangePercent) >= 0;

    return (
        <motion.div
            layout
            onClick={onClick}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className={`crypto-card ${isSelected ? 'crypto-card--selected' : ''}`}
        >
            <div className="crypto-card__header">
                <div className="crypto-card__symbol">
                    <h3>{ticker.symbol.replace('USDT', '')}</h3>
                    <span>USDT</span>
                </div>
                <div className={`crypto-card__change ${isPositive ? 'crypto-card__change--positive' : 'crypto-card__change--negative'}`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {parseFloat(ticker.priceChangePercent).toFixed(2)}%
                </div>
            </div>

            <div className="crypto-card__body">
                <p className="crypto-card__price">
                    ${parseFloat(ticker.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </p>
                <p className="crypto-card__volume">
                    Vol: ${(parseFloat(ticker.volume) / 1000000).toFixed(2)}M
                </p>
            </div>

            {/* Decorative background glow */}
            <div
                className="crypto-card__glow"
                style={{ backgroundColor: isPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}
            />
        </motion.div>
    );
};
