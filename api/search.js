// api/search.js
const axios = require('axios');
const { deepCrawlTarget } = require('./crawl-target');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword, activeSources } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 1. 使用 Tavily 进行广度搜索
    const tvRes = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: keyword,
      include_image_descriptions: true, // 要求返回图片描述
      max_results: 6,
      search_depth: 'advanced'
    });

    const baseResults = tvRes.data?.results || [];

    // 2. 针对该项目进行“定向深度爬取”
    const detailedInfo = await deepCrawlTarget(keyword);

    // 3. 合并数据
    const enrichedResults = baseResults.length > 0 ? baseResults : [detailedInfo.prioritySource];

    // 构建强数据结构
    const response = {
      keyword,
      tavilyData: { results: enrichedResults },
      socialData: { wechat: [], xiaohongshu: [] },
      // 包含定向爬取的关键数据
      deepCrawlData: detailedInfo,
      linkList: detailedInfo.relatedLinks.map(l => l?.url || '').filter(Boolean).join('\n')
    };

    res.json(response);
  } catch (error) {
    console.error('Search API Error:', error.message);
    res.status(500).json({ error: '搜索失败: ' + error.message });
  }
};
