
import React, { useState, useCallback } from 'react';
import type { ParsedExcelData, Report, ExcelRow, ColumnSelectorSpec } from './types';
import ExcelProcessorPanel from './components/ExcelProcessorPanel';
import ReportModal from './components/ReportModal';
import { ProcessingSpinner, DownloadIcon } from './components/icons';

// XLSX is globally available from the script tag in index.html
declare var XLSX: any;

const CREATE_NEW_COLUMN = 'CREATE_NEW_COLUMN';

function App() {
  const [leftData, setLeftData] = useState<ParsedExcelData | null>(null);
  const [rightData, setRightData] = useState<ParsedExcelData | null>(null);

  const [a1, setA1] = useState(''); // Left Key
  const [a2, setA2] = useState(''); // Left Value (to be written to)
  const [b1, setB1] = useState(''); // Right Key
  const [b2, setB2] = useState(''); // Right Value (source)

  const [startRow, setStartRow] = useState('');
  const [endRow, setEndRow] = useState('');

  const [skipIfFilled, setSkipIfFilled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [showReport, setShowReport] = useState(false);
  
  const isProcessReady = leftData && rightData && a1 && a2 && b1 && b2;

  const handleProcess = useCallback(() => {
    if (!isProcessReady) return;

    setIsProcessing(true);
    setReport(null);

    setTimeout(() => {
        try {
            const firstRow = startRow ? parseInt(startRow, 10) : 1;
            const lastRow = endRow ? parseInt(endRow, 10) : leftData.rows.length;

            if (
                isNaN(firstRow) || 
                isNaN(lastRow) || 
                firstRow < 1 ||
                lastRow > leftData.rows.length ||
                firstRow > lastRow
            ) {
                alert('行范围无效。请确保开始行不大于结束行，且范围在数据行数内。');
                setIsProcessing(false);
                return;
            }

            const startIndex = firstRow - 1;
            const endIndex = lastRow;

            let targetColumn = a2;
            let finalHeaders = [...leftData.headers];
            
            if (a2 === CREATE_NEW_COLUMN) {
                let newColName = `${a1} (已更新)`;
                let counter = 1;
                while (finalHeaders.includes(newColName)) {
                    newColName = `${a1} (已更新) ${counter++}`;
                }
                targetColumn = newColName;
                
                const a1Index = finalHeaders.indexOf(a1);
                finalHeaders.splice(a1Index + 1, 0, targetColumn);
            }

            const valueMap = new Map<any, any>();
            rightData.rows.forEach(row => {
                valueMap.set(row[b1], row[b2]);
            });

            let writes = 0;
            const foundKeys = new Set<any>();

            const newLeftRows = leftData.rows.map((row, index) => {
                if (index < startIndex || index >= endIndex) {
                    return row; // Not in range, return original row
                }

                const newRow = { ...row };
                const key = newRow[a1];
                if (valueMap.has(key)) {
                    foundKeys.add(key);
                    const valueToWrite = valueMap.get(key);
                    
                    const targetCellHasData = newRow[targetColumn] != null && String(newRow[targetColumn]).trim() !== '';

                    if (!skipIfFilled || !targetCellHasData) {
                      if (newRow[targetColumn] !== valueToWrite) {
                          writes++;
                      }
                      newRow[targetColumn] = valueToWrite;
                    }
                }
                return newRow;
            });

            const b1Values = rightData.rows.map(row => row[b1]);
            const notFound = b1Values.filter(key => !foundKeys.has(key));
            const uniqueNotFound = Array.from(new Set(notFound));

            setLeftData({ ...leftData, headers: finalHeaders, rows: newLeftRows });
            setReport({ writes, notFound: uniqueNotFound });
            setShowReport(true);
        } catch(e) {
            alert(`处理过程中发生错误： ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsProcessing(false);
        }
    }, 100);

  }, [isProcessReady, leftData, rightData, a1, a2, b1, b2, skipIfFilled, startRow, endRow]);

  const handleDownload = () => {
    if (!leftData) return;
    const worksheet = XLSX.utils.json_to_sheet(leftData.rows, { header: leftData.headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Updated_Sheet');
    const originalName = leftData.fileName.split('.').slice(0, -1).join('.');
    XLSX.writeFile(workbook, `${originalName}_updated.xlsx`);
  };

  const handleLeftFileParsed = (data: ParsedExcelData) => {
    setLeftData(data);
    setA1('');
    setA2('');
    setStartRow('');
    setEndRow('');
    setReport(null);
  };

  const handleRightFileParsed = (data: ParsedExcelData) => {
    setRightData(data);
    setB1('');
    setB2('');
    setReport(null);
  };
  
  const leftColumnSelectors: ColumnSelectorSpec[] = [
    { label: '匹配此列 (a1)', value: a1, onChange: setA1, id: 'a1', disabled: !leftData },
    { 
      label: '将值写入此列 (a2)', 
      value: a2, 
      onChange: setA2, 
      id: 'a2',
      disabled: !leftData || !a1,
      specialOptions: a1 ? [{ value: CREATE_NEW_COLUMN, label: `在“${a1}”旁边创建新列` }] : [],
    },
  ];

  const rightColumnSelectors: ColumnSelectorSpec[] = [
    { label: '使用此列进行匹配 (b1)', value: b1, onChange: setB1, id: 'b1', disabled: !rightData },
    { label: '从此列获取值 (b2)', value: b2, onChange: setB2, id: 'b2', disabled: !rightData || !b1 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Excel 列匹配与更新</h1>
          <p className="mt-2 text-lg text-slate-600 max-w-3xl mx-auto">
            根据另一张表格中的匹配值更新当前表格中的列。
          </p>
        </header>

        <main className="space-y-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <ExcelProcessorPanel
              title="表格 A (目标)"
              onFileParsed={handleLeftFileParsed}
              parsedData={leftData}
              columnSelectors={leftColumnSelectors}
              bgColor="bg-white"
              rangeConfig={{
                  startRow,
                  setStartRow,
                  endRow,
                  setEndRow,
                  disabled: !leftData,
                  maxRows: leftData?.rows.length || 0,
              }}
            />
            <ExcelProcessorPanel
              title="表格 B (源)"
              onFileParsed={handleRightFileParsed}
              parsedData={rightData}
              columnSelectors={rightColumnSelectors}
              bgColor="bg-white"
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-slate-600 flex-grow">
                  <h3 className="font-bold text-lg text-slate-800">准备好处理了吗？</h3>
                  <p className="text-sm">请确保所有四列都已选定。</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {report && (
                   <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-5 py-3 border border-transparent text-base font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                    >
                      <DownloadIcon className="h-5 w-5" />
                      下载更新后的表格 A
                    </button>
                )}
                <button
                  onClick={handleProcess}
                  disabled={!isProcessReady || isProcessing}
                  className="flex items-center gap-2 justify-center w-48 px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <ProcessingSpinner className="h-5 w-5"/>
                      <span>处理中...</span>
                    </>
                  ) : (
                    <span>处理数据</span>
                  )}
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                        <input
                          id="skip-overwrite"
                          aria-describedby="skip-overwrite-description"
                          name="skip-overwrite"
                          type="checkbox"
                          checked={skipIfFilled}
                          onChange={e => setSkipIfFilled(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="ml-3 text-sm leading-6">
                        <label htmlFor="skip-overwrite" className="font-medium text-slate-900">
                            不覆盖数据
                        </label>
                        <p id="skip-overwrite-description" className="text-slate-500">
                            如果目标单元格已有数据则跳过写入。
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </main>
      </div>

      <ReportModal 
        isOpen={showReport} 
        onClose={() => setShowReport(false)} 
        report={report} 
        onDownload={handleDownload}
      />
    </div>
  );
}

export default App;
