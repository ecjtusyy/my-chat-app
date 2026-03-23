# My Chat App

一个简单的 AI 聊天应用，通过配置 API 即可与 AI 模型进行对话。
因为本人在买了api之后不知道要如何想网页版中聊天，故写了这一个简单的项目。
---

## 使用方法

### 1. 克隆项目

```bash
git clone https://github.com/ecjtusyy/my-chat-app.git
cd my-chat-app
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件，填入以下内容：

```env
API_KEY=你的_API_Key
API_URL=API_地址
MODEL_NAME=模型名称
```

例如：

```env
API_KEY=sk-xxxxxxxxxxxxxxxx
API_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o
```

### 4. 启动应用

```bash
npm start
```

启动后打开浏览器访问 `http://localhost:3000` 即可开始对话。
