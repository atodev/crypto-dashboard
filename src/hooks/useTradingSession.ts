import { useState, useEffect, useCallback, useRef } from 'react';
import { Ticker } from '../services/api';
import { ChartData } from '../utils/indicators';

export interface Trade {
    id: string;
    symbol: string;
    entryPrice: number;
    amount: number; // In USDT
    quantity: number; // Amount / EntryPrice
    entryTime: number;
    pnl: number;
}

export interface TradingState {
    isActive: boolean;
    startTime: number | null;
    balance: number; // Cash available
    equity: number; // Cash + Unrealized PnL
    initialBalance: number;
    trades: Trade[];
}

export const useTradingSession = (
    currentTicker: Ticker | null,
    currentData: ChartData[]
) => {
    const [state, setState] = useState<TradingState>({
        isActive: false,
        startTime: null,
        balance: 50.00,
        equity: 50.00,
        initialBalance: 50.00,
        trades: []
    });

    const lastProcessedTimeRef = useRef<number>(0);

    const startSession = () => {
        setState(prev => ({
            ...prev,
            isActive: true,
            startTime: Date.now(),
            balance: 50.00,
            equity: 50.00,
            trades: []
        }));
    };

    const stopSession = () => {
        // Close all trades
        setState(prev => {
            const currentPrice = currentTicker ? parseFloat(currentTicker.lastPrice) : 0;
            const totalPnL = prev.trades.reduce((acc, trade) => {
                const tradeValue = trade.quantity * currentPrice;
                return acc + (tradeValue - trade.amount);
            }, 0);

            return {
                ...prev,
                isActive: false,
                startTime: null,
                balance: prev.balance + prev.trades.reduce((acc, t) => acc + t.amount, 0) + totalPnL,
                trades: []
            };
        });
    };

    useEffect(() => {
        if (!state.isActive || !currentTicker || currentData.length === 0) return;

        const currentPrice = parseFloat(currentTicker.lastPrice);
        const lastCandle = currentData[currentData.length - 1];

        // Only process once per candle update or significant price change to avoid spamming
        // For simulation, we'll run on every update but throttle trade entry

        const fastSMA = lastCandle.fastSMA;
        const slowSMA = lastCandle.slowSMA;

        if (!fastSMA || !slowSMA) return;

        setState(prev => {
            let newTrades = [...prev.trades];
            let newBalance = prev.balance;

            // 1. Update PnL for existing trades and Check Stop Loss
            // Stop Loss: "Trailing stop loss set at the tokens sell line" -> Interpreting as Slow SMA
            const activeTrades = newTrades.filter(trade => {
                const currentValue = trade.quantity * currentPrice;
                // Check exit condition: Price drops below Slow SMA
                if (currentPrice < slowSMA) {
                    newBalance += currentValue; // Sell and return to balance
                    return false; // Remove from active trades
                }
                return true;
            });

            // 2. Check Buy Condition
            // "Trade with an amount that corresponds with the split between the fast and slow moving average"
            // Only buy if Fast > Slow (Uptrend)
            const spread = fastSMA - slowSMA;
            const totalExposure = activeTrades.reduce((acc, t) => acc + t.amount, 0);
            const maxExposure = prev.equity * 0.8;

            if (spread > 0 && totalExposure < maxExposure) {
                // Calculate trade size based on spread strength
                // Heuristic: (Spread / Price) * 1000 * BaseUnit? 
                // Let's make it proportional: 
                // If spread is 1% of price, invest $10?
                const spreadPct = spread / currentPrice;
                const proposedTradeAmount = Math.min(
                    newBalance,
                    (maxExposure - totalExposure),
                    50 * (spreadPct * 10) // Dynamic sizing: 1% spread -> $5 trade
                );

                // Minimum trade size filter to avoid dust
                if (proposedTradeAmount > 1) {
                    // Check if we already have a recent trade to avoid stacking too closely?
                    // For now, simple logic: if we have funds and spread is good, add to position
                    // Limit max trades to avoid over-fragmentation
                    if (activeTrades.length < 5) {
                        activeTrades.push({
                            id: Math.random().toString(36).substr(2, 9),
                            symbol: currentTicker.symbol,
                            entryPrice: currentPrice,
                            amount: proposedTradeAmount,
                            quantity: proposedTradeAmount / currentPrice,
                            entryTime: Date.now(),
                            pnl: 0
                        });
                        newBalance -= proposedTradeAmount;
                    }
                }
            }

            // Recalculate Equity
            const currentEquity = newBalance + activeTrades.reduce((acc, t) => {
                return acc + (t.quantity * currentPrice);
            }, 0);

            // Update PnL on trades for display
            const updatedTrades = activeTrades.map(t => ({
                ...t,
                pnl: (t.quantity * currentPrice) - t.amount
            }));

            return {
                ...prev,
                balance: newBalance,
                trades: updatedTrades,
                equity: currentEquity
            };
        });

    }, [currentTicker, currentData]); // Dependency on ticker updates

    return {
        ...state,
        startSession,
        stopSession
    };
};
