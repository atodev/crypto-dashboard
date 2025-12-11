import { useState, useEffect } from 'react'
import { getTopGainers, getKlines, type Ticker } from './services/api'
import { enrichWithSMA, type ChartData } from './utils/indicators'
import { CryptoCard } from './components/CryptoCard'
import { ChartPanel } from './components/ChartPanel'
import { TradingPanel } from './components/TradingPanel'
import { useTradingSession } from './hooks/useTradingSession'
import { LayoutDashboard, RefreshCw, Rocket } from 'lucide-react'
import { motion } from 'framer-motion'
import './App.css'

function App() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // State for the selected symbol's chart data
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const data = await getTopGainers()
    setTickers(data)

    // If no symbol selected yet, select the top performer
    if (data.length > 0 && !selectedSymbol) {
      setSelectedSymbol(data[0].symbol)
    }
    setLoading(false)
  }

  // Fetch chart data when selected symbol changes
  useEffect(() => {
    const fetchChartData = async () => {
      if (!selectedSymbol) return;
      setChartLoading(true);
      const klines = await getKlines(selectedSymbol, '1h', 200);
      const enriched = enrichWithSMA(klines);
      setChartData(enriched);
      setChartLoading(false);
    };

    fetchChartData();
    // Refresh chart data every 15 seconds (User Requested)
    const interval = setInterval(fetchChartData, 15000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  useEffect(() => {
    fetchData()
    // Auto refresh top gainers every 15 seconds
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  const selectedTicker = tickers.find(t => t.symbol === selectedSymbol) || null;
  const tradingSession = useTradingSession(selectedTicker, chartData);

  // Auto-switch to new trade
  const prevTradeCount = useState(0);
  useEffect(() => {
    if (tradingSession.trades.length > prevTradeCount[0]) {
      // New trade detected! Switch to it.
      const latestTrade = tradingSession.trades[tradingSession.trades.length - 1];
      setSelectedSymbol(latestTrade.symbol);
    }
    prevTradeCount[1](tradingSession.trades.length);
  }, [tradingSession.trades]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header__branding">
          <div className="app-header__icon">
            <LayoutDashboard size={28} />
          </div>
          <div className="app-header__title">
            <h1>
              Crypto<span>Momentum</span>
            </h1>
            <p className="app-header__subtitle">
              <Rocket size={14} color="#34d399" />
              Top 5 Binance Gainers (24h)
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData()}
          className="app-header__refresh"
          title="Refresh Data"
        >
          <RefreshCw size={20} className={loading ? 'spinner' : ''} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </header>

      {loading && tickers.length === 0 ? (
        <div className="loading-screen">
          <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
          <p className="loading-text">Scanning market data...</p>
        </div>
      ) : (
        <>
          <div className="app-grid">
            {tickers.map((ticker, index) => {
              const isTrading = tradingSession.trades.some(t => t.symbol === ticker.symbol);
              return (
                <motion.div
                  key={ticker.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CryptoCard
                    ticker={ticker}
                    isSelected={selectedSymbol === ticker.symbol}
                    isTrading={isTrading}
                    onClick={() => setSelectedSymbol(ticker.symbol)}
                  />
                </motion.div>
              );
            })}
          </div>

          <motion.div
            className="app-content-row"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="app-chart-section">
              {selectedSymbol && (
                <ChartPanel
                  symbol={selectedSymbol}
                  data={chartData}
                  loading={chartLoading}
                  activeTrade={tradingSession.trades.find(t => t.symbol === selectedSymbol)}
                />
              )}
            </div>

            <div className="trading-panel-container">
              <TradingPanel
                state={tradingSession}
                onStart={tradingSession.startSession}
                onStop={tradingSession.stopSession}
              />
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default App
