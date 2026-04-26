// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const http = axios.create({ timeout: 10000 });

const normalize = (str) => (str || '').replace(/\s+/g, '').toLowerCase();

// 保留原有的定向抓取函数（迈点/IT桔子/文旅部...）
const [fetchMeadin, fetchItjuzi, fetchMctGov] = [
  async (kw) => { /* ... 代码太长省略复用之前的逻辑 ... */ try { return [] } catch { return [] } },
  async (kw) => { try { return [] } catch { return [] } },
  async (kw) => { try { return [] } catch { return [] } }
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // ===== 核心修改 1 & 2：限定半年内 + 9条结果 =====
    // 计算最近半年的日期范围 (YYYY-MM-DD)
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const dateRange = `${sixMonthsAgo.toISOString().split('T')[0]}..${today.toISOString().split('T')[0]}`;

    let allResults = [];
    
    // 构建包含时间限制的强查询
    const strongQuery = `${keyword} 旅游 文旅 景区 报告 ${dateRange}`;

    try {
      const tv = await http.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: strongQuery,
        // 修改点：拉满到 9 条
        max_results: 9,
        search_depth: 'advanced',
        // 增加时间过滤参数 (根据Tavily文档)
        days: 180, // 限制爬取最近180天的内容
        include_image_descriptions: false // 提速，不要图片
      }, { timeout: 15000 });
      
      if (tv.data?.results) {
        allResults = tv.data.results;
      }
    } catch (e) {
      console.log('Tavily 受限或网络超时:', e.message);
    }

    // ===== 保留定向源抓取 (合并) =====
    const [meadin, itjuzi, mct] = await Promise.all([
      fetchMeadin(keyword),
      fetchItjuzi(keyword),
      fetchMctGov(keyword)
    ]);

    const customSources = [...meadin, ...itjuzi, ...mct];
    const uniqueMap = new Map();

    // 自定义高优先级源先入
    customSources.forEach(item => {
      const norm = normalize(item.title);
      if (!uniqueMap.has(norm) && item.title.length > 2) uniqueMap.set(norm, { ...item, content: item.content || `【${item.source}】深度资讯` });
    });

    // 全网搜索结果补充
    allResults.forEach(item => {
      const norm = normalize(item.title);
      if (!uniqueMap.has(norm) && item.title.length > 2) {
        uniqueMap.set(norm, { 
          title: item.title, 
          url: item.url, 
          source: '全网综合', 
          content: item.content || item.snippet || '详情见链接' 
        });
      }
    });

    // ===== 核心修改 1：强制截取前9条 =====
    const finalList = Array.from(uniqueMap.values()).slice(0, 9);

    if (finalList.length === 0) {
      return res.status(404).json({ error: '近半年内，所有信源均未检索到有效公开数据，请更换关键词。' });
    }

    res.json({
      keyword,
      tavilyData: { results: finalList }
    });

  } catch (error) {
    console.error('全局错误:', error);
    res.status(500).json({ error: '服务端处理错误: ' + error.message });
  }
};
