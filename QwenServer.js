const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // Node 18+ 可以不装，低版本需要 npm install node-fetch

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* ====== 环境变量 ====== */
const API_KEY = process.env.QwenAgent_API_KEY; 
const APP_ID = process.env.QwenAgent_APP_ID;

const DASH_URL = `https://dashscope.aliyuncs.com/api/v1/apps/${APP_ID}/completion`;

/* ====== 简单防刷 ====== */
const LIMIT = 5;
const ipCounter = new Map();

/* ====== 代理接口 ====== */
app.post("/chat", async (req, res) => {
  const ip = req.ip;
  const count = ipCounter.get(ip) || 0;

  if (count >= LIMIT) {
    return res.status(429).json({ error: "超过最大对话次数（5次）" });
  }

  ipCounter.set(ip, count + 1);

  try {
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

    const data = await response.json();

    res.json({
      reply: data.output.text,
      remaining: LIMIT - (count + 1)
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
