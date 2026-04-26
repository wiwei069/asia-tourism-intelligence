// api/analyze.js
const axios = require('axios');
const { fetchResearchAbstract } = require('./crawl-ranking');

const DASHSCOPE_KEY = process.env.DASHSCOPE_KEY || process.env.DASHSCOPE_API_KEY;
const MODEL = "qwen-max-latest";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, rankingData } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 获取该关键词对应的研报摘要
    const research = await fetchResearchAbstract(keyword);
    
    // 提取竞品或标杆项目名称
    const topNames = rankingData?.list?.slice(0, 3).map(item => item.name).join('、') || '行业头部项目';

    const prompt = `
你是一位严谨的文旅智库分析师。请基于以下**“仅限公开免费获取”**的资料，撰写关于 **“${keyword}”** 的《文旅大视界 | CULTURAL PANORAMA》研判报告。

【输入资料】
1. 网络检索 (Tavily): ${tavilyData.results?.slice(0,3).map(r => r.title).join(', ') || '暂无'}
2. 行业月度标杆榜 (公开榜单): ${rankingData?.list?.map(r => r.rank + '.' + r.name).join(', ') || '暂无数据'}
3. 行业研报摘要: ${research.summary || '暂无公开研报文本'}

【报告结构】(直接输出Markdown，不要包含思考过程)

### 1. 项目定位与对标 (TITLE: 文旅大视界 | PROJECT OVERVIEW)
结合研报摘要与检索结果，定义项目的核心定位。

### 2. 行业标杆对比 (TITLE: 文旅大视界 | BENCHMARKING)
重点参考榜单中的 ${topNames}，从产品差异、运营模式两个维度进行客观对比。严禁虚构数据，如无具体客流量数据，需写明“公开披露不足”。

### 3. 趋势洞察 (TITLE: 文旅大视界 | TREND INSIGHTS)
基于迈点榜单反映出的共性特征（如：夜经济、国潮、重资产改造），分析该细分领域的整体走势。

### 4. 风险与落地策略 (TITLE: 文旅大视界 | STRATEGY)
给出2条具有实操性的建议，策略需符合当前宏观经济及文旅政策导向。

【输出要求】
- 语气客观、高密度、智库风格。
- 所有提及的数据必须有来源标注（如：源自榜单、源自研报）。
`;

    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的文旅分析师，只讲事实，不讲假话。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2 // 越低越严谨
    }, {
      headers: { 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
      timeout: 60000
    });

    res.json({ report: response.data.choices[0].message.content });

  } catch (err) {
    console.error('[Analyze Error]:', err.response?.data || err.message);
    res.status(500).json({ error: '生成失败: ' + (err.message || '未知错误') });
  }
};
