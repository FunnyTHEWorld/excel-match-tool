import React, { useState, useMemo } from 'react';
import { Report } from '../types';
import { CheckCircleIcon, XCircleIcon, DownloadIcon, ExclamationTriangleIcon } from './icons';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: Report | null;
  onDownload: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, report, onDownload }) => {
  const [displayColumn, setDisplayColumn] = useState<string>('');

  if (!isOpen || !report) return null;

  const renderAuditReport = () => {
    const filteredHeaders = report.a_headers?.filter(h => h !== report.a2_header) || [];
    
    // If the currently selected display column is no longer valid after filtering, reset it.
    if (displayColumn && !filteredHeaders.includes(displayColumn)) {
      setDisplayColumn('');
    }

    const mismatchedColumnToShow = displayColumn || filteredHeaders[0] || '';

    return (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-4 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                <CheckCircleIcon className="h-8 w-8 text-green-500 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-lg">完全匹配</p>
                    <p className="text-3xl font-bold">{report.matches}</p>
                </div>
            </div>
            <div className="flex items-center gap-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                <XCircleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-lg">数据不匹配</p>
                    <p className="text-3xl font-bold">{report.mismatches}</p>
                </div>
            </div>
        </div>

        {report.mismatchedData && report.mismatchedData.length > 0 && (
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-slate-700">不匹配的数据详情</h3>
                    {filteredHeaders.length > 0 && (
                        <div className="flex items-center gap-2">
                            <label htmlFor="display-column" className="text-sm font-medium text-slate-600">查看 A 表其他列:</label>
                            <select
                                id="display-column"
                                value={mismatchedColumnToShow}
                                onChange={(e) => setDisplayColumn(e.target.value)}
                                className="p-1 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            >
                                {filteredHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="bg-white border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                    <table className="min-w-full text-sm divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">匹配键</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">A 表的值 ({report.a2_header})</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">B 表的值 ({report.b2_header})</th>
                                {mismatchedColumnToShow && <th className="px-4 py-2 text-left font-semibold text-slate-600">A 表其他列 ({mismatchedColumnToShow})</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {report.mismatchedData.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-mono text-slate-700">{String(item.key)}</td>
                                    <td className="px-4 py-2 font-mono text-red-700">{String(item.leftValue)}</td>
                                    <td className="px-4 py-2 font-mono text-green-700">{String(item.rightValue)}</td>
                                    {mismatchedColumnToShow && <td className="px-4 py-2 font-mono text-slate-700">{String(item.a_row[mismatchedColumnToShow] ?? '')}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </>
  )};

  const renderUpdateReport = () => (
    <div className="flex items-center gap-4 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6">
        <CheckCircleIcon className="h-8 w-8 text-green-500 flex-shrink-0" />
        <div>
            <p className="font-semibold text-lg">单元格更新成功</p>
            <p className="text-3xl font-bold">{report.writes}</p>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 animate-in fade-in-0 zoom-in-95">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">{report.isAudit ? '审查报告' : '更新报告'}</h2>
        </div>
        
        <div className="p-6 flex-grow overflow-y-auto">
          {report.isAudit ? renderAuditReport() : renderUpdateReport()}

          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg">
             <div className="flex items-center gap-4 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-500 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-lg">在表格 A 中未找到的键 (来自 b1)</p>
                    <p className="text-3xl font-bold">{report.notFound.length}</p>
                </div>
            </div>
            {report.notFound.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                <ul className="divide-y divide-slate-200">
                  {report.notFound.map((item, index) => (
                    <li key={index} className="px-4 py-2 text-sm font-mono truncate">
                      {String(item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-4 rounded-b-xl">
           {!report.isAudit && (
            <button
                onClick={onDownload}
                className="flex items-center gap-2 px-5 py-2 border border-transparent text-base font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
                <DownloadIcon className="h-5 w-5" />
                下载更新后的文件
            </button>
           )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors duration-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
