// api/crawl-target.js
const axios = require('axios');
const cheerio = require('cheerio');

// 辅助函数：获取页面HTML
async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return data;
  } catch (e) {
    return null;
  }
}

// 核心函数：定向抓取目标详情 (优先级：官网 > 政府文旅 > 政府新闻 > 舆情)
async function deepCrawlTarget(keyword) {
  // 1. 先用 Tavily 找潜在链接 (包含官网标识)
  const searchRes = await axios.post('https://api.tavily.com/search', {
    api_key: process.env.TAVILY_API_KEY,
    query: `${keyword} 官网 旅游`,
    include_image_descriptions: true,
    max_results: 8
  }).catch(() => null);

  const rawResults = searchRes?.data?.results || [];
  
  // 2. 分类链接 (模拟优先级排序)
  let officialSite = null;
  let govCultural = [];
  let govNews = [];
  let other = [];

  rawResults.forEach(r => {
    const url = r.url || '';
    const title = r.title || '';
    // 简单规则判断
    if (url.includes('gov.cn') && (url.includes('culture') || url.includes('tour'))) govCultural.push({...r, type: 'gov_cultural'});
    else if (url.includes('gov.cn')) govNews.push({...r, type: 'gov_news'});
    else if (url.includes(keyword.replace(/[^\w]/g, '')) && (url.includes('com') || url.includes('cn'))) officialSite = {...r, type: 'official'};
    else other.push({...r, type: 'other'});
  });

  // 3. 按优先级选择目标页面进行深度抓取
  const targetPage = officialSite || govCultural[0] || govNews[0] || rawResults[0];
  let detailHtml = null;
  let extractedImages = [];

  if (targetPage?.url) {
    detailHtml = await fetchHTML(targetPage.url);
  }

  // 4. 如果是官网，拼命捞图片 (5-8张)
  if (detailHtml && targetPage?.type === 'official') {
    const $ = cheerio.load(detailHtml);
    // 抓取所有可能的图片链接
    const allImgs = [];
    $('img').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('/')) src = targetPage.url + src;
        if (src.startsWith('http') && !src.includes('base64')) {
          allImgs.push(src);
        }
      }
    });
    // 去重，取前8张
    extractedImages = [...new Set(allImgs)].slice(0, 8);
  }

  // 5. 整理返回数据
  return {
    detailContent: extractTextFromHtml(detailHtml, targetPage?.url), // 提取正文
    images: extractedImages,
    prioritySource: targetPage,
    relatedLinks: [officialSite, ...govCultural, ...govNews].filter(Boolean).slice(0, 5)
  };
}

// 提取正文内容 (去除广告导航)
function extractTextFromHtml(html, url) {
  if (!html) return '';
  const $ = cheerio.load(html);
  // 移除脚本、样式
  $('script, style, nav, header, footer, iframe, .ad, .banner').remove();
  // 针对政府网站和官网的特定清理
  const text = $('body').text() || '';
  return text.replace(/\s+/g, ' ').trim().substring(0, 2000); // 截取前2000字
}

module.exports = { deepCrawlTarget };
