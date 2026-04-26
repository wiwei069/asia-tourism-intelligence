// api/analyze.js
const axios = require('axios');

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = "qwen-max-latest";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { keyword, tavilyData, deepCrawlData } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

  try {
    // 构建“事实依据”文本块 (防止AI幻觉)
    const extractedInfo = tavilyData?.results?.slice(0, 5).map(r => r.content || r.snippet || '').join('\n') || '暂无';
    
    // 提取定向爬取的官网细节
    const siteContent = deepCrawlData?.detailContent || '暂无官网详细数据';
    const siteImages = deepCrawlData?.images || [];
    const sourceUrl = deepCrawlData?.prioritySource?.url || '未找到官网';

    // 构建强约束的 Prompt：强调“数据支撑”和“硬指标”
    const prompt = `
你是一名国家级文旅产业智库的首席分析师，具有极高的专业素养。你的任务是针对 **“${keyword}”** 撰写一份高密度的《文旅大视界 | CULTURAL PANORAMA 综合研判报告》。

【核心指令】
严禁假大空的形容词（如“震撼”、“唯美”、“网红打卡地”）。所有分析必须基于数据、政策和事实。以下是你的参考资料：

1. 【全网公开数据】: ${extractedInfo.substring(0, 1500)}
2. 【官网/政府网深度提取内容】: ${siteContent.substring(0, 2000)}
3. 【官网图片/视觉证据】: 官网提供了 ${siteImages.length} 张实景图，这反映了其在视觉呈现和设施更新上的投入力度。
4. 【权威参考】: 国家5A级景区评定标准强调“资源吸引力、设施完善度、服务质量、游客满意度”；国家级旅游休闲街区强调“文化主题鲜明、商业业态丰富、夜间经济活跃”。

【报告输出结构】(直接输出Markdown，不要包含思考过程)

### 1. 项目概况与核心指标 (TITLE: 文旅大视界 | PROJECT OVERVIEW)
- 项目定位：从提取的内容中提炼其官方定位（如：城市会客厅、非遗活化区、亲子度假目的地）。
- 关键硬指标：尝试提取或推断面积（${siteContent.includes('亩') || siteContent.includes('万㎡') ? '含面积数据' : '需估算'}）、总投资额、年客流量（如有）。若无具体数字，注明“公开数据暂未披露”。

### 2. 政策合规性与对标分析 (TITLE: 文旅大视界 | POLICY ALIGNMENT)
- 对标5A/国家级街区：分析其在“公共服务（厕所、导览）”、“文化挖掘”、“智慧旅游”方面与国家标准的契合度。
- 依据官网图片（${siteImages.length > 5 ? '较多' : '较少'}）判断其硬件设施的新旧程度和国际化水平。

### 3. 市场竞争力与运营策略 (TITLE: 文旅大视界 | MARKET INSIGHT)
- 内容策略：基于全网数据和官网内容，分析其IP打造、演艺活动、节庆营销的具体打法（不要只说“做了活动”，要说“依托${keyword}的X文化，打造了Y实景演艺产品”）。
- 营收逻辑：分析其二次消费（餐饮、住宿、零售）的占比潜力。

### 4. 舆情口碑与风险预警 (TITLE: 文旅大视界 | RISK ALERT)
- 潜在风险：基于公开信息，指出其面临的挑战（如：同质化竞争、同质化建筑、季节性问题、交通承载力）。
- 改进建议：给出1条具体的、可执行的政府或企业端建议（例如：建议增加多语种导览以提升国际客源占比）。

【输出风格】
- 冷静、客观、高密度信息。
- 多使用分点陈述和数据逻辑。
- 体现智库报告的权威感。
`;

    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个严谨的文旅产业智库分析师，只讲事实和数据。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3 // 降低随机性，追求准确
    }, {
      headers: { 
        'Authorization': `Bearer ${DASHSCOPE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    });

    const report = response.data.choices[0].message.content;
    res.json({ report });

  } catch (err) {
    console.error('[Analyze Error]:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI 生成失败: ' + (err.response?.data?.message || err.message) });
  }
};
