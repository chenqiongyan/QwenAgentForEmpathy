const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* ====== 环境变量 ====== */
const API_KEY = process.env.QwenAgent_API_KEY; 
const APP_ID = process.env.QwenAgent_APP_ID;

// 调试：检查环境变量
console.log("环境变量检查:", {
  hasQwenAgent_API_KEY: !!API_KEY,
  hasQwenAgent_APP_ID: !!APP_ID,
  apiKeyLength: API_KEY ? API_KEY.length : 0,
  appIdLength: APP_ID ? APP_ID.length : 0
});

const DASH_URL = `https://dashscope.aliyuncs.com/api/v1/apps/${APP_ID}/completion`;

/* ====== 简单防刷 ====== */
const LIMIT = 5;
const ipCounter = new Map();

/* ====== 健康检查端点 ====== */
app.get("/", (req, res) => {
  res.json({
    service: "Qwen Agent for Empathy",
    status: "running",
    endpoints: {
      chat: "POST /chat",
      health: "GET /health"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    env: {
      hasApiKey: !!API_KEY,
      hasAppId: !!APP_ID,
      nodeVersion: process.version
    }
  });
});

/* ====== 代理接口 ====== */
app.post("/chat", async (req, res) => {
  console.log("收到 /chat 请求:", { 
    ip: req.ip, 
    prompt: req.body.prompt,
    bodyLength: JSON.stringify(req.body).length
  });

  // 检查环境变量
  if (!API_KEY || !APP_ID) {
    console.error("缺少环境变量:", { API_KEY: !!API_KEY, APP_ID: !!APP_ID });
    return res.status(500).json({ 
      error: "服务器配置错误",
      message: "缺少 API_KEY 或 APP_ID 环境变量"
    });
  }

  const ip = req.ip;
  const count = ipCounter.get(ip) || 0;

  if (count >= LIMIT) {
    return res.status(429).json({ error: "超过最大对话次数（5次）" });
  }

  ipCounter.set(ip, count + 1);

  try {
    console.log("调用通义千问 API, URL:", DASH_URL);
    
    const response = await fetch(DASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: { prompt: req.body.prompt },
        parameters: {},
        debug: {}
      })
    });

    console.log("API 响应状态:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API 错误响应:", errorText);
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    console.log("API 成功响应");

    res.json({
      reply: data.output?.text || "无回复内容",
      remaining: LIMIT - (count + 1)
    });

  } catch (e) {
    console.error("服务器错误:", e.message);
    res.status(500).json({ 
      error: "server error",
      message: e.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});