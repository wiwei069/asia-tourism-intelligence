// api/search.js
const axios = require('axios');

const http = axios.create({ timeout: 15000 });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 核心逻辑：直接请求 Tavily，获取 9 条全网真实结果
    const tvRes = await http.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: keyword,
      max_results: 9,
      search_depth: 'advanced',
      include_image_descriptions: false
    });

    // 结构防御
    if (!tvRes.data || !Array.isArray(tvRes.data.results)) {
      return res.status(200).json({
        keyword,
        tavilyData: { results: [] } // 返回空数组，绝不模拟
      });
    }

    // 清洗数据，只取纯文本
    const cleanResults = tvRes.data.results.map(item => ({
      title: item.title || '未命名',
      url: item.url || '#',
      content: item.content || item.snippet || '',
      source: '全网实时检索'
    }));

    res.json({
      keyword,
      tavilyData: { results: cleanResults }
    });

  } catch (error) {
    console.error('Tavily 请求异常:', error.message);
    // 如果失败，返回空结果，绝不模拟数据
    res.status(200).json({ 
      keyword,
      tavilyData: { results: [] } 
    });
  }
};
