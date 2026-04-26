// api/search.js
const axios = require('axios');
const { fetchMideanRanking } = require('./crawl-ranking');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 1. 并行执行：Tavily搜索 + 公开榜单抓取
    const [tvRes, rankingList] = await Promise.allSettled([
      axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: keyword,
        max_results: 6,
        include_image_descriptions: true
      }, { timeout: 10000 }),
      fetchMideanRanking() // 抓取公开的榜单
    ]);

    // 2. 处理Tavily结果
    const baseResults = tvRes.status === 'fulfilled' ? tvRes.value.data?.results || [] : [];

    // 3. 处理榜单结果
    const mideanData = rankingList.status === 'fulfilled' ? rankingList.value : [];

    // 4. 构建响应
    const response = {
      keyword,
      tavilyData: { results: baseResults },
      rankingData: {
        source: '迈点研究院公开榜单',
        list: mideanData
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Search API 致命错误:', error.message);
    // 兜底：无论如何返回标准 JSON，绝不返回 HTML 或挂起
    res.status(200).json({ 
      keyword,
      tavilyData: { results: [] },
      rankingData: { list: [], error: '公开数据抓取超时，请刷新重试' } 
    });
  }
};
