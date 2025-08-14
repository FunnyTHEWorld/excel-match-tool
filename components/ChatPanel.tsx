import React, { useState, useEffect, useRef } from 'react';
import { streamChatCompletion } from '../lib/api';
import type { ParsedExcelData, CellSelection } from '../types';

const LS_KEY = 'gemini-chat-config';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatPanelProps {
    leftData: ParsedExcelData | null;
    rightData: ParsedExcelData | null;
    selectionA: CellSelection;
    selectionB: CellSelection;
}

const formatSelectedData = (data: ParsedExcelData, selection: CellSelection, tableName: string): string => {
    if (!data || selection.size === 0) return '';

    const selectedRows = new Set<number>();
    const selectedCols = new Set<number>();

    selection.forEach(cell => {
        const [r, c] = cell.split(',').map(Number);
        selectedRows.add(r);
        selectedCols.add(c);
    });

    const sortedRows = Array.from(selectedRows).sort((a, b) => a - b);
    const sortedCols = Array.from(selectedCols).sort((a, b) => a - b);

    const headers = sortedCols.map(c => data.headers[c]);
    const headerLine = `| ${headers.join(' | ')} |`;
    const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;

    const bodyLines = sortedRows.map(r => {
        const rowData = sortedCols.map(c => data.rows[r][data.headers[c]] ?? '');
        return `| ${rowData.join(' | ')} |`;
    });

    return `\n## ${tableName} (已选数据)\n${headerLine}\n${separatorLine}\n${bodyLines.join('\n')}`;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ leftData, rightData, selectionA, selectionB }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedDataContext, setAttachedDataContext] = useState<string>('');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem(LS_KEY);
    if (savedConfig) {
      const { apiKey, baseUrl, modelName } = JSON.parse(savedConfig);
      setApiKey(apiKey || '');
      setBaseUrl(baseUrl || '');
      setModelName(modelName || '');
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveConfig = () => {
    setIsSaving(true);
    const config = { apiKey, baseUrl, modelName };
    localStorage.setItem(LS_KEY, JSON.stringify(config));
    setTimeout(() => {
        setIsSaving(false);
        alert('配置已保存！');
    }, 500);
  };

  const handleAttachData = () => {
    const formattedA = formatSelectedData(leftData, selectionA, '表格 A');
    const formattedB = formatSelectedData(rightData, selectionB, '表格 B');
    const fullContext = `${formattedA}${formattedB}`.trim();
    setAttachedDataContext(fullContext);
    if(fullContext) {
        alert(`已附加 ${selectionA.size} 个来自 A 表的单元格和 ${selectionB.size} 个来自 B 表的单元格。`);
    }
  };

  const handleSendMessage = async () => {
    const finalUserInput = (attachedDataContext + '\n\n' + userInput).trim();

    if (!finalUserInput || isLoading || !apiKey || !baseUrl || !modelName) {
        if(!apiKey || !baseUrl || !modelName) alert('请先完成并保存API配置！');
        return;
    }

    const newUserMessage: Message = { role: 'user', content: finalUserInput };
    const currentMessages = [...messages, newUserMessage];
    setMessages(currentMessages);
    setUserInput('');
    setAttachedDataContext('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    await streamChatCompletion({
        messages: currentMessages,
        apiKey,
        baseUrl,
        modelName,
        onUpdate: (chunk) => {
            setMessages(prev => {
                const lastMsgIndex = prev.length - 1;
                const updatedMessages = [...prev];
                updatedMessages[lastMsgIndex] = {
                    ...updatedMessages[lastMsgIndex],
                    content: updatedMessages[lastMsgIndex].content + chunk,
                };
                return updatedMessages;
            });
        },
        onFinish: () => {
            setIsLoading(false);
        },
        onError: (error) => {
            setMessages(prev => {
                const lastMsgIndex = prev.length - 1;
                const updatedMessages = [...prev];
                updatedMessages[lastMsgIndex] = {
                    ...updatedMessages[lastMsgIndex],
                    content: `出现错误: ${error.message}`,
                };
                return updatedMessages;
            });
            setIsLoading(false);
        },
    });
  };

  const hasSelection = selectionA.size > 0 || selectionB.size > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col h-[80vh]">
      <h3 className="text-xl font-bold p-4 border-b border-slate-200 text-slate-800">AI 助手</h3>
      
      <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50">
        <h4 className="text-sm font-semibold text-slate-600">API 配置</h4>
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-sm" placeholder="输入您的 API Key"/>
        </div>
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Base URL</label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-sm" placeholder="例如: https://api.openai.com/v1"/>
        </div>
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">模型名称</label>
            <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-sm" placeholder="例如: gpt-4, gemini-pro"/>
        </div>
        <button onClick={handleSaveConfig} disabled={isSaving} className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400">
            {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-lg whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-800'}`}>
                    {msg.content}
                </div>
            </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200">
        {attachedDataContext && (
            <div className="p-2 mb-2 text-xs text-slate-600 bg-indigo-100 border border-indigo-200 rounded-md">
                <p className="font-semibold">已附加数据上下文。它将被包含在下一条消息中。</p>
                <pre className="mt-1 p-1 bg-white rounded text-xs overflow-auto max-h-20">{attachedDataContext}</pre>
                <button onClick={() => setAttachedDataContext('')} className="text-indigo-600 hover:underline text-xs mt-1">清除</button>
            </div>
        )}
        <div className="relative">
            <textarea 
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                placeholder="输入您的问题... (可先附加数据)"
                className="w-full p-2 pr-24 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={2}
                disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2 flex gap-2">
                 <button onClick={handleAttachData} disabled={!hasSelection || isLoading} className="px-3 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 disabled:bg-slate-400">
                    附加数据
                </button>
                <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400">
                    {isLoading ? '...' : '发送'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
