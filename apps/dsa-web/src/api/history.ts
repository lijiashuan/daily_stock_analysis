import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  HistoryListResponse,
  HistoryItem,
  HistoryFilters,
  AnalysisReport,
  NewsIntelResponse,
  NewsIntelItem,
} from '../types/analysis';

// ============ API 接口 ============

export interface GetHistoryListParams extends HistoryFilters {
  page?: number;
  limit?: number;
}

export const historyApi = {
  /**
   * 获取历史分析列表
   * @param params 筛选和分页参数
   */
  getList: async (params: GetHistoryListParams = {}): Promise<HistoryListResponse> => {
    const { stockCode, startDate, endDate, page = 1, limit = 20 } = params;

    const queryParams: Record<string, string | number> = { page, limit };
    if (stockCode) queryParams.stock_code = stockCode;
    if (startDate) queryParams.start_date = startDate;
    if (endDate) queryParams.end_date = endDate;

    const response = await apiClient.get<Record<string, unknown>>('/api/v1/history', {
      params: queryParams,
    });

    const data = toCamelCase<{ total: number; page: number; limit: number; items: HistoryItem[] }>(response.data);
    return {
      total: data.total,
      page: data.page,
      limit: data.limit,
      items: data.items.map(item => toCamelCase<HistoryItem>(item)),
    };
  },

  /**
   * 获取历史报告详情
   * @param recordId 分析历史记录主键 ID（使用 ID 而非 query_id，因为 query_id 在批量分析时可能重复）
   */
  getDetail: async (recordId: number): Promise<AnalysisReport> => {
    const response = await apiClient.get<Record<string, unknown>>(`/api/v1/history/${recordId}`);
    return toCamelCase<AnalysisReport>(response.data);
  },

  /**
   * 获取历史报告关联新闻
   * @param recordId 分析历史记录主键 ID
   * @param limit 返回数量限制
   */
  getNews: async (recordId: number, limit = 20): Promise<NewsIntelResponse> => {
    const response = await apiClient.get<Record<string, unknown>>(`/api/v1/history/${recordId}/news`, {
      params: { limit },
    });

    const data = toCamelCase<NewsIntelResponse>(response.data);
    return {
      total: data.total,
      items: (data.items || []).map(item => toCamelCase<NewsIntelItem>(item)),
    };
  },

  /**
   * 获取历史报告的 Markdown 格式内容
   * @param recordId 分析历史记录主键 ID
   * @returns Markdown 格式的完整报告内容
   */
  getMarkdown: async (recordId: number): Promise<string> => {
    const response = await apiClient.get<{ content: string }>(`/api/v1/history/${recordId}/markdown`);
    return response.data.content;
  },

  /**
   * 导出历史报告为指定格式
   * @param recordId 分析历史记录主键 ID
   * @param format 导出格式: 'md' | 'docx' | 'rtf' | 'html' | 'pdf'
   * @returns Blob 对象，可用于下载
   */
  exportReport: async (recordId: number, format: 'md' | 'docx' | 'rtf' | 'html' | 'pdf' = 'md'): Promise<Blob> => {
    const response = await apiClient.get(`/api/v1/history/${recordId}/export`, {
      params: { format },
      responseType: 'blob',
      validateStatus: (status) => status < 500, // 允许接收错误响应
    });
    
    // 检查是否是错误响应（后端返回JSON错误而不是文件）
    if (response.headers['content-type']?.includes('application/json')) {
      const text = await response.data.text();
      try {
        const error = JSON.parse(text);
        throw new Error(error.detail?.message || error.detail || '导出失败');
      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
        throw new Error('导出失败：未知错误');
      }
    }
    
    return response.data;
  },

  /**
   * 批量删除历史记录
   * @param recordIds 分析历史记录主键 ID 列表
   */
  deleteRecords: async (recordIds: number[]): Promise<{ deleted: number }> => {
    const response = await apiClient.delete<Record<string, unknown>>('/api/v1/history', {
      data: { record_ids: recordIds },
    });

    return toCamelCase<{ deleted: number }>(response.data);
  },
};
