// api/analyze.js
const axios = require('axios');

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = "qwen-max-latest";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData } = req.body;
  if (!keyword || !tavilyData) return res.status(400).json({ error: 'Keyword and Tavily data are required' });

  const items = tavilyData.results || [];
  
  // 如果前端传过来的是空结果，提示无法生成
  if (items.length === 0) {
    return res.status(400).json({ error: '无法生成报告：缺少必要的公开数据来源（Tavily 结果为空）。请尝试其他关键词或检查 API 状态。' });
  }

  try {
    // 提取真实内容喂给 AI（确保 AI 基于事实，不瞎编）
    const context = items.map((r, i) => `[${i+1}] ${r.title}\n摘要: ${r.content || r.snippet || '无'}`).join('\n\n');

    const prompt = `
你是一位严谨的文旅产业智库分析师。针对项目："${keyword}"，基于以下**真实检索到的公开资料**，撰写一份《文旅大视界 | CULTURAL PANORAMA》研判报告。

【输入资料】
${context}

【要求】
1. 严禁凭空捏造投资额、面积等硬数据。如果资料中没提，写"公开披露不足"。
2. 严禁使用"网红"、"震撼"等肤浅词汇。
3. 必须采用 Markdown 格式，包含以下结构：

### 1. 项目核心画像 (TITLE: 文旅大视界)
### 2. 资源竞争力与对标 (TITLE: 文旅大视界)
### 3. 运营模式研判 (TITLE: 文旅大视界)
### 4. 风险与策略 (TITLE: 文旅大视界)

输出风格冷静、克制、高密度。
`;

    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是严谨的文旅智库分析师，只基于提供的资料输出报告，不捏造事实。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    }, {
      headers: { 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
      timeout: 60000
    });

    res.json({ report: response.data.choices[0].message.content });

  } catch (err) {
    console.error('[Analyze Error]:', err.response?.data || err.message);
    res.status(500).json({ error: '深度分析生成失败: ' + (err.message || '未知错误') });
  }
};
