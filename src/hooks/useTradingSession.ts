import { useState, useEffect } from 'react';
import type { Ticker } from '../services/api';
import type { ChartData } from '../utils/indicators';

export interface Trade {
    id: string;
    symbol: string;
    entryPrice: number;
    amount: number; // In USDT
    quantity: number; // Amount / EntryPrice
    entryTime: number;
    pnl: number;
    stopLoss: number;
    takeProfit: number;
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

        const fastSMA = lastCandle.fastSMA;
        const slowSMA = lastCandle.slowSMA;

        if (!fastSMA || !slowSMA) return;

        setState(prev => {
            let newTrades = [...prev.trades];
            let newBalance = prev.balance;

            // 1. Update PnL and Check Exits (Stop Loss / Take Profit)
            const activeTrades = newTrades.filter(trade => {
                // Check Stop Loss (Price drops below SL)
                if (currentPrice <= trade.stopLoss) {
                    const exitValue = trade.quantity * trade.stopLoss; // Executed at SL
                    newBalance += exitValue;
                    return false;
                }
                // Check Take Profit (Price rises above TP)
                if (currentPrice >= trade.takeProfit) {
                    const exitValue = trade.quantity * trade.takeProfit; // Executed at TP
                    newBalance += exitValue;
                    return false;
                }
                return true;
            });

            // 2. Check Buy Condition
            const spread = fastSMA - slowSMA;
            const totalExposure = activeTrades.reduce((acc, t) => acc + t.amount, 0);
            const maxExposure = prev.equity * 0.8;

            // Only buy if Fast > Slow (Uptrend) and we have room
            if (spread > 0 && totalExposure < maxExposure) {
                const spreadPct = spread / currentPrice;
                const proposedTradeAmount = Math.min(
                    newBalance,
                    (maxExposure - totalExposure),
                    50 * (spreadPct * 10)
                );

                if (proposedTradeAmount > 1) {
                    // Limit max trades per symbol to avoid stacking too closely
                    const symbolTrades = activeTrades.filter(t => t.symbol === currentTicker.symbol);

                    if (symbolTrades.length < 1) { // Only 1 active trade per symbol for simplicity
                        // Calculate SL and TP
                        // SL = Slow SMA
                        // TP = Entry + (Entry - SL) * 2 (2:1 Reward Ratio)
                        const stopLoss = slowSMA;
                        const risk = currentPrice - stopLoss;
                        const takeProfit = currentPrice + (risk * 2);

                        activeTrades.push({
                            id: Math.random().toString(36).substr(2, 9),
                            symbol: currentTicker.symbol,
                            entryPrice: currentPrice,
                            amount: proposedTradeAmount,
                            quantity: proposedTradeAmount / currentPrice,
                            entryTime: Date.now(),
                            pnl: 0,
                            stopLoss,
                            takeProfit
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

    }, [currentTicker, currentData]);

    return {
        ...state,
        startSession,
        stopSession
    };
};
