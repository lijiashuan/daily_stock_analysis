import type { Message } from '../stores/agentChatStore';

/**
 * Try to extract stock name from chat messages
 * Looks for patterns like "分析 600519" or mentions of stock names
 */
function extractStockNameFromMessages(messages: Message[]): string | undefined {
  // Try to find stock name in user messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = msg.content;
      // Common patterns: "分析 XXX", "XXX怎么样", "XXX股票"
      const patterns = [
        /分析\s+([\u4e00-\u9fa5]{2,10})/,  // 分析 贵州茅台
        /([\u4e00-\u9fa5]{2,10})\s*怎么样/,
        /([\u4e00-\u9fa5]{2,10})\s*股票/,
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }
  return undefined;
}

/**
 * Format chat messages as Markdown for export.
 */
export function formatSessionAsMarkdown(messages: Message[]): string {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines: string[] = [
    '# 问股会话',
    '',
    `生成时间: ${timeStr}`,
    '',
  ];

  for (const msg of messages) {
    const heading = msg.role === 'user' ? '## 用户' : '## AI';
    if (msg.role === 'assistant' && msg.skillName) {
      lines.push(`${heading} (${msg.skillName})`);
    } else {
      lines.push(heading);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate filename for chat export with stock name if available
 * Format: 问股_股票名称_日期_时间 or 问股_日期_时间
 */
function generateChatFilename(stockName?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = pad(now.getHours()) + pad(now.getMinutes());
  
  if (stockName) {
    return `问股_${stockName}_${dateStr}_${timeStr}`;
  }
  return `问股_${dateStr}_${timeStr}`;
}

/**
 * Trigger browser download of session as .md file.
 * Revokes object URL after download to prevent memory leak.
 */
export function downloadSession(messages: Message[], stockName?: string): void {
  const content = formatSessionAsMarkdown(messages);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  // Auto-extract stock name if not provided
  const name = stockName || extractStockNameFromMessages(messages);
  const filename = `${generateChatFilename(name)}.md`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download chat session in specified format
 * Uses backend API for real multi-format export
 */
export async function downloadSessionInFormat(
  messages: Message[],
  format: 'md' | 'docx' | 'rtf' | 'html' | 'pdf',
  stockName?: string,
  sessionId?: string
): Promise<void> {
  // If we have a sessionId, use backend API for proper format conversion
  if (sessionId) {
    try {
      const { agentApi } = await import('../api/agent');
      const blob = await agentApi.exportChatSession(sessionId, format);
      
      // Auto-extract stock name if not provided
      const name = stockName || extractStockNameFromMessages(messages);
      const filename = `${generateChatFilename(name)}.${format}`;
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    } catch (error) {
      console.error('Backend export failed, falling back to client-side Markdown:', error);
      // Fallback to client-side Markdown export
    }
  }
  
  // Fallback: client-side Markdown export only
  if (format !== 'md') {
    console.warn(`Format ${format} requires backend API. Falling back to Markdown.`);
  }
  
  // Auto-extract stock name if not provided
  const name = stockName || extractStockNameFromMessages(messages);
  downloadSession(messages, name);
}
