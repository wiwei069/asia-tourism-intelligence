// api/analyze.js
const axios = require('axios');
const cheerio = require('cheerio');

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY; // 阿里云百炼 Key
const MODEL = "qwen-max-latest"; // 使用通义千问最新模型

// 辅助函数：抓取特定网页内容（用于模拟获取权威数据）
async function fetchWebContent(url, selector) {
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);
    const items = [];
    $(selector).each((i, el) => {
      if (i < 10) { // 限制数量
        items.push($(el).text().trim().replace(/\s+/g, ' '));
      }
    });
    return items.join(' | ');
  } catch (e) {
    return `获取数据失败: ${e.message}`;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, socialData, linkList } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 1. 获取文旅部及榜单的“背景知识” (这里简化逻辑，实际需对应真实API或页面抓取)
    const culturalTourismData = `参考背景：文旅部最新发布的5A级旅游景区名单包括北京颐和园、杭州西湖等，强调文化赋能与沉浸式体验。国家级旅游休闲街区侧重于夜间经济与非遗活化。`;
    
    // 模拟：迈点月度榜单 (实际项目中替换为迈点API Key调用)
    const mideanRanking = `参考行业榜单：迈点研究院本月发布的《景区品牌传播力TOP10》显示，头部项目在短视频营销、IP联动、研学旅行板块得分较高，强调数据化运营。`;
    
    // 模拟：携程口碑摘要
    const ctripReviews = `参考用户口碑：携程数据显示，高口碑景区普遍在“交通便利度”、“导览清晰度”、“卫生状况”及“性价比”维度评分突出，用户反感隐形消费与过度商业化。`;

    // 提取搜索到的真实内容片段
    const extractedInfo = tavilyData.results?.slice(0, 5).map(r => r.content || r.snippet || '').join('\n') || '暂无详细网页内容';

    // 2. 构建强约束的 AI Prompt
    const prompt = `
你是一位资深的文旅产业分析师，具有10年以上政府规划与商业地产咨询经验。

任务：针对 **“${keyword}”** 项目，撰写一份专业的《文旅大视界 | CULTURAL PANORAMA》综合研判报告。

输入资料：
- 网络搜索摘要：${extractedInfo.substring(0, 1000)}...
- 权威背景：${culturalTourismData}
- 行业榜单：${mideanRanking}
- 用户口碑：${ctripReviews}

报告结构要求（直接输出以下结构，不要包含"思考过程"）：

### 1. 项目定位与核心卖点 (TITLE: 文旅大视界 | PROJECT OVERVIEW)
结合${keyword}的项目特点，对标文旅部国家级标准，分析其差异化的核心吸引力。

### 2. 权威对标与政策契合度 (TITLE: 文旅大视界 | POLICY ALIGNMENT)
分析该项目是否符合当前国家级旅游休闲街区或5A景区的评定导向（如：文化挖掘深度、公共服务设施、夜间经济场景）。

### 3. 市场热度与品牌传播力 (TITLE: 文旅大视界 | BRAND HEAT)
参考迈点研究院榜单逻辑，从品牌曝光、营销打法、IP运营三个维度分析该项目的市场声量。

### 4. 用户口碑与体验洞察 (TITLE: 文旅大视界 | USER INSIGHTS)
基于类似携程平台的用户评价逻辑，推演目标客群对该项目的潜在评价重点（优点与痛点）。

### 5. 风险预警与运营建议 (TITLE: 文旅大视界 | RISK & STRATEGY)
给出3条具体的运营提升建议，避免假大空，要有落地性。

输出要求：
- 使用 Markdown 格式。
- 整体风格专业、客观、有数据支撑逻辑。
- 体现“文旅大视界”的高端智库调性。
`;

    // 3. 调用阿里云通义千问
    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的文旅产业分析师。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: { 
        'Authorization': `Bearer ${DASHSCOPE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const report = response.data.choices[0].message.content;
    res.json({ report });

  } catch (err) {
    console.error('[Analyze Error]:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI 生成失败: ' + (err.response?.data?.message || err.message) });
  }
};
