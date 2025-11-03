// import React from 'react';
// import ReactECharts from 'echarts-for-react';

// const AreaChartComponent = ({
//     data,
//     dataKeys,
//     unit,
//     title = "Consolidated Sector Forecast",
//     height = 450,
//     colors = [],
//     xAxisLabel,
//     yAxisLabel,
//     tickStyle,
//     hiddenSeriesNames = [],
// }) => {
//     if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
//         return (
//             <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                
//             </div>
//         );
//     }
    
//     const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];

//     const series = dataKeys.map((key, index) => ({
//         name: key,
//         type: 'line',
//         stack: 'total',
//         areaStyle: {},
//         emphasis: { focus: 'series' },
//         data: data.map(d => d[key] || 0),
//         itemStyle: {
//             color: colors[index] || fallbackColors[index % fallbackColors.length]
//         },
//         showSymbol: false,
//     }));

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
//             axisPointer: {
//                 type: 'cross',
//                 label: { backgroundColor: '#6a7985' }
//             },
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
//             boundaryGap: false,
//             data: data.map(d => d.Year),
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
            
//             nameGap: 80, 
//             nameTextStyle: yAxisLabel?.style,
//             axisLabel: {
//                 formatter: (val) => val.toLocaleString('en-IN'),
//                 ...tickStyle
//             }
//         },
//         dataZoom: [
//             { type: 'slider', xAxisIndex: 0, bottom: '5%' ,height:20 },
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

// export default AreaChartComponent;

// import React from 'react';
// import ReactECharts from 'echarts-for-react';

// const AreaChartComponent = ({
//     data,
//     dataKeys,
//     unit,
//     title = "Consolidated Sector Forecast",
//     height = 450,
//     colors = [],
//     xAxisLabel,
//     yAxisLabel,
//     tickStyle,
//     hiddenSeriesNames = [],
// }) => {
//     if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
//         return (
//             <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
//                 {/* No data message */}
//             </div>
//         );
//     }
    
//     const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];

//     const series = dataKeys.map((key, index) => ({
//         name: key,
//         type: 'line',
//         stack: 'total',
//         areaStyle: {},
//         emphasis: { focus: 'series' },
//         data: data.map(d => d[key] || 0),
//         itemStyle: {
//             color: colors[index] || fallbackColors[index % fallbackColors.length]
//         },
//         showSymbol: true,
//         symbolSize: 6
//     }));

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
//             boundaryGap: false,
//             data: data.map(d => d.Year),
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
//             { type: 'slider', xAxisIndex: 0, bottom: '5%', height:20 },
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

// export default AreaChartComponent;

import React from 'react';
import ReactECharts from 'echarts-for-react';

const AreaChartComponent = ({
    data,
    dataKeys,
    unit,
    title = "Consolidated Sector Forecast",
    height = 450,
    colors = [],
    xAxisLabel,
    yAxisLabel,
    tickStyle,
    hiddenSeriesNames = [],
}) => {
    if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
        return (
            <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                {/* No data message */}
            </div>
        );
    }
    
    const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];

    const series = dataKeys.map((key, index) => ({
        name: key,
        type: 'line',
        stack: 'total',
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: data.map(d => d[key] || 0),
        itemStyle: {
            color: colors[index] || fallbackColors[index % fallbackColors.length]
        },
        showSymbol: true,
        symbolSize: 6
    }));

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
            boundaryGap: false,
            data: data.map(d => d.Year),
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

export default AreaChartComponent;