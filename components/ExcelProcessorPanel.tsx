
import React, { useState, useRef, useCallback, ChangeEvent } from 'react';
import type { ParsedExcelData, ExcelRow, ColumnSelectorSpec } from '../types';
import { UploadIcon, ExcelIcon, XIcon } from './icons';

// XLSX is globally available from the script tag in index.html
declare var XLSX: any;

interface ExcelProcessorPanelProps {
  title: string;
  onFileParsed: (data: ParsedExcelData) => void;
  onClear: () => void;
  parsedData: ParsedExcelData | null;
  columnSelectors: ColumnSelectorSpec[];
  bgColor: string;
}

const ExcelProcessorPanel: React.FC<ExcelProcessorPanelProps> = ({ title, onFileParsed, onClear, parsedData, columnSelectors, bgColor }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

        if (json.length === 0) {
          throw new Error("Excel 工作表为空或无法读取。");
        }
        
        const headers = Object.keys(json[0]);
        const merges = worksheet['!merges'] || [];
        onFileParsed({ headers, rows: json, fileName: file.name, merges });
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析过程中发生未知错误。");
        onFileParsed({ headers: [], rows: [], fileName: '' });
      } finally {
        setIsParsing(false);
      }
    };
    
    reader.onerror = () => {
        setError("读取文件失败。");
        setIsParsing(false);
    }

    reader.readAsArrayBuffer(file);
  }, [onFileParsed]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        const event = { target: { files } } as unknown as ChangeEvent<HTMLInputElement>;
        handleFileChange(event);
    }
  };

  const renderContent = () => {
    if (isParsing) {
      return <div className="text-center p-8"><p className="text-lg text-slate-500">正在解析您的文件...</p></div>;
    }
    
    if (error) {
        return <div className="text-center p-8 text-red-600">{error}</div>;
    }

    if (!parsedData || parsedData.rows.length === 0) {
      return (
        <div 
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-lg h-full hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
          <UploadIcon className="w-12 h-12 text-slate-400 mb-4" />
          <p className="text-slate-600 font-semibold">点击浏览或拖放</p>
          <p className="text-sm text-slate-500">您的 .xlsx 或 .csv 文件</p>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
            <div class="flex items-center gap-3 min-w-0">
                <ExcelIcon className="h-6 w-6 text-green-600 flex-shrink-0"/>
                <p className="font-semibold text-slate-700 truncate">{parsedData.fileName}</p>
            </div>
            <button onClick={onClear} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <XIcon className="h-5 w-5"/>
            </button>
        </div>
        <div className="space-y-3">
          {columnSelectors.map(selector => (
            <div key={selector.id}>
              <label htmlFor={selector.id} className="block text-sm font-medium text-slate-600 mb-1">{selector.label}</label>
              <select
                id={selector.id}
                value={selector.value}
                onChange={(e) => selector.onChange(e.target.value)}
                disabled={selector.disabled}
                className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="" disabled>-- 选择一列 --</option>
                {selector.specialOptions?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                {parsedData.headers.map(header => <option key={header} value={header}>{header}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-600 mb-2">数据预览 (前 5 行)</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="min-w-full text-sm divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            {parsedData.headers.map(header => <th key={header} className="px-4 py-2 text-left font-semibold text-slate-600 truncate">{header}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-slate-50">
                                {parsedData.headers.map(header => <td key={header} className="px-4 py-2 text-slate-700 whitespace-nowrap truncate max-w-xs">{String(row[header] ?? '')}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex-1 ${bgColor} rounded-xl shadow-lg border border-slate-200 flex flex-col`}>
      <h3 className="text-xl font-bold p-4 border-b border-slate-200 text-slate-800">{title}</h3>
      <div className="flex-grow">{renderContent()}</div>
    </div>
  );
};

export default ExcelProcessorPanel;
