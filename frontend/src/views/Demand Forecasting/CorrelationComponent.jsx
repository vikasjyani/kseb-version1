// import React, { useEffect, useState } from 'react';
// import axios from 'axios';

// const CorrelationComponent = ({ rawData }) => {
//     const [matrix, setMatrix] = useState(null);
//     const [isLoading, setIsLoading] = useState(true);

//     useEffect(() => {
//         const fetchCorrelationMatrix = async () => {
//             const current = JSON.parse(sessionStorage.getItem('activeProject'));
//             if (!current?.path || !rawData || rawData.length === 0) {
//                 setMatrix(null);
//                 setIsLoading(false);
//                 return;
//             }

//             setIsLoading(true);
//             try {
//                 const res = await axios.post('/project/correlation-matrix', {
//                     projectPath: current.path,
//                     data: rawData,
//                 });

//                 const apiData = res.data;
//                 if (!apiData || !apiData.matrix || !apiData.variables) {
//                     throw new Error("Invalid data format for matrix");
//                 }

//                 const matrixLookup = apiData.matrix.reduce((acc, row) => {
//                     acc[row.variable] = row.correlations;
//                     return acc;
//                 }, {});

//                 setMatrix({
//                     data: matrixLookup,
//                     variables: apiData.variables
//                 });

//             } catch (err) {
//                 console.error('Error fetching correlation matrix:', err);
//                 setMatrix(null);
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         fetchCorrelationMatrix();
//     }, [rawData]);

//     const getCellClass = (value) => {
//         const absValue = Math.abs(value);
//         if (absValue > 0.7) return 'bg-indigo-700 text-white font-bold';
//         if (absValue > 0.4) return 'bg-indigo-500 text-white';
//         if (absValue > 0.2) return 'bg-indigo-200 text-slate-800';
//         return 'bg-slate-100 text-slate-600';
//     };

//     return (
//         <div className="w-full p-2">
//             {isLoading ? (
//                 <p className="text-slate-500 text-center py-10">Calculating Correlations...</p>
//             ) : !matrix ? (
//                 <p className="text-slate-500 text-center py-10">No correlation data available.</p>
//             ) : (
//                 <div className="border border-slate-200 rounded-lg p-4 bg-white overflow-x-auto">
//                     <h3 className="text-lg font-bold mb-4 text-slate-800 text-center">Correlation Matrix</h3>
//                     <table className="w-full min-w-max text-sm text-center border-collapse">
//                         <thead>
//                             <tr className="bg-slate-50">
//                                 <th className="p-3 border border-slate-200 w-32"></th>
//                                 {matrix.variables.map(colVar => (
//                                     <th key={colVar} className="p-3 border border-slate-200 font-semibold text-slate-700">
//                                         {colVar}
//                                     </th>
//                                 ))}
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {matrix.variables.map((rowVar, rowIndex) => (
//                                 <tr key={rowVar}>
//                                     <td className="p-3 border border-slate-200 font-semibold text-slate-700 text-left bg-slate-50">
//                                         {rowVar}
//                                     </td>
//                                     {matrix.variables.map((colVar, colIndex) => {
//                                         // This condition now hides the upper triangle AND the diagonal
//                                         if (colIndex >= rowIndex) {
//                                             return <td key={colVar} className="border-t border-b border-slate-100 bg-slate-50"></td>;
//                                         }
//                                         const value = matrix.data[rowVar][colVar];
//                                         return (
//                                             <td key={colVar} className={`p-3 border border-slate-200 font-mono transition-colors ${getCellClass(value)}`}>
//                                                 {value.toFixed(2)}
//                                             </td>
//                                         );
//                                     })}
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default CorrelationComponent;

import React, { useEffect, useState } from 'react';
import axios from 'axios';

const CorrelationComponent = ({ rawData }) => {
    const [matrix, setMatrix] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCorrelationMatrix = async () => {
            const current = JSON.parse(sessionStorage.getItem('activeProject'));
            if (!current?.path || !rawData || rawData.length === 0) {
                setMatrix(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const res = await axios.post('/project/correlation-matrix', {
                    projectPath: current.path,
                    data: rawData,
                });

                const apiData = res.data;
                if (!apiData || !apiData.matrix || !apiData.variables) {
                    throw new Error("Invalid data format for matrix");
                }

                const matrixLookup = apiData.matrix.reduce((acc, row) => {
                    acc[row.variable] = row.correlations;
                    return acc;
                }, {});

                setMatrix({
                    data: matrixLookup,
                    variables: apiData.variables
                });

            } catch (err) {
                console.error('Error fetching correlation matrix:', err);
                setMatrix(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCorrelationMatrix();
    }, [rawData]);

    /**
     * Determines the Tailwind CSS classes for a cell based on its correlation value.
     * This creates a sequential color scale using a single blue hue based on the absolute correlation value.
     * The diagonal cells (value of 1) will have a distinct, slightly darker background.
     * @param {number} value - The correlation value, from -1 to 1.
     * @param {boolean} isDiagonal - True if the cell is on the diagonal of the matrix.
     * @returns {string} A string of Tailwind CSS classes.
     */
    const getCellClass = (value, isDiagonal) => {
        if (isDiagonal) {
            // Distinct but harmonized color for diagonal (self-correlation of 1)
            return 'bg-blue-950 text-white font-bold';
        }

        const absValue = Math.abs(value);

        // Shades of blue for correlations
        if (absValue > 0.9) return 'bg-blue-800 text-white font-bold';
        if (absValue > 0.7) return 'bg-blue-700 text-white';
        if (absValue > 0.5) return 'bg-blue-600 text-white';
        if (absValue > 0.3) return 'bg-blue-400 text-white';
        if (absValue > 0.1) return 'bg-blue-200 text-blue-900';
        // Near-zero correlation
        return 'bg-blue-100 text-blue-800';
    };

    return (
        <div className="w-full p-2">
            {isLoading ? (
                <p className="text-slate-500 text-center py-10">Calculating Correlations...</p>
            ) : !matrix ? (
                <p className="text-slate-500 text-center py-10">No correlation data available.</p>
            ) : (
                <div className="border border-slate-200 rounded-lg p-4 bg-white overflow-x-auto">
                    <h3 className="text-lg font-bold mb-4 text-slate-800 text-center">Correlation Matrix</h3>
                    <table className="w-full min-w-max text-sm text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="p-3 border border-slate-200 w-32"></th>
                                {matrix.variables.map(colVar => (
                                    <th key={colVar} className="p-3 border border-slate-200 font-semibold text-slate-700">
                                        {colVar}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.variables.map((rowVar, rowIndex) => (
                                <tr key={rowVar}>
                                    <td className="p-3 border border-slate-200 font-semibold text-slate-700 text-left bg-slate-50">
                                        {rowVar}
                                    </td>
                                    {matrix.variables.map((colVar, colIndex) => {
                                        const isDiagonal = rowIndex === colIndex;
                                        // Fallback to 1 for diagonal, 0 for missing data, though backend should provide it.
                                        const value = matrix.data[rowVar]?.[colVar] ?? (isDiagonal ? 1 : 0);
                                        return (
                                            <td
                                                key={colVar}
                                                className={`p-3 border border-slate-200 font-mono transition-colors ${getCellClass(value, isDiagonal)}`}
                                                title={`Correlation(${rowVar}, ${colVar}) = ${value.toFixed(4)}`}
                                            >
                                                {Math.abs(value).toFixed(2)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CorrelationComponent;

