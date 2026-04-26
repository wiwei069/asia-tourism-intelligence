// api/search.js
const axios = require('axios');
const cheerio = require('cheerio');

const TAVILY_KEY = process.env.TAVILY_API_KEY;

// 1. 真实的 Tavily 搜索
async function queryTavily(keyword) {
  if (!TAVILY_KEY) throw new Error('TAVILY_API_KEY 未配置');
  
  console.log(`[Tavily] 正在搜索关键词: ${keyword}`);
  const { data } = await axios.post('https://api.tavily.com/search', {
    api_key: TAVILY_KEY,
    query: `${keyword} 旅游 文旅 策划 景区`, // 增加中文后缀提高命中率
    search_depth: 'basic',
    max_results: 8,
    include_image_descriptions: false,
    include_raw_content: false
  }, { timeout: 15000 });

  console.log(`[Tavily] 返回结果数:`, data.results?.length || 0);
  return data; // { results: [...], answer: '' }
}

// 2. 真实的微信/搜狗抓取 (不用代理，直接请求)
async function crawlWechat(keyword) {
  console.log(`[爬虫] 正在抓取微信搜狗: ${keyword}`);
  try {
    const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword + ' 文旅 运营 模式')}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(res.data);
    const results = [];
    
    // 解析微信列表
    $('#js_article .txt-box').each((i, el) => {
      if (i >= 5) return false; // 最多5条
      const title = $(el).find('h3 a').text().trim();
      let link = $(el).find('h3 a').attr('href');
      if (title && link) {
        // 微信链接通常是加密的，我们直接使用原始链接或展示搜狗的跳转页
        if (!link.startsWith('http')) link = 'https://weixin.sogou.com' + link;
        results.push({
          platform: '微信公众号',
          title,
          link,
          color: '#07c160'
        });
      }
    });
    
    console.log(`[爬虫] 微信抓取结果数:`, results.length);
    return results;
  } catch (e) {
    // 如果被反爬或超时，返回明确的错误信息，而不是空数组
    console.error(`[爬虫-微信] 抓取失败:`, e.message);
    // 即使失败，也返回一个包含错误提示的虚拟条目，让前端知道“这事干过”
    return [{
      platform: '微信公众号',
      title: `微信搜索"${keyword}" (请求受限或需验证)`,
      link: `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword)}`,
      color: '#999',
      isError: true
    }];
  }
}

// 3. 模拟小红书 (因为小红书有严格的反爬，这里用模拟数据代替实际请求，避免阻塞)
async function crawlXiaohongshu(keyword) {
  console.log(`[爬虫] 小红书模拟数据: ${keyword}`);
  return [{
    platform: '小红书',
    title: `【${keyword}】爆款笔记标题参考 (模拟演示)`,
    link: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`,
    color: '#ff2d55',
    isError: false
  }];
}

// 主处理函数
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, activeSources = ['wechat', 'xiaohongshu'] } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 并行执行：Tavily 搜索 + 社交爬虫
    const [tavilyRes, socialWechat, socialXhs] = await Promise.allSettled([
      queryTavily(keyword),
      activeSources.includes('wechat') ? crawlWechat(keyword) : Promise.resolve([]),
      activeSources.includes('xiaohongshu') ? crawlXiaohongshu(keyword) : Promise.resolve([])
    ]);

    // 处理 Tavily 结果
    if (tavilyRes.status === 'rejected') {
      throw new Error('Tavily 服务异常: ' + tavilyRes.reason.message);
    }
    const tavilyData = tavilyRes.value;

    // 收集所有数据
    const allLinks = new Set();
    tavilyData.results?.forEach(item => item.url && allLinks.add(item.url));
    
    const socialData = {};
    
    if (activeSources.includes('wechat')) {
      const list = socialWechat.status === 'fulfilled' ? socialWechat.value : [];
      socialData.wechat = list;
      list.forEach(item => item.link && allLinks.add(item.link));
    }
    if (activeSources.includes('xiaohongshu')) {
      const list = socialXhs.status === 'fulfilled' ? socialXhs.value : [];
      socialData.xiaohongshu = list;
      list.forEach(item => item.link && allLinks.add(item.link));
    }

    const linkListText = `===== 数据来源参考链接（共 ${allLinks.size} 条有效） =====\n` + 
      Array.from(allLinks).map((url, i) => `${i + 1}. ${url}`).join('\n');

    // 返回给前端
    res.json({ 
      success: true, 
      keyword, 
      tavilyData, 
      socialData, 
      linkList: linkListText 
    });

  } catch (err) {
    console.error('[API Search Error]:', err);
    res.status(500).json({ error: '服务端处理失败: ' + err.message });
  }
};
