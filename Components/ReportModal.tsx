import React from 'react';
import { Report } from '../types';
import { CheckCircleIcon, XCircleIcon, DownloadIcon } from './icons';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: Report | null;
  onDownload: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, report, onDownload }) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 animate-in fade-in-0 zoom-in-95">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">处理报告</h2>
        </div>
        
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="flex items-center gap-4 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6">
            <CheckCircleIcon className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
                <p className="font-semibold text-lg">单元格更新成功</p>
                <p className="text-3xl font-bold">{report.writes}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg">
             <div className="flex items-center gap-4 mb-4">
                <XCircleIcon className="h-8 w-8 text-amber-500 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-lg">在表格 A 中未找到的项目</p>
                    <p className="text-3xl font-bold">{report.notFound.length}</p>
                </div>
            </div>
            {report.notFound.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-md max-h-60 overflow-y-auto">
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
           <button
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-2 border border-transparent text-base font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            <DownloadIcon className="h-5 w-5" />
            下载更新后的文件
          </button>
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