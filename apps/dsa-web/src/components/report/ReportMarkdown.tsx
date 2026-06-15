import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ReportLanguage } from '../../types/analysis';
import { historyApi } from '../../api/history';
import { Drawer } from '../common/Drawer';
import { Tooltip } from '../common/Tooltip';
import { ReportMarkdownBody } from './ReportMarkdownBody';
import { getReportText, normalizeReportLanguage } from '../../utils/reportLanguage';

export interface ReportMarkdownProps {
  recordId: number;
  stockName: string;
  stockCode: string;
  onClose: () => void;
  reportLanguage?: ReportLanguage;
}

export const ReportMarkdown: React.FC<ReportMarkdownProps> = ({
  recordId,
  stockName,
  stockCode,
  onClose,
  reportLanguage = 'zh',
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleDownloadFromAPI = useCallback(async (format: 'md' | 'docx' | 'rtf' | 'html' | 'pdf') => {
    try {
      const blob = await historyApi.exportReport(recordId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const timeStr = String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
      const stockNamePart = stockName || stockCode;
      const filename = `综合报告_${stockNamePart}_${dateStr}_${timeStr}.${format}`;

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      if (format === 'pdf' && (errorMessage.includes('imgkit') || errorMessage.includes('weasyprint') || errorMessage.includes('wkhtmltopdf'))) {
        alert(`PDF 导出需要安装额外工具\n\n${errorMessage}\n\n请查看 docs/PDF_SETUP_GUIDE.md 了解如何安装`);
      } else {
        alert(`下载失败: ${errorMessage}`);
      }
    }
  }, [recordId, stockName, stockCode]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      width={isMaximized ? 'full' : 'max-w-3xl'}
      zIndex={100}
      backdropClassName="bg-background/56 backdrop-blur-[2px]"
    >
      <ReportMarkdownPanelWithExport
        recordId={recordId}
        stockName={stockName}
        stockCode={stockCode}
        reportLanguage={reportLanguage}
        onRequestClose={handleClose}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized(!isMaximized)}
        onDownload={handleDownloadFromAPI}
      />
    </Drawer>
  );
};

interface ReportMarkdownPanelWithExportProps {
  recordId: number;
  stockName: string;
  stockCode: string;
  reportLanguage?: ReportLanguage;
  onRequestClose: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onDownload: (format: 'md' | 'docx' | 'rtf' | 'html' | 'pdf') => void;
}

const ReportMarkdownPanelWithExport: React.FC<ReportMarkdownPanelWithExportProps> = ({
  recordId,
  stockName,
  stockCode,
  reportLanguage = 'zh',
  onRequestClose,
  isMaximized,
  onToggleMaximize,
  onDownload,
}) => {
  const text = getReportText(normalizeReportLanguage(reportLanguage));
  const loadReportFailedText = text.loadReportFailed;
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'markdown' | 'text' | null>(null);

  const handleCopyMarkdown = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedType('markdown');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [content]);

  const handleCopyPlainText = useCallback(async () => {
    if (!content) return;
    try {
      const plainText = content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/^[-*]\s+/gm, '• ')
        .replace(/^\d+\.\s+/gm, '');
      await navigator.clipboard.writeText(plainText);
      setCopiedType('text');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [content]);

  useEffect(() => {
    let isMounted = true;

    const fetchMarkdown = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const markdownContent = await historyApi.getMarkdown(recordId);
        if (isMounted) {
          setContent(markdownContent);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : loadReportFailedText);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMarkdown();

    return () => {
      isMounted = false;
    };
  }, [recordId, loadReportFailedText]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--home-action-report-bg)] text-[var(--home-action-report-text)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{stockName || stockCode}</h2>
            <p className="text-xs text-muted-text">{text.fullReport}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content={isMaximized ? '还原窗口' : '最大化'}>
            <button
              type="button"
              onClick={onToggleMaximize}
              className="home-surface-button flex h-10 w-10 items-center justify-center rounded-lg text-secondary-text hover:text-foreground"
              aria-label={isMaximized ? '还原窗口' : '最大化'}
            >
              {isMaximized ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          </Tooltip>

          <div className="relative group">
            <Tooltip content={text.downloadReport}>
              <span className="inline-flex">
                <button
                  type="button"
                  disabled={isLoading || !content}
                  className="home-surface-button flex h-10 w-10 items-center justify-center rounded-lg text-secondary-text hover:text-foreground disabled:opacity-50"
                  aria-label="下载报告"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </span>
            </Tooltip>

            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-1">
                <button onClick={() => onDownload('md')} disabled={isLoading || !content} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50">{text.exportFormats.md}</button>
                <button onClick={() => onDownload('pdf')} disabled={isLoading || !content} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50">{text.exportFormats.pdf}</button>
                <button onClick={() => onDownload('docx')} disabled={isLoading || !content} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50">{text.exportFormats.docx}</button>
                <button onClick={() => onDownload('html')} disabled={isLoading || !content} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50">{text.exportFormats.html}</button>
                <button onClick={() => onDownload('rtf')} disabled={isLoading || !content} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50">{text.exportFormats.rtf}</button>
              </div>
            </div>
          </div>

          <Tooltip content={text.copyMarkdownSource}>
            <span className="inline-flex">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                disabled={isLoading || !content || copiedType !== null}
                className="home-surface-button flex h-10 w-10 items-center justify-center rounded-lg text-secondary-text hover:text-foreground disabled:opacity-50"
                aria-label={text.copyMarkdownSource}
              >
                {copiedType === 'markdown' ? (
                  <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                )}
              </button>
            </span>
          </Tooltip>

          <Tooltip content={text.copyPlainText}>
            <span className="inline-flex">
              <button
                type="button"
                onClick={handleCopyPlainText}
                disabled={isLoading || !content || copiedType !== null}
                className="home-surface-button flex h-10 w-10 items-center justify-center rounded-lg text-secondary-text hover:text-foreground disabled:opacity-50"
                aria-label={text.copyPlainText}
              >
                {copiedType === 'text' ? (
                  <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>
            </span>
          </Tooltip>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="home-spinner h-10 w-10 animate-spin border-[3px]" />
          <p className="mt-4 text-sm text-secondary-text">{text.loadingReport}</p>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10">
            <svg className="h-6 w-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-danger">{error}</p>
          <button type="button" onClick={onRequestClose} className="home-surface-button mt-4 rounded-lg px-4 py-2 text-sm text-secondary-text">
            {text.dismiss}
          </button>
        </div>
      ) : (
        <ReportMarkdownBody content={content} />
      )}

      <div className="home-divider mt-6 flex justify-end border-t pt-4">
        <button type="button" onClick={onRequestClose} className="home-surface-button rounded-lg px-4 py-2 text-sm text-secondary-text hover:text-foreground">
          {text.dismiss}
        </button>
      </div>
    </>
  );
};