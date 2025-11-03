import React, { useRef } from 'react';
import ReactECharts from 'echarts-for-react';

const LineChartComponent = ({
    data,
    title,
    xKey,
    yKeys,
    colors = [],
    legendLabels = [],
    xAxisLabel,
    yAxisLabel,
    tickStyle,
    unit,
}) => {
    const chartRef = useRef(null);

    if (!data || data.length === 0 || !yKeys || yKeys.length === 0) {
        return (
            <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">No Data Available</h3>
                    <p className="mt-1 text-sm text-slate-500">There is no data to display in the chart.</p>
                </div>
            </div>
        );
    }

    const defaultColors = ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

    const series = yKeys.map((key, index) => ({
        name: legendLabels[index] || key,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        clip: true,
        data: data.map(d => [d[xKey], d[key]]),
        itemStyle: {
            color: colors[index % colors.length] || defaultColors[index % defaultColors.length]
        }
    }));

    const option = {
        title: {
            text: title,
            left: 'center',
            textStyle: {
                color: '#1e293b',
                fontWeight: 'bold',
                fontSize: 18,
            },
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const xValue = params[0].axisValue;
                let tooltipHtml = `<div style="font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">${xKey}: ${xValue}</div>`;
                params.forEach(param => {
                    const color = param.color;
                    const seriesName = param.seriesName;
                    const value = param.value[1];
                    if (value !== undefined && value !== null) {
                        tooltipHtml += `
                            <div style="display: flex; align-items-center; justify-content: space-between; gap: 1rem; padding: 2px 0; color: #334155; font-size: 14px;">
                                <span style="display: flex; align-items: center;">
                                    <span style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px;"></span>
                                    ${seriesName}:
                                </span>
                                <span style="font-weight: 600;">${Number(value).toLocaleString('en-IN')} ${unit || ''}</span>
                            </div>`;
                    }
                });
                return tooltipHtml;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: '#d1d5db',
            borderWidth: 1,
            textStyle: {
                color: '#334155',
            },
            extraCssText: 'backdrop-filter: blur(4px); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);'
        },
        legend: {
            show: false,
        },
        grid: {
            left: '95px',
            right: '4%',
            bottom: '25%', // Increased bottom margin even more
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            name: xAxisLabel?.value,
            nameLocation: 'middle',
            // ✅ CHANGE #1: INCREASED THE GAP SIGNIFICANTLY
            nameGap: 55, // Increased from 40 to push "Year" way down
            nameTextStyle: xAxisLabel?.style,
            axisLabel: { ...tickStyle },
        },
        yAxis: {
            type: 'value',
            name: yAxisLabel?.value,
            nameLocation: 'middle',
            nameGap: 70,
            nameTextStyle: yAxisLabel?.style,
            axisLabel: {
                formatter: '{value}',
                ...tickStyle
            },
        },
        dataZoom: [
            {
                type: 'slider',
                start: 0,
                end: 100,
                xAxisIndex: 0,
                // ✅ CHANGE #2: MOVED THE SLIDER TO THE VERY BOTTOM
                bottom: '5%', // Pushed slider down
            },
            {
                type: 'slider',
                start: 0,
                end: 100,
                yAxisIndex: 0,
                left: '10px',
            },
            {
                type: 'inside',
                xAxisIndex: 0,
            },
            {
                type: 'inside',
                yAxisIndex: 0,
            }
        ],
        series: series
    };

    return (
        <div className="bg-white p-4 sm-p-6 rounded-2xl shadow-lg border border-slate-200/80 transition-shadow hover-shadow-xl">
            <ReactECharts
                ref={chartRef}
                option={option}
                style={{ height: '460px', width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
            />
        </div>
    );
};

export default LineChartComponent;