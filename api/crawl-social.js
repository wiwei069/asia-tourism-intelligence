const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// 微信搜狗搜索
async function crawlWechat(keyword) {
  try {
    const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword + ' 文旅 运营 投资')}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 6000 });
    const $ = cheerio.load(res.data);
    const results = [];
    $('#js_article .txt-box').each((i, el) => {
      if (i >= 5) return false;
      const title = $(el).find('h3 a').text().trim();
      let link = $(el).find('h3 a').attr('href');
      if (title && link) {
        link = link.startsWith('http') ? link : `https://weixin.sogou.com${link}`;
        results.push({ platform: '微信公众号', title, link, icon: 'fa-weixin', color: '#07c160' });
      }
    });
    return results;
  } catch (e) {
    return []; // 静默失败
  }
}

// 小红书轻量模拟
async function crawlXiaohongshu(keyword) {
  return [{
    platform: '小红书',
    title: `关于【${keyword}】的热门文旅打卡笔记 (模拟数据-仅演示展示)`,
    link: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`,
    icon: 'fa-book-open',
    color: '#ff2d55'
  }];
}

module.exports = { crawlWechat, crawlXiaohongshu };