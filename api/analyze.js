const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, socialData, linkList } = req.body;
  const DASH_KEY = process.env.DASHSCOPE_API_KEY;

  if (!DASH_KEY) return res.status(500).json({ error: '未配置 DASHSCOPE_API_KEY 环境变量' });

  // 构建给大模型的 Prompt
  const prompt = `你是一位资深的亚洲文旅项目投资分析师。请根据以下关于「${keyword}」的公开网络数据和社交讨论，撰写一份专业的《文旅项目综合研判分析报告》。

【报告结构与要求】
1. 输出格式：必须是纯 HTML 代码，不要包含任何 Markdown 符号（如 \`\`\`html\`\`\`）。
2. 结构层级：使用 <h3> 作为主标题，<p> 作为正文，<ul><li> 作为要点。
3. 逻辑板块：包含“项目概况”、“核心数据”、“SWOT 分析”、“投资与运营建议”。
4. 关键信息：尝试提取具体的地域、区位、核心投资方或运营主体。
5. 文末附录：必须包含一个 <hr>，并在下面列出“参考来源链接”。

【输入数据】
- 网络检索摘要: ${JSON.stringify(tavilyData?.results || []).slice(0, 3000)}
- 社交媒体舆情: ${JSON.stringify(socialData || {}).slice(0, 1500)}
- 原始链接列表: ${linkList || 'N/A'}
`;

  try {
    // 核心改动：直接调用 OpenAI 兼容接口，而非旧版 SDK
    const result = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model: 'qwen-turbo', // 或 qwen-plus
        messages: [
          { role: 'system', content: '你是一个专业的文旅行业AI分析师。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.6
      },
      {
        headers: {
          'Authorization': `Bearer ${DASH_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 百炼大模型可能需要多一点时间
      }
    );

    // 解析返回的文本
    const reportHtml = result.data?.choices?.[0]?.message?.content?.trim() || '<p>AI返回内容为空，请重试或调整提示词。</p>';

    // 确保包含链接，如果AI忘记了，强制补充
    const finalReport = reportHtml.includes('参考来源') 
      ? reportHtml 
      : reportHtml + `<hr><h4>参考来源链接</h4><ul>${linkList.split('\n').filter(l => l.startsWith('http')).map(l => `<li><a href="${l}">${l}</a></li>`).join('')}</ul>`;

    res.json({ success: true, report: finalReport });

  } catch (e) {
    console.error('[DashScope API Error]:', e.response?.data || e.message);
    res.status(500).json({ 
      error: '通义千问接口调用失败', 
      detail: e.response?.data?.error?.message || e.message 
    });
  }
};
