import axios from 'axios';

const API_URL = 'https://api.binance.com/api/v3';

export interface Ticker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  count: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export const getTopGainers = async (): Promise<Ticker[]> => {
  try {
    const response = await axios.get<any[]>(`${API_URL}/ticker/24hr`);
    // Filter for USDT pairs to keep it clean and sort by percentage change
    // Also filtering out leveraged tokens (UP/DOWN/BULL/BEAR) usually helps quality
    return response.data
      .filter(t => 
        t.symbol.endsWith('USDT') && 
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN') && 
        !t.symbol.includes('BULL') && 
        !t.symbol.includes('BEAR') &&
        parseFloat(t.quoteVolume) > 10000000 // Filter for decent liquidity (10M USDT volume)
      )
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 5)
      .map(t => ({
        ...t,
        lastPrice: t.lastPrice,
        priceChangePercent: t.priceChangePercent
      }));
  } catch (error) {
    console.error("Error fetching top gainers:", error);
    return [];
  }
};

export const getKlines = async (symbol: string, interval: string = '1h', limit: number = 200): Promise<Kline[]> => {
  try {
    const response = await axios.get(`${API_URL}/klines`, {
      params: {
        symbol,
        interval,
        limit
      }
    });
    // Binance returns array of arrays
    // [0: openTime, 1: open, 2: high, 3: low, 4: close, 5: volume, ...]
    return response.data.map((k: any[]) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6]
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
};
