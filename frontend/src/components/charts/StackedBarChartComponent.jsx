// import React from 'react';
// import ReactECharts from 'echarts-for-react';

// const StackedBarChartComponent = ({
//     data,
//     dataKeys,
//     unit,
//     title = "Stacked Electricity Chart",
//     height = 500,
//     colors = [],
//     xAxisLabel,
//     yAxisLabel,
//     tickStyle,
//     hiddenSeriesNames = [],
// }) => {
//     if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
//         return (
//             <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
//                 {/* No Data SVG and text... */}
//             </div>
//         );
//     }

//     const fallbackColors = ['#60a5fa', '#f472b6', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#c084fc', '#2dd4bf'];
//     const hasTotal = data.length > 0 && data[0].Total !== undefined;
    
//     const barKeys = dataKeys.filter(k => k !== 'Total');
//     const barSeries = barKeys.map((key, index) => ({
//         name: key,
//         type: 'bar',
//         stack: 'total',
//         emphasis: { focus: 'series' },
//         data: data.map(d => d[key] || 0),
//         itemStyle: {
//             color: colors[index] || fallbackColors[index % fallbackColors.length]
//         }
//     }));

//     const lineSeries = hasTotal ? [{
//         name: 'Total',
//         type: 'line',
//         smooth: true,
//         data: data.map(d => d.Total || 0),
//         itemStyle: { color: '#1e293b' }
//     }] : [];

//     const series = [...barSeries, ...lineSeries];
    
//     const option = {
//         title: {
//             text: title,
//             left: 'center',
//             textStyle: {
//                 color: '#1e293b',
//                 fontWeight: 'bold',
//                 fontSize: 18,
//             }
//         },
//         tooltip: {
//             trigger: 'axis',
//             axisPointer: { type: 'shadow' }
//         },
//         legend: {
//             top: '10%',
//             type: 'scroll',
//             selected: dataKeys.reduce((acc, key) => {
//                 acc[key] = !hiddenSeriesNames.includes(key);
//                 return acc;
//             }, {})
//         },
//         grid: {
//             top: '25%',
//             left: '95px',
//             right: '4%',
//             bottom: '25%',
//             containLabel: true
//         },
//         xAxis: {
//             type: 'category',
//             data: data.map(d => String(d.Year)),
//             name: xAxisLabel?.value || 'Year',
//             nameLocation: 'middle',
//             nameGap: 55,
//             nameTextStyle: xAxisLabel?.style,
//             axisLabel: { ...tickStyle }
//         },
//         yAxis: {
//             type: 'value',
//             name: yAxisLabel?.value || `Electricity (${unit})`,
//             nameLocation: 'middle',
//             // ✅ FIX: INCREASED GAP TO PUSH TITLE AWAY FROM LABELS
//             nameGap: 80,
//             nameTextStyle: yAxisLabel?.style,
//             axisLabel: {
//                 formatter: (val) => val.toLocaleString('en-IN'),
//                 ...tickStyle
//             }
//         },
//         dataZoom: [
//             { type: 'slider', xAxisIndex: 0, bottom: '5%', height: 20 },
//             { type: 'slider', yAxisIndex: 0, left: '20px',width:20 },
//             { type: 'inside', xAxisIndex: 0 },
//             { type: 'inside', yAxisIndex: 0 }
//         ],
//         series: series
//     };

//     return (
//         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//             <ReactECharts option={option} style={{ height: `${height}px`, width: '100%' }} notMerge={true} lazyUpdate={true} />
//         </div>
//     );
// };

// export default StackedBarChartComponent;

// import React from 'react';
// import ReactECharts from 'echarts-for-react';

// const StackedBarChartComponent = ({
//     data,
//     dataKeys,
//     unit,
//     title = "Stacked Electricity Chart",
//     height = 500,
//     colors = [],
//     xAxisLabel,
//     yAxisLabel,
//     tickStyle,
//     hiddenSeriesNames = [],
// }) => {
//     if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
//         return (
//             <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
//                 {/* No Data SVG and text... */}
//             </div>
//         );
//     }

//     const fallbackColors = ['#60a5fa', '#f472b6', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#c084fc', '#2dd4bf'];
//     const hasTotal = data.length > 0 && data[0].Total !== undefined;
    
//     const barKeys = dataKeys.filter(k => k !== 'Total');
//     const barSeries = barKeys.map((key, index) => ({
//         name: key,
//         type: 'bar',
//         stack: 'total',
//         emphasis: { focus: 'series' },
//         data: data.map(d => d[key] || 0),
//         itemStyle: {
//             color: colors[index] || fallbackColors[index % fallbackColors.length]
//         }
//     }));

//     const lineSeries = hasTotal ? [{
//         name: 'Total',
//         type: 'line',
//         smooth: true,
//         data: data.map(d => d.Total || 0),
//         itemStyle: { color: '#1e293b' }
//     }] : [];

//     const series = [...barSeries, ...lineSeries];
    
//     const option = {
//         title: {
//             text: title,
//             left: 'center',
//             textStyle: {
//                 color: '#1e293b',
//                 fontWeight: 'bold',
//                 fontSize: 18,
//             }
//         },
//         tooltip: {
//             trigger: 'item',
//             formatter: (params) => {
//                 const { name, seriesName, value, color } = params;
//                 const displayValue = (typeof value === 'number') ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : 'N/A';
                
//                 return `<div class="bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200/50">
//                             <p class="font-bold text-slate-800 text-sm mb-1">Year: ${name}</p>
//                             <div style="color: ${color}" class="flex items-center justify-between gap-4 text-sm font-semibold">
//                                 <span>${seriesName}:</span>
//                                 <span>${displayValue} ${unit || ''}</span>
//                             </div>
//                         </div>`;
//             }
//         },
//         legend: {
//             top: '10%',
//             type: 'scroll',
//             selected: dataKeys.reduce((acc, key) => {
//                 acc[key] = !hiddenSeriesNames.includes(key);
//                 return acc;
//             }, {})
//         },
//         // ✅ FINAL FIX 1: Use a large percentage-based left margin
//         grid: {
//             top: '25%',
//             left: '20%', // Reserve 20% of the width for the Y-axis components
//             right: '4%',
//             bottom: '25%',
//             containLabel: false // Let the large left margin handle all spacing
//         },
//         xAxis: {
//             type: 'category',
//             data: data.map(d => String(d.Year)),
//             name: xAxisLabel?.value || 'Year',
//             nameLocation: 'middle',
//             nameGap: 55,
//             nameTextStyle: xAxisLabel?.style,
//             axisLabel: {
//                 ...tickStyle,
//                 interval: 0,
//                 rotate: 30,
//             }
//         },
//         // ✅ FINAL FIX 2: Increase nameGap to push title into the gutter
//         yAxis: {
//             type: 'value',
//             name: yAxisLabel?.value || `Electricity (${unit})`,
//             nameLocation: 'middle',
//             nameGap: 110, // Very large gap to push the title far to the left
//             nameTextStyle: {
//                 ...yAxisLabel?.style,
//                 align: 'center'
//             },
//             axisLabel: {
//                 formatter: (val) => val.toLocaleString('en-IN'),
//                 ...tickStyle
//             }
//         },
//         dataZoom: [
//             { type: 'slider', xAxisIndex: 0, bottom: '5%', height: 20 },
//             { type: 'slider', yAxisIndex: 0, left: '20px', width:20 },
//             { type: 'inside', xAxisIndex: 0 },
//             { type: 'inside', yAxisIndex: 0 }
//         ],
//         series: series
//     };

//     return (
//         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
//             <ReactECharts option={option} style={{ height: `${height}px`, width: '100%' }} notMerge={true} lazyUpdate={true} />
//         </div>
//     );
// };

// export default StackedBarChartComponent;

import React from 'react';
import ReactECharts from 'echarts-for-react';

const StackedBarChartComponent = ({
    data,
    dataKeys,
    unit,
    title = "Stacked Electricity Chart",
    height = 500,
    colors = [],
    xAxisLabel,
    yAxisLabel,
    tickStyle,
    hiddenSeriesNames = [],
}) => {
    if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
        return (
            <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                {/* No Data SVG and text... */}
            </div>
        );
    }

    const fallbackColors = ['#60a5fa', '#f472b6', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#c084fc', '#2dd4bf'];
    const hasTotal = data.length > 0 && data[0].Total !== undefined;
    
    const barKeys = dataKeys.filter(k => k !== 'Total');
    const barSeries = barKeys.map((key, index) => ({
        name: key,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map(d => d[key] || 0),
        itemStyle: {
            color: colors[index] || fallbackColors[index % fallbackColors.length]
        }
    }));

    const lineSeries = hasTotal ? [{
        name: 'Total',
        type: 'line',
        smooth: true,
        data: data.map(d => d.Total || 0),
        itemStyle: { color: '#1e293b' }
    }] : [];

    const series = [...barSeries, ...lineSeries];
    
    const option = {
        title: {
            text: title,
            left: 'center',
            textStyle: {
                color: '#1e293b',
                fontWeight: 'bold',
                fontSize: 18,
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: (params) => {
                const { name, seriesName, value, color } = params;
                const displayValue = (typeof value === 'number') ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : 'N/A';
                
                return `<div class="bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200/50">
                            <p class="font-bold text-slate-800 text-sm mb-1">Year: ${name}</p>
                            <div style="color: ${color}" class="flex items-center justify-between gap-4 text-sm font-semibold">
                                <span>${seriesName}:</span>
                                <span>${displayValue} ${unit || ''}</span>
                            </div>
                        </div>`;
            }
        },
        legend: {
            top: '10%',
            type: 'scroll',
            selected: dataKeys.reduce((acc, key) => {
                acc[key] = !hiddenSeriesNames.includes(key);
                return acc;
            }, {})
        },
        grid: {
            top: '25%',
            left: '20%',
            right: '4%',
            bottom: '25%',
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: data.map(d => String(d.Year)),
            name: xAxisLabel?.value || 'Year',
            nameLocation: 'middle',
            nameGap: 55,
            nameTextStyle: xAxisLabel?.style,
            axisLabel: {
                ...tickStyle,
                interval: 0,
                rotate: 30,
            }
        },
        yAxis: {
            type: 'value',
            name: yAxisLabel?.value || `Electricity (${unit})`,
            nameLocation: 'middle',
            nameGap: 110,
            nameTextStyle: {
                ...yAxisLabel?.style,
                align: 'center'
            },
            axisLabel: {
                formatter: (val) => val.toLocaleString('en-IN'),
                ...tickStyle
            }
        },
        dataZoom: [
            { type: 'slider', xAxisIndex: 0, bottom: '5%', height: 20 },
            // ✅ Fix applied here: changed left from '20px' to '40px'
            { type: 'slider', yAxisIndex: 0, left: '40px', width: 20 },
            { type: 'inside', xAxisIndex: 0 },
            { type: 'inside', yAxisIndex: 0 }
        ],
        series: series
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <ReactECharts option={option} style={{ height: `${height}px`, width: '100%' }} notMerge={true} lazyUpdate={true} />
        </div>
    );
};

export default StackedBarChartComponent;