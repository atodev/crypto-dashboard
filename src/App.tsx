import { useState, useEffect } from 'react'
import { getTopGainers, type Ticker } from './services/api'
import { CryptoCard } from './components/CryptoCard'
import { ChartPanel } from './components/ChartPanel'
import { LayoutDashboard, RefreshCw, Rocket } from 'lucide-react'
import { motion } from 'framer-motion'
import './App.css'

function App() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchData()
    // Auto refresh top gainers every 60s
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

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
            {tickers.map((ticker, index) => (
              <motion.div
                key={ticker.symbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <CryptoCard
                  ticker={ticker}
                  isSelected={selectedSymbol === ticker.symbol}
                  onClick={() => setSelectedSymbol(ticker.symbol)}
                />
              </motion.div>
            ))}
          </div>

          <motion.div
            className="app-chart-section"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {selectedSymbol && <ChartPanel symbol={selectedSymbol} />}
          </motion.div>
        </>
      )}
    </div>
  )
}

export default App
