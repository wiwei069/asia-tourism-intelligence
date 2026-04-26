// api/analyze.js
const axios = require('axios');

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = "qwen-max-latest";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, realCrawlContext } = req.body;
  if (!keyword || !tavilyData) return res.status(400).json({ error: 'Keyword and Tavily data are required' });

  try {
    // 把真实爬虫结果转化为给 AI 的文本提示
    const mideanText = realCrawlContext?.mideanRank?.list 
      ? `迈点月度榜单前3名: ${realCrawlContext.mideanRank.list.slice(0,3).map(i => i.name).join('、')}`
      : '迈点榜单暂时未抓取到';

    const govText = realCrawlContext?.govData?.items 
      ? `政府公开文件提及: ${realCrawlContext.govData.items.map(i => i.title).join('；')}`
      : '政府网暂无匹配文件';

    const imgText = realCrawlContext?.officialImgs?.images?.length > 0
      ? `官网实拍图片共 ${realCrawlContext.officialImgs.images.length} 张，显示设施完善`
      : '无官方实拍图';

    const tavilySnippet = tavilyData.results?.slice(0, 3).map(r => r.title).join('；') || '无';

    const prompt = `
你是一位严肃、只讲事实的文旅智库分析师。
请基于以下**真实爬取**的情报数据，对“${keyword}”撰写《文旅大视界 | CULTURAL PANORAMA》深度研判报告。

【真实情报依据】
1. 【全网动态】${tavilySnippet}
2. 【行业榜单】${mideanText}
3. 【政府背书】${govText}
4. 【实勘影像】${imgText}

【输出要求】
- 严禁使用“惊艳”、“绝美”、“网红”等空洞形容词。
- 报告必须包含：项目定位、硬指标分析（参考5A标准）、市场竞品对标（基于迈点榜单）、风险预警。
- 如果上面的“真实情报依据”显示数据缺失，请在对应章节明确指出“公开披露不足”。
- 输出严格使用 Markdown。

【报告结构】
### 1. 项目核心定位与价值 (TITLE: 文旅大视界 | POSITIONING)
### 2. 硬指标对标与设施水平 (TITLE: 文旅大视界 | HARD METRICS)
### 3. 行业竞争格局 (TITLE: 文旅大视界 | COMPETITION)
### 4. 风险与策略 (TITLE: 文旅大视界 | RISK & STRATEGY)
`;

    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是严肃的政策与商业分析师，只输出基于事实和数据的报告，拒绝任何形式的文学修辞。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1 // 追求极致准确
    }, {
      headers: { 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
      timeout: 90000
    });

    res.json({ report: response.data.choices[0].message.content });

  } catch (err) {
    console.error('[Analyze Error]:', err.response?.data || err.message);
    res.status(500).json({ error: '大模型分析失败: ' + (err.message || '未知错误') });
  }
};
