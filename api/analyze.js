const { DashScope } = require('@alicloud/dashscope-sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, socialData, linkList } = req.body;
  const DASH_KEY = process.env.DASHSCOPE_API_KEY;

  if (!DASH_KEY) return res.status(500).json({ error: '未配置 DASHSCOPE_API_KEY' });

  const dashscope = new DashScope({ apiKey: DASH_KEY });

  const prompt = `你是一位资深的亚洲文旅项目分析师。请根据以下关于「${keyword}」的搜索与社交数据，撰写一份《文旅项目综合研判报告》。

【要求】
1. 结构：项目概况 -> 数据与动态 -> 舆情热度 -> SWOT -> 投资/运营建议。
2. 格式：输出标准HTML代码。标题用<h3>，段落用<p>，要点用<ul><li>。
3. 务必提取具体名称（区位、投资方等）。
4. 报告末尾加上参考链接。

【数据输入】
- 网页检索: ${JSON.stringify(tavilyData?.results || []).slice(0, 2000)}
- 社交讨论: ${JSON.stringify(socialData || {}).slice(0, 1000)}
- 链接列表: ${linkList || 'N/A'}
`;

  try {
    const result = await dashscope.textGeneration({
      model: 'qwen-turbo',
      input: { prompt },
      parameters: { max_tokens: 3000, temperature: 0.5 }
    });

    let reportHtml = result.output.text || '<p>生成内容为空</p>';
    
    if (!reportHtml.includes('参考链接')) {
      reportHtml += `<hr><h4>参考链接</h4><ul>${linkList.split('\n').filter(l => l.startsWith('http')).map(l => `<li><a href="${l}">${l}</a></li>`).join('')}</ul>`;
    }

    res.json({ success: true, report: reportHtml });
  } catch (e) {
    res.status(500).json({ error: '通义千问生成失败: ' + e.message });
  }
};