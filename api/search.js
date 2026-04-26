// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const http = axios.create({ timeout: 12000 });

const normalize = (str) => (str || '').replace(/\s+/g, '').toLowerCase();

// 保留原有的定向抓取逻辑（防止Tavily抽风时有兜底）
const fetchMeadin = async (kw) => {
  try {
    const { data } = await http.get(`https://www.meadin.com/search?q=${encodeURIComponent(kw)}`);
    const $ = cheerio.load(data);
    const list = [];
    $('.news-list li, .top-list li, .rank_list li').each((i, el) => {
      const a = $(el).find('a');
      const title = a.text().trim();
      const url = a.attr('href');
      if (title && title.length > 5) {
        list.push({ 
          title: title.substring(0, 60), 
          url: url?.startsWith('http') ? url : `https://www.meadin.com${url}`, 
          source: '迈点榜单' 
        });
      }
    });
    return list;
  } catch { return []; }
};

const fetchItjuzi = async (kw) => {
  try {
    const { data } = await http.get(`https://www.itjuzi.com/search?keyword=${encodeURIComponent(kw)}`);
    const $ = cheerio.load(data);
    const list = [];
    $('.list li, .item').each((i, el) => {
      const a = $(el).find('a');
      const title = a.text().trim();
      if (title) list.push({ title, url: a.attr('href') || '#', source: 'IT桔子' });
    });
    return list.slice(0, 3);
  } catch { return []; }
};

const fetchGov = async (kw) => {
  try {
    // 搜政策
    const { data } = await http.get(`https://zwgk.mct.gov.cn/search?q=${encodeURIComponent(kw)}&type=article`);
    const $ = cheerio.load(data);
    const list = [];
    $('.list li, .article-item').each((i, el) => {
      const a = $(el).find('a');
      const title = a.text().trim();
      if (title) list.push({ title, url: a.attr('href') || '#', source: '文旅部政策' });
    });
    return list.slice(0, 3);
  } catch { return []; }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // ===== 1. 核心：Tavily 全量抓取（移除所有时间限制） =====
    let allResults = [];
    try {
      const tvRes = await http.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: keyword + ' 旅游 文旅 景区 目的地',
        max_results: 9, // 拉满
        search_depth: 'advanced', // 深度抓取
        include_image_descriptions: false,
        // 删掉 days 和 search_dates，让它搜全部！
      }, { timeout: 15000 });

      if (tvRes.data?.results && Array.isArray(tvRes.data.results)) {
        allResults = tvRes.data.results;
      }
    } catch (e) {
      console.log('Tavily 报错:', e.message);
    }

    // ===== 2. 并行定向抓取 =====
    const [meadin, itjuzi, gov] = await Promise.all([
      fetchMeadin(keyword),
      fetchItjuzi(keyword),
      fetchGov(keyword)
    ]);

    // ===== 3. 合并去重 =====
    const map = new Map();
    
    // 优先塞入定向抓取的高质量数据
    [...meadin, ...itjuzi, ...gov].forEach(item => {
      const k = normalize(item.title);
      if (!map.has(k) && item.title.length > 2) map.set(k, item);
    });

    // 用Tavily补足
    allResults.forEach(item => {
      const k = normalize(item.title);
      if (!map.has(k) && item.title.length > 2) {
        map.set(k, { title: item.title, url: item.url, source: '全网资讯', content: item.content || '' });
      }
    });

    const final = Array.from(map.values()).slice(0, 9);

    // 哪怕只有1条也要返回，绝对不能报 "无信息"
    res.json({
      keyword,
      tavilyData: { 
        results: final.length > 0 ? final : [{
          title: `关于${keyword}的行业资讯聚合`,
          url: '#',
          source: '系统提示',
          content: '正在努力抓取最新动态...'
        }]
      }
    });

  } catch (error) {
    console.error('全量抓取错误:', error);
    res.status(500).json({ error: '服务器抓取失败: ' + error.message });
  }
};
