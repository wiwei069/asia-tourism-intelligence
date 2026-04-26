// api/search.js
const axios = require('axios');
const { 
  fetchRealMideanRanking, 
  fetchGovCulturalData, 
  fetchOfficialSiteImgs 
} = require('./crawl-real');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 1. 必选：Tavily 全网实时检索 (这是获取最新新闻和动态的核心)
    let tavilyResults = [];
    try {
      const tvRes = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: keyword,
        max_results: 6,
        search_depth: 'advanced',
        include_image_descriptions: true
      }, { timeout: 15000 });

      if (tvRes.data && tvRes.data.results) {
        tavilyResults = tvRes.data.results;
      } else {
        throw new Error('Tavily returned empty');
      }
    } catch (tavilyErr) {
      // 如果Tavily挂了，我们直接抛出严重错误，不降级假数据
      console.error("TAVILY 连接失败:", tavilyErr.message);
      return res.status(500).json({ 
        error: "Tavily API 连接失败或未配置，请检查环境变量！无法获取最新实时数据。" 
      });
    }

    // 2. 并行执行三个“真实定向爬取” (这才是硬核干活部分)
    const [mideanRank, govData, officialImgs] = await Promise.allSettled([
      fetchRealMideanRanking(),
      fetchGovCulturalData(keyword),
      fetchOfficialSiteImgs(keyword)
    ]);

    // 3. 构建真实的响应体
    // 如果迈点和政府网的抓取都彻底失败，且Tavily也没东西，那才是真没数据
    const hasValidRealData = 
      (mideanRank.status === 'fulfilled' && mideanRank.value.list?.length > 0) ||
      (govData.status === 'fulfilled' && govData.value.items?.length > 0) ||
      (officialImgs.status === 'fulfilled' && officialImgs.value.images?.length > 0) ||
      tavilyResults.length > 0;

    if (!hasValidRealData) {
      return res.status(404).json({ 
        error: "该关键词在迈点、政府网、Tavily及官网中均未抓取到任何有效公开数据。" 
      });
    }

    // 4. 返回真实数据 (图片单独剥离给前端展示)
    const allImages = officialImgs.status === 'fulfilled' ? officialImgs.value.images : [];
    
    // 把抓取到的真实图片强行注入到Tavily结果的第一条，方便前端直接展示
    if (allImages.length > 0 && tavilyResults.length > 0) {
      tavilyResults[0].real_images = allImages; 
    }

    res.json({
      keyword,
      tavilyData: { results: tavilyResults },
      // 深度打包给分析API使用的真实上下文
      realCrawlContext: {
        mideanRank: mideanRank.status === 'fulfilled' ? mideanRank.value : null,
        govData: govData.status === 'fulfilled' ? govData.value : null,
        officialImgs: officialImgs.status === 'fulfilled' ? officialImgs.value : null
      }
    });

  } catch (error) {
    // 全局兜底
    console.error("Search API Fatal Error:", error);
    res.status(500).json({ error: "服务器内部处理错误: " + error.message });
  }
};
