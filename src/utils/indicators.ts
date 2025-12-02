import type { Kline } from '../services/api';

export interface ChartData extends Kline {
    fastSMA: number | null;
    slowSMA: number | null;
}

export const enrichWithSMA = (data: Kline[], fastPeriod: number = 7, slowPeriod: number = 25): ChartData[] => {
    return data.map((item, index) => {
        let fastSMA = null;
        let slowSMA = null;

        if (index >= fastPeriod - 1) {
            const slice = data.slice(index - fastPeriod + 1, index + 1);
            fastSMA = slice.reduce((acc, curr) => acc + curr.close, 0) / fastPeriod;
        }

        if (index >= slowPeriod - 1) {
            const slice = data.slice(index - slowPeriod + 1, index + 1);
            slowSMA = slice.reduce((acc, curr) => acc + curr.close, 0) / slowPeriod;
        }

        return {
            ...item,
            fastSMA,
            slowSMA
        };
    });
};
