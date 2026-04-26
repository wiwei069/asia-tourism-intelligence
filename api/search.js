// api/search.js
const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 唯一的数据来源：Tavily。如果这里报错，就让前端明确看到是 Key 或网络的问题。
    const tvRes = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: keyword + ' 旅游 景区 排名 报告',
      max_results: 6,
      search_depth: 'advanced',
      include_image_descriptions: true
    }, { 
      timeout: 12000,
      // 关键：强制要求返回 JSON，防止网关返回 HTML 错误页
      headers: { 'Accept': 'application/json' }
    });

    // 防御性检查：Tavily 有时会返回 200 但 body 是字符串
    if (typeof tvRes.data !== 'object' || !tvRes.data.results) {
      throw new Error('上游接口返回数据格式异常，请检查 Tavily Key 状态 (Error: Invalid JSON response)');
    }

    const baseResults = tvRes.data.results;

    // 如果结果为空，提示用户，而不是发假数据
    if (baseResults.length === 0) {
      return res.status(200).json({
        keyword,
        tavilyData: { results: [] },
        warning: 'Tavily 未检索到公开结果，请更换关键词或检查 API 配额。'
      });
    }

    // 正常返回
    res.json({
      keyword,
      tavilyData: { results: baseResults },
      deepCrawlData: { images: baseResults[0].image ? [baseResults[0].image] : [] }
    });

  } catch (err) {
    console.error('Tavily/Network 错误:', err.message);
    
    // 精准拦截 "Unexpected token A" 的情况（通常是网关返回了 HTML 错误页）
    const errMsg = err.message || '';
    if (errMsg.includes('Unexpected token') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
      return res.status(502).json({ 
        error: '网络异常：无法连接 Tavily 服务器。请确认 TAVILY_API_KEY 有效且服务器网络通畅。' 
      });
    }

    // 其他错误
    res.status(500).json({ error: '搜索失败: ' + err.message });
  }
};
