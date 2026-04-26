// api/search.js
const axios = require('axios');

const http = axios.create({ timeout: 15000 });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 【重要提示】如果这里一直返回空，请检查服务器环境变量中是否配置了有效的 TAVILY_API_KEY
    const tvRes = await http.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: keyword + ' 旅游 文旅 景区 目的地 政策 报告',
      max_results: 9,
      search_depth: 'advanced',
      include_image_descriptions: false
    }, { timeout: 15000 });

    // 防御性校验
    if (!tvRes.data || !Array.isArray(tvRes.data.results)) {
      // 如果Tavily接口返回异常结构，直接在前端显示“无信息”，不模拟
      return res.status(200).json({ 
        keyword, 
        tavilyData: { results: [] } 
      });
    }

    const rawList = tvRes.data.results;

    // 清洗数据
    const finalResults = rawList.map(item => ({
      title: item.title || '未命名文档',
      url: item.url || '#',
      content: item.content || item.snippet || '暂无摘要',
      source: '全网实时检索'
    }));

    // 返回真实数据（可能是0条，也可能是9条）
    res.json({
      keyword,
      tavilyData: { results: finalResults }
    });

  } catch (error) {
    console.error('Tavily 接口请求失败:', error.message);
    // 这里也不模拟，让前端显示无信息
    res.status(200).json({ 
      keyword, 
      tavilyData: { results: [] } 
    });
  }
};
