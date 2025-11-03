

import React from 'react';
import ReactApexChart from 'react-apexcharts';

const ApexLineChart = ({ data, xKey, yKey, seriesName, title, yAxisTitle, height = 350 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[400px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
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

    const series = [{
        name: seriesName,
        data: data.map(item => item[yKey])
    }];

    const options = {
        chart: {
            type: 'line',
            height: height,
            fontFamily: 'sans-serif',
            toolbar: {
                show: true,
                autoSelected: 'zoom'
            },
            selection: {
                enabled: true,
                type: 'y',
                fill: {
                    color: '#2563eb',
                    opacity: 0.1
                },
                stroke: {
                    width: 1,
                    color: '#2563eb',
                    opacity: 0.6,
                    dashArray: 3
                }
            },
            zoom: {
                enabled: true,
                type: 'y',
                autoScaleYaxis: true
            }
        },
        markers: {
            size: 4,
            strokeColors: '#FFFFFF',
            strokeWidth: 2,
            hover: {
                size: 7
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            type: 'category',
            categories: data.map(item => item[xKey]),
            title: {
                text: 'Year',
                style: { color: '#334155', fontSize: '14px', fontWeight: 'bold' }
            },
            labels: {
                // **FIX**: Updated style for X-axis labels
                style: { 
                    colors: '#000000', // Black color
                    fontSize: '12px', 
                    fontWeight: 'bold' // Bold font weight
                },
            },
        },
        yaxis: {
            title: {
                text: yAxisTitle,
                style: { color: '#334155', fontSize: '14px', fontWeight: 'bold' }
            },
            labels: {
                // **FIX**: Updated style for Y-axis labels
                style: { 
                    colors: '#000000', // Black color
                    fontSize: '12px', 
                    fontWeight: 'bold' // Bold font weight
                },
                formatter: (val) => val.toLocaleString('en-IN'),
            },
        },
        grid: {
            borderColor: '#e2e8f0',
            strokeDashArray: 3,
        },
        tooltip: {
            theme: 'light',
            x: {
                formatter: function (val, { dataPointIndex }) {
                    return `Year: ${data[dataPointIndex][xKey]}`;
                }
            },
            y: {
                formatter: (val) => val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            },
        },
        title: {
            text: title,
            align: 'left',
            style: { fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }
        },
        colors: ['#4F46E5']
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/80">
            <ReactApexChart options={options} series={series} type="line" height={height} />
        </div>
    );
};

export default ApexLineChart;