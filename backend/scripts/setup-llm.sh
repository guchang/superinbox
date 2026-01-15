#!/bin/bash

# SuperInbox - LLM 配置脚本

echo "======================================"
echo "SuperInbox Core - LLM 配置向导"
echo "======================================"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "错误: .env 文件不存在，正在从 .env.example 复制..."
    cp .env.example .env
fi

echo "请选择你的 LLM 提供商:"
echo "1) DeepSeek (推荐 - 性价比高，中文友好)"
echo "2) OpenAI (GPT-4/GPT-3.5)"
echo "3) 智谱 AI (GLM)"
echo "4) 自定义 (兼容 OpenAI API)"
echo ""
read -p "请输入选项 [1-4]: " provider_choice

case $provider_choice in
  1)
    # DeepSeek
    provider="deepseek"
    base_url="https://api.deepseek.com/v1"
    model="deepseek-chat"
    echo ""
    echo "你选择了 DeepSeek"
    echo "获取 API Key: https://platform.deepseek.com/api_keys"
    ;;
  2)
    # OpenAI
    provider="openai"
    base_url="https://api.openai.com/v1"
    model="gpt-4"
    echo ""
    echo "你选择了 OpenAI"
    echo "获取 API Key: https://platform.openai.com/api-keys"
    ;;
  3)
    # 智谱 AI
    provider="zhipu"
    base_url="https://open.bigmodel.cn/api/paas/v4"
    model="glm-4"
    echo ""
    echo "你选择了智谱 AI"
    echo "获取 API Key: https://open.bigmodel.cn/usercenter/apikeys"
    ;;
  4)
    # 自定义
    provider="custom"
    read -p "请输入 Base URL: " base_url
    read -p "请输入模型名称: " model
    echo ""
    echo "你选择了自定义配置"
    ;;
  *)
    echo "无效选项，退出..."
    exit 1
    ;;
esac

echo ""
read -p "请输入你的 API Key: " api_key

if [ -z "$api_key" ]; then
  echo "错误: API Key 不能为空"
  exit 1
fi

# 更新 .env 文件
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s|^LLM_PROVIDER=.*|LLM_PROVIDER=$provider|" .env
  sed -i '' "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
  sed -i '' "s|^LLM_MODEL=.*|LLM_MODEL=$model|" .env
  sed -i '' "s|^LLM_BASE_URL=.*|LLM_BASE_URL=$base_url|" .env
else
  # Linux
  sed -i "s|^LLM_PROVIDER=.*|LLM_PROVIDER=$provider|" .env
  sed -i "s|^LLM_API_KEY=.*|LLM_API_KEY=$api_key|" .env
  sed -i "s|^LLM_MODEL=.*|LLM_MODEL=$model|" .env
  sed -i "s|^LLM_BASE_URL=.*|LLM_BASE_URL=$base_url|" .env
fi

echo ""
echo "======================================"
echo "配置完成！"
echo "======================================"
echo "提供商: $provider"
echo "模型: $model"
echo "Base URL: $base_url"
echo ""
echo "下一步:"
echo "1. 运行 'npm run db:migrate' 初始化数据库"
echo "2. 运行 'npm run dev' 启动开发服务器"
echo "3. 使用 'examples/curl-examples.sh' 测试 API"
echo "======================================"
