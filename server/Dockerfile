# 辨是非 · 云托管 (CloudBase Run) 后端镜像
# 构建上下文：server/ 目录（在云托管「代码托管/GitHub」里把构建目录指到 server/）
FROM node:18-alpine

WORKDIR /app

# 先装依赖，利用层缓存
COPY package*.json ./
RUN npm install --omit=dev

# 拷贝源码
COPY . .

ENV NODE_ENV=production

# 云托管会注入 PORT 环境变量；默认 80。监听 0.0.0.0 供容器外访问。
EXPOSE 80
CMD ["node", "src/index.js"]
