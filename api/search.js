const axios = require('axios');
const { crawlWechat, crawlXiaohongshu } = require('./crawl-social');

const TAVILY_KEY = process.env.TAVILY_API_KEY;

async function queryTavily(keyword) {
  if (!TAVILY_KEY) throw new Error('Missing TAVILY_API_KEY');
  try {
    const { data } = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_KEY,
      query: `${keyword} 旅游 文旅 项目 策划 建设 运营`,
      search_depth: 'basic',
      max_results: 8
    }, { timeout: 10000 });
    return data;
  } catch (e) {
    console.error('[Tavily Error]', e.message);
    return { results: [], answer: '' };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, activeSources = ['wechat', 'xiaohongshu'] } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    const [tavilyRes, socialWechat, socialXhs] = await Promise.allSettled([
      queryTavily(keyword),
      activeSources.includes('wechat') ? crawlWechat(keyword) : Promise.resolve([]),
      activeSources.includes('xiaohongshu') ? crawlXiaohongshu(keyword) : Promise.resolve([])
    ]);

    const tavilyData = tavilyRes.status === 'fulfilled' ? tavilyRes.value : { results: [], answer: '' };
    
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

    const linkListText = `===== 参考来源链接（共 ${allLinks.size} 条）=====\n` + 
      Array.from(allLinks).map((u, i) => `${i + 1}. ${u}`).join('\n');

    res.json({ success: true, keyword, tavilyData, socialData, linkList: linkListText });
  } catch (err) {
    res.status(500).json({ error: '服务端处理失败' });
  }
};