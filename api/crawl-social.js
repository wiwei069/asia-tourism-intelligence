// api/crawl-ranking.js
const axios = require('axios');
const cheerio = require('cheerio');

// 创建一个带严格超时的实例（解决“长时间无反应”）
const http = axios.create({
  timeout: 8000, // 8秒超时，到点立刻放弃，绝不卡死
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  maxContentLength: 500000, // 限制最大响应体积，防止内存溢出
  maxBodyLength: 500000
});

async function safeFetch(url) {
  try {
    const res = await http.get(url);
    return res.data || '';
  } catch (err) {
    console.log(`抓取失败/超时: ${url}`);
    return ''; // 静默失败，返回空字符串
  }
}

// 核心：抓取迈点研究院公开榜单
async function fetchMideanRanking() {
  const url = 'https://www.meadin.com/top/'; // 假设的公开榜单页（需替换为实际真实URL）
  const html = await safeFetch(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const list = [];

  // 这里需要根据实际网页结构调整 Selector
  // 假设榜单在一个 class 为 .ranking-list 的表格里
  $('.ranking-list li, .ranking-list tr').each((i, el) => {
    if (i >= 10) return; // 只取前10
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 5) {
      list.push({
        rank: i + 1,
        name: text.substring(0, 30), // 截取名称
        category: '文旅综合' // 可根据文本推断
      });
    }
  });
  return list;
}

// 抓取研究报告摘要（公开免费的部分）
async function fetchResearchAbstract(keyword) {
  const searchUrl = `https://www.meadin.com/search?q=${encodeURIComponent(keyword)}`;
  const html = await safeFetch(searchUrl);
  if (!html) return { title: '', summary: '' };

  const $ = cheerio.load(html);
  let title = '';
  let summary = '';

  // 假设研究报告在一个 .article-detail 的 div 里
  const article = $('.article-detail, .news-detail').first();
  title = article.find('h1').text().trim() || '相关行业研报';
  
  // 提取前3段作为摘要
  article.find('p').slice(0, 3).each((i, p) => {
    summary += $(p).text().trim() + ' ';
  });

  return { title, summary: summary.substring(0, 500) };
}

module.exports = { fetchMideanRanking, fetchResearchAbstract };
