# 亚洲文旅智搜平台
基于Tavily搜索+通义千问的亚洲文旅项目研判系统，支持一键复制报告投喂NotebookLM。

## 一键部署步骤
1. **申请API Key**
   - Tavily：https://app.tavily.com/ 免费申请（每月1000次搜索）
   - 通义千问：https://dashscope.aliyun.com/ 免费申请

2. **推送代码到GitHub**
   - 新建GitHub仓库，将上述所有文件按路径上传

3. **Vercel一键部署**
   - 登录 https://vercel.com/ 点击「New Project」
   - 导入你的GitHub仓库
   - 在「Settings → Environment Variables」添加环境变量：
     | Key | Value |
     |-----|-------|
     | TAVILY_API_KEY | 你的Tavily Key |
     | DASHSCOPE_API_KEY | 你的通义千问 Key |
   - 点击「Deploy」，等待3分钟部署完成

4. **验证功能**
   - 访问分配的域名，输入关键词搜索
   - 生成报告后点击「一键复制」，粘贴到NotebookLM即可