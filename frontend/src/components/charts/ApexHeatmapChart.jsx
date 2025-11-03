

import React, { useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';

// Helper function to interpolate between two hex colors
const interpolateColor = (color1, color2, factor) => {
    const clampedFactor = Math.max(0, Math.min(1, factor));
    const hex = (c) => Math.round(c).toString(16).padStart(2, '0');
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = r1 + clampedFactor * (r2 - r1);
    const g = g1 + clampedFactor * (g2 - g1);
    const b = b1 + clampedFactor * (b2 - b1);

    return `#${hex(r)}${hex(g)}${hex(b)}`;
};


const ApexHeatmapChart = ({ data, xAxisKeys, yAxisKey, lowColor, highColor, parameter }) => {

    const { series, chartOptions } = useMemo(() => {
        if (!data || data.length === 0) {
            return { series: [], chartOptions: {} };
        }
        
        const financialMonthMap = {
            '1': 'Apr', '2': 'May', '3': 'Jun', '4': 'Jul', '5': 'Aug', '6': 'Sep',
            '7': 'Oct', '8': 'Nov', '9': 'Dec', '10': 'Jan', '11': 'Feb', '12': 'Mar'
        };
        const financialMonthOrder = xAxisKeys.map(key => financialMonthMap[key] || key);
        
        const originalData = data.map(yearData => 
            xAxisKeys.map(key => yearData[key])
        );

        const transformedSeries = data.map(yearData => {
            const rowValues = Object.values(yearData).filter(v => typeof v === 'number');
            let rowMin, rowMax;
            
            if (parameter && parameter.toLowerCase().includes('load factor')) {
                rowMin = 0.70;
                rowMax = 1.0;
            } else {
                rowMin = Math.min(...rowValues);
                rowMax = Math.max(...rowValues);
            }

            return {
                name: yearData[yAxisKey],
                data: xAxisKeys.map(key => {
                    const value = yearData[key] !== undefined ? yearData[key] : 0;
                    const normalizedValue = (rowMax - rowMin === 0) ? 50 : ((value - rowMin) / (rowMax - rowMin)) * 100;
                    return {
                        x: financialMonthMap[key] || key,
                        y: normalizedValue,
                    };
                })
            };
        }).sort((a, b) => a.name - b.name);
        
        const colorRanges = [];
        const steps = 10;

        for (let i = 0; i < steps; i++) {
            const factor = i / (steps - 1);
            colorRanges.push({
                from: i * (100 / steps),
                to: (i + 1) * (100 / steps),
                color: interpolateColor(lowColor, highColor, factor),
                name: ''
            });
        }
        
        const options = {
            chart: { type: 'heatmap', toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.7,
                    radius: 0,
                    useFillColorAsStroke: true,
                    colorScale: {
                        ranges: colorRanges,
                    },
                }
            },
            dataLabels: {
                enabled: true,
                style: { fontSize: '12px', colors: ["#fff"], textShadow: '0 0 3px #000' },
                // **FIX:** Keep original decimal value and add '%'
                formatter: (val, opts) => {
                    const originalValue = originalData[opts.seriesIndex][opts.dataPointIndex];
                    if (parameter && parameter.toLowerCase().includes('load factor')) {
                        return originalValue.toFixed(2) + '%';
                    }
                    return originalValue.toFixed(0);
                },
            },
            stroke: { width: 0 },
            legend: { show: false },
            xaxis: {
                type: 'category',
                categories: financialMonthOrder,
                labels: { style: { colors: '#475569', fontWeight: 'bold' } },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                labels: { style: { colors: '#475569', fontWeight: 'bold' }, offsetX: -5 }
            },
            tooltip: {
                theme: 'dark',
                // **FIX:** Keep original decimal value and add '%' on hover
                y: {
                    formatter: (val, opts) => {
                         const originalValue = originalData[opts.seriesIndex][opts.dataPointIndex];
                         if (parameter && parameter.toLowerCase().includes('load factor')) {
                            return originalValue.toFixed(2) + ' %';
                         }
                         return originalValue.toFixed(0);
                    }
                }
            },
            grid: { show: false }
        };

        return { series: transformedSeries, chartOptions: options };

    }, [data, xAxisKeys, yAxisKey, lowColor, highColor, parameter]);

    if (!data || data.length === 0) {
        return <div className="text-center text-slate-400 p-4">No data to display.</div>;
    }

    return (
        <div className="chart-container">
            <ReactApexChart options={chartOptions} series={series} type="heatmap" height={350} />
        </div>
    );
};

export default ApexHeatmapChart;