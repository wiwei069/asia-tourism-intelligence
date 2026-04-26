// api/analyze.js
const axios = require('axios');

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = "qwen-max-latest";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(450).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData } = req.body;
  if (!keyword || !tavilyData) return res.status(400).json({ error: 'Keyword and Tavily data are required' });

  const items = tavilyData.results || [];
  if (items.length === 0) {
    return res.status(400).json({ error: '无有效文本数据，无法生成报告' });
  }

  try {
    // 提取前9个信源的内容喂给AI
    const context = items.slice(0, 9).map((r, i) => `[${i+1}. ${r.source}] ${r.title}\n链接: ${r.url}\n摘要: ${r.content || '详情见链接'}`).join('\n\n');

    const prompt = `你是一位严谨的文旅智库分析师。针对项目："${keyword}"，基于以下9大信源的**真实检索到的公开资料**，撰写《文旅大视界 | CULTURAL PANORAMA》研判报告。

【输入资料】
${context}

【要求】
1. 严禁凭空捏造数据。资料中没提的，写"公开披露不足"。
2. 严禁使用"网红"、"惊艳"等肤浅词汇。
3. 必须采用 Markdown 格式，包含以下结构：

### 1. 项目核心画像
### 2. 资源竞争力与对标
### 3. 运营模式研判
### 4. 风险与策略

输出风格冷静、克制、高密度。`;

    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是严谨的文旅智库分析师，只基于提供的9个信源事实输出报告，不捏造事实。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    }, {
      headers: { 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
      timeout: 60000
    });

    res.json({ report: response.data.choices[0].message.content });
  } catch (err) {
    console.error('[Analyze Error]:', err.message);
    res.status(500).json({ error: '深度分析生成失败: ' + err.message });
  }
};
