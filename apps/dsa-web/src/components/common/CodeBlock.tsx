import React, { useState } from 'react';
import { cn } from '../utils/cn';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ className, children }) => {
  const [copied, setCopied] = useState(false);

  // Extract code text from children
  const getCodeText = (): string => {
    if (typeof children === 'string') {
      return children;
    }
    if (Array.isArray(children)) {
      return children.map(child => {
        if (typeof child === 'string') return child;
        if (React.isValidElement(child) && child.props?.children) {
          return getCodeTextFromElement(child);
        }
        return '';
      }).join('');
    }
    if (React.isValidElement(children)) {
      return getCodeTextFromElement(children);
    }
    return '';
  };

  const getCodeTextFromElement = (element: React.ReactElement): string => {
    if (typeof element.props?.children === 'string') {
      return element.props.children;
    }
    if (Array.isArray(element.props?.children)) {
      return element.props.children.map((child: any) => {
        if (typeof child === 'string') return child;
        if (React.isValidElement(child)) return getCodeTextFromElement(child);
        return '';
      }).join('');
    }
    return '';
  };

  const handleCopy = async () => {
    const codeText = getCodeText();
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group/code">
      <button
        onClick={handleCopy}
        className={cn(
          'absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded-md transition-all opacity-0 group-hover/code:opacity-100',
          copied
            ? 'bg-green-500/20 text-green-400'
            : 'bg-muted/80 text-muted-text hover:bg-muted hover:text-foreground'
        )}
        aria-label={copied ? '已复制' : '复制代码'}
      >
        {copied ? (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            已复制
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制
          </span>
        )}
      </button>
      <pre className={cn('overflow-x-auto', className)}>
        <code>{children}</code>
      </pre>
    </div>
  );
};
