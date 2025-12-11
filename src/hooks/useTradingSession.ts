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
    originalEntryPrice: number;
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
        // Get previous candle for slope check
        const prevCandle = currentData.length > 1 ? currentData[currentData.length - 2] : null;

        const fastSMA = lastCandle.fastSMA;
        const slowSMA = lastCandle.slowSMA;

        // Ensure we have data
        if (!fastSMA || !slowSMA) return;

        setState(prev => {
            let newTrades = [...prev.trades];
            let newBalance = prev.balance;

            // 1. Update PnL, Check Exits, and Scale Trades
            const activeTrades: Trade[] = []; // Collect active (or updated) trades here

            for (const trade of newTrades) {
                let isActive = true;
                let updatedTrade = { ...trade };

                // Check Stop Loss (Use LOW of candle to ensure we trigger on intra-candle drops)
                const candleLow = currentData.length > 0 ? currentData[currentData.length - 1].low : currentPrice;

                // Stop Loss Priority
                if (candleLow <= trade.stopLoss) {
                    const exitValue = trade.quantity * trade.stopLoss; // Executed at SL
                    newBalance += exitValue;
                    isActive = false;
                }
                // Check Take Profit (Price rises above TP) -> SCALING
                // Use CURRENT PRICE for TP scaling to prevent infinite loops from persistent candle highs
                else if (currentPrice >= trade.takeProfit) {
                    const oldTP = trade.takeProfit;

                    // New Entry becomes the old TP
                    const newEntry = oldTP;

                    // New Stop Loss = 0.99 of New Entry (1% Risk)
                    const newSL = newEntry * 0.99;

                    // New Take Profit = 1.01 of New Entry (1% Reward)
                    const newTP = newEntry * 1.01;

                    updatedTrade = {
                        ...updatedTrade,
                        entryPrice: newEntry,
                        stopLoss: newSL,
                        takeProfit: newTP,
                        originalEntryPrice: trade.originalEntryPrice // Explicitly preserve
                    };
                    // Trade remains active with new levels
                }

                if (isActive) {
                    activeTrades.push(updatedTrade);
                }
            }

            // 2. Check Buy Condition
            const spread = fastSMA - slowSMA;
            const totalExposure = activeTrades.reduce((acc, t) => acc + t.amount, 0);
            const maxExposure = prev.equity * 0.8;

            // Check if FastSMA is sloping up (Current > Previous)
            // If prevFastSMA is missing (start of chart), default to true or skip
            const prevFastSMA = prevCandle?.fastSMA;
            const isFastUpward = prevFastSMA ? fastSMA > prevFastSMA : false;

            // Only buy if Fast > Slow (Uptrend) AND FastSMA is increasing AND we have room
            if (spread > 0 && totalExposure < maxExposure && currentPrice > slowSMA && isFastUpward) {
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
                        // SL = 0.99 of Entry (1% Risk)
                        // TP = 1.01 of Entry (1% Reward)
                        const stopLoss = currentPrice * 0.99;
                        const takeProfit = currentPrice * 1.01;

                        activeTrades.push({
                            id: Math.random().toString(36).substr(2, 9),
                            symbol: currentTicker.symbol,
                            entryPrice: currentPrice,
                            amount: proposedTradeAmount,
                            quantity: proposedTradeAmount / currentPrice,
                            entryTime: Date.now(),
                            pnl: 0,
                            stopLoss,
                            takeProfit,
                            originalEntryPrice: currentPrice
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
