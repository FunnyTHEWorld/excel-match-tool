import React, { useState, useCallback } from 'react';
import type { ParsedExcelData, Report, ExcelRow, ColumnSelectorSpec, MismatchedData, CellSelection } from './types';
import ExcelProcessorPanel from './components/ExcelProcessorPanel';
import ReportModal from './components/ReportModal';
import { ChatPanel } from './components/ChatPanel';
import { ProcessingSpinner, DownloadIcon } from './components/icons';

// XLSX is globally available from the script tag in index.html
declare var XLSX: any;

const CREATE_NEW_COLUMN = 'CREATE_NEW_COLUMN';

// Helper to check if a cell is part of a merged range, but not the primary cell
const isSkippedMergedCell = (rowIndex: number, colIndex: number, merges: ParsedExcelData['merges']) => {
  if (!merges || colIndex === -1) return false;
  // XLSX rows are 1-based, our data is 0-based
  const r = rowIndex + 1;
  for (const merge of merges) {
    if (r >= merge.s.r && r <= merge.e.r && colIndex >= merge.s.c && colIndex <= merge.e.c) {
      // It's in a merged range. Is it the top-left (primary) cell?
      if (r === merge.s.r && colIndex === merge.s.c) {
        return false; // It's the primary cell, don't skip
      }
      return true; // It's a secondary merged cell, skip it
    }
  }
  return false;
};

function App() {
  const [leftData, setLeftData] = useState<ParsedExcelData | null>(null);
  const [rightData, setRightData] = useState<ParsedExcelData | null>(null);

  const [a1, setA1] = useState(''); // Left Key
  const [a2, setA2] = useState(''); // Left Value (to be written to or compared)
  const [b1, setB1] = useState(''); // Right Key
  const [b2, setB2] = useState(''); // Right Value (source)

  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isAuditMode, setIsAuditMode] = useState(false);

  const [selectionA, setSelectionA] = useState<CellSelection>(new Set());
  const [selectionB, setSelectionB] = useState<CellSelection>(new Set());
  
  const isProcessReady = leftData && rightData && a1 && a2 && b1 && b2;

  const handleProcess = useCallback(() => {
    if (!isProcessReady) return;

    setIsProcessing(true);
    setReport(null);

    setTimeout(() => {
        try {
            const valueMap = new Map<any, any>();
            const b1_col_idx = rightData.headers.indexOf(b1);
            const b2_col_idx = rightData.headers.indexOf(b2);

            rightData.rawData.forEach((row, index) => {
                if (isSkippedMergedCell(index, b1_col_idx, rightData.merges) || isSkippedMergedCell(index, b2_col_idx, rightData.merges)) {
                    return; // Skip this row
                }
                valueMap.set(row[b1_col_idx], row[b2_col_idx]);
            });

            const foundKeys = new Set<any>();

            if (isAuditMode) {
                // --- AUDIT LOGIC ---
                let matches = 0;
                let mismatches = 0;
                const mismatchedData: MismatchedData[] = [];
                const a1_col_idx = leftData.headers.indexOf(a1);
                const a2_col_idx = leftData.headers.indexOf(a2);

                leftData.rawData.forEach((row, index) => {
                    if (isSkippedMergedCell(index, a1_col_idx, leftData.merges) || isSkippedMergedCell(index, a2_col_idx, leftData.merges)) {
                        return; // Skip this row
                    }
                    const key = row[a1_col_idx];
                    if (valueMap.has(key)) {
                        const rightValue = valueMap.get(key);
                        const leftValue = row[a2_col_idx];
                        if (leftValue === rightValue) {
                            matches++;
                        } else {
                            mismatches++;
                            const rowObject: ExcelRow = {};
                            leftData.headers.forEach((h, i) => rowObject[h] = row[i]);
                            mismatchedData.push({ key, leftValue, rightValue, a_row: rowObject });
                        }
                        foundKeys.add(key);
                    }
                });
                
                const b1Values = rightData.rawData.map(row => row[b1_col_idx]);
                const notFound = b1Values.filter(key => !foundKeys.has(key));
                const uniqueNotFound = Array.from(new Set(notFound));

                setReport({
                    isAudit: true,
                    matches,
                    mismatches,
                    notFound: uniqueNotFound,
                    mismatchedData,
                    a_headers: leftData.headers,
                    a2_header: a2,
                    b2_header: b2,
                });

            } else {
                // --- UPDATE LOGIC (Original) ---
                let targetColumn = a2;
                let finalHeaders = [...leftData.headers];
                let newLeftRawData = leftData.rawData.map(r => [...r]);
                let newMerges = leftData.merges ? JSON.parse(JSON.stringify(leftData.merges)) : [];
                let newDataValidations = leftData.dataValidations ? JSON.parse(JSON.stringify(leftData.dataValidations)) : [];

                if (a2 === CREATE_NEW_COLUMN) {
                    let newColName = `${a1} (已更新)`;
                    let counter = 1;
                    while (finalHeaders.includes(newColName)) {
                        newColName = `${a1} (已更新) ${counter++}`;
                    }
                    targetColumn = newColName;
                    
                    const a1Index = finalHeaders.indexOf(a1);
                    finalHeaders.splice(a1Index + 1, 0, targetColumn);
                    newLeftRawData.forEach(row => row.splice(a1Index + 1, 0, undefined));

                    // Adjust merges for the new column
                    if (newMerges) {
                        newMerges.forEach((merge: any) => {
                            if (merge.s.c > a1Index) {
                                merge.s.c += 1;
                            }
                            if (merge.e.c > a1Index) {
                                merge.e.c += 1;
                            }
                        });
                    }

                    // Adjust data validations for the new column
                    if (newDataValidations) {
                        newDataValidations.forEach((dv: any) => {
                            const range = XLSX.utils.decode_range(dv.sqref);
                            if (range.s.c > a1Index) {
                                range.s.c += 1;
                            }
                            if (range.e.c > a1Index) {
                                range.e.c += 1;
                            }
                            dv.sqref = XLSX.utils.encode_range(range);
                        });
                    }
                }

                let writes = 0;
                const a1_col_idx = leftData.headers.indexOf(a1);
                const target_col_idx = finalHeaders.indexOf(targetColumn);

                newLeftRawData = newLeftRawData.map((row, index) => {
                    if (isSkippedMergedCell(index, a1_col_idx, leftData.merges) || isSkippedMergedCell(index, target_col_idx, leftData.merges)) {
                        return row; // Skip this row, return original
                    }
                    const key = row[a1_col_idx];
                    if (valueMap.has(key)) {
                        const valueToWrite = valueMap.get(key);
                        if(row[target_col_idx] !== valueToWrite) {
                            writes++;
                        }
                        row[target_col_idx] = valueToWrite;
                        foundKeys.add(key);
                    }
                    return row;
                });

                const b1Values = rightData.rawData.map(row => row[b1_col_idx]);
                const notFound = b1Values.filter(key => !foundKeys.has(key));
                const uniqueNotFound = Array.from(new Set(notFound));

                const newLeftRows = newLeftRawData.map(row => {
                    const rowObject: ExcelRow = {};
                    finalHeaders.forEach((header, i) => {
                        rowObject[header] = row[i];
                    });
                    return rowObject;
                });

                setLeftData({ ...leftData, headers: finalHeaders, rows: newLeftRows, rawData: newLeftRawData, merges: newMerges, dataValidations: newDataValidations });
                setReport({ isAudit: false, writes, notFound: uniqueNotFound });
            }
            setShowReport(true);
        } catch(e) {
            alert(`处理过程中发生错误： ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsProcessing(false);
        }
    }, 100);

  }, [isProcessReady, leftData, rightData, a1, a2, b1, b2, isAuditMode]);

  const handleDownload = () => {
    if (!leftData) return;
    const worksheet = XLSX.utils.aoa_to_sheet(leftData.rawData);
    if (leftData.merges) {
        worksheet['!merges'] = leftData.merges;
    }
    if (leftData.dataValidations) {
        worksheet['!dataValidations'] = leftData.dataValidations;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Updated_Sheet');
    const originalName = leftData.fileName.split('.').slice(0, -1).join('.');
    XLSX.writeFile(workbook, `${originalName}_updated.xlsx`);
  };

  const handleLeftFileParsed = (data: ParsedExcelData) => {
    setLeftData(data);
    setA1('');
    setA2('');
    setReport(null);
  };

  const handleRightFileParsed = (data: ParsedExcelData) => {
    setRightData(data);
    setB1('');
    setB2('');
    setReport(null);
  };

  const handleLeftClear = () => {
    setLeftData(null);
    setA1('');
    setA2('');
    setReport(null);
  };

  const handleRightClear = () => {
    setRightData(null);
    setB1('');
    setB2('');
    setReport(null);
  };
  
  const leftColumnSelectors: ColumnSelectorSpec[] = [
    { label: '匹配此列 (a1)', value: a1, onChange: setA1, id: 'a1', disabled: !leftData },
    { 
      label: isAuditMode ? '比较此列 (a2)' : '将值写入此列 (a2)', 
      value: a2, 
      onChange: setA2, 
      id: 'a2',
      disabled: !leftData || !a1,
      specialOptions: a1 && !isAuditMode ? [{ value: CREATE_NEW_COLUMN, label: `在“${a1}”旁边创建新列` }] : [],
    },
  ];

  const rightColumnSelectors: ColumnSelectorSpec[] = [
    { label: '使用此列进行匹配 (b1)', value: b1, onChange: setB1, id: 'b1', disabled: !rightData },
    { label: isAuditMode ? '比较此列的值 (b2)' : '从此列获取值 (b2)', value: b2, onChange: setB2, id: 'b2', disabled: !rightData || !b1 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Excel 列匹配与更新</h1>
          <p className="mt-2 text-lg text-slate-600 max-w-3xl mx-auto">
            根据另一张表格中的匹配值更新或审查当前表格中的列。
          </p>
        </header>

        <main className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <ExcelProcessorPanel
                title="表格 A (目标)"
                onFileParsed={handleLeftFileParsed}
                onClear={handleLeftClear}
                parsedData={leftData}
                columnSelectors={leftColumnSelectors}
                selection={selectionA}
                onSelectionChange={setSelectionA}
                bgColor="bg-white"
              />
              <ExcelProcessorPanel
                title="表格 B (源)"
                onFileParsed={handleRightFileParsed}
                onClear={handleRightClear}
                parsedData={rightData}
                columnSelectors={rightColumnSelectors}
                selection={selectionB}
                onSelectionChange={setSelectionB}
                bgColor="bg-white"
              />
            </div>
            <div className="xl:col-span-1">
              <ChatPanel 
                leftData={leftData}
                rightData={rightData}
                selectionA={selectionA}
                selectionB={selectionB}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <label htmlFor="audit-toggle" className="flex items-center cursor-pointer">
                    <span className={`mr-3 text-sm font-medium ${!isAuditMode ? 'text-indigo-600' : 'text-slate-500'}`}>更新模式</span>
                    <div className="relative">
                        <input type="checkbox" id="audit-toggle" className="sr-only" checked={isAuditMode} onChange={() => setIsAuditMode(!isAuditMode)} />
                        <div className="block bg-slate-200 w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isAuditMode ? 'transform translate-x-full bg-indigo-600' : ''}`}></div>
                    </div>
                    <span className={`ml-3 text-sm font-medium ${isAuditMode ? 'text-indigo-600' : 'text-slate-500'}`}>审查模式</span>
                </label>
            </div>
            <div className="flex items-center gap-4">
              {report && !report.isAudit && (
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
                  <span>{isAuditMode ? '开始审查' : '处理数据'}</span>
                )}
              </button>
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
