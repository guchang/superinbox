#!/bin/bash

# SuperInbox 启动脚本
# 功能: 检查端口占用,提供选项停止占用进程,然后启动前后端服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 端口配置
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
WEB_DIR="$PROJECT_ROOT/web"

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/.frontend.pid"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local service_name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti :$port)
        local command=$(ps -p $pid -o command= 2>/dev/null || echo "Unknown")

        log_warning "端口 $port ($service_name) 已被占用"
        echo "  进程 PID: $pid"
        echo "  进程命令: $command"
        return 0
    else
        return 1
    fi
}

# 停止占用端口的进程
kill_port_process() {
    local port=$1
    local service_name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti :$port)
        log_info "正在停止占用端口 $port 的进程 (PID: $pid)..."

        if kill -9 $pid 2>/dev/null; then
            log_success "已停止进程 $pid"
            sleep 1
        else
            log_error "无法停止进程 $pid,请尝试手动停止"
            return 1
        fi
    fi
    return 0
}

# 处理端口占用
handle_port_conflict() {
    local port=$1
    local service_name=$2

    if check_port $port "$service_name"; then
        echo ""
        echo "发现以下选项:"
        echo "  1) 停止占用端口 $port 的进程并继续"
        echo "  2) 跳过 $service_name 启动"
        echo "  3) 退出脚本"
        echo ""
        read -p "请选择操作 [1-3]: " choice

        case $choice in
            1)
                if kill_port_process $port "$service_name"; then
                    return 0
                else
                    return 1
                fi
                ;;
            2)
                log_warning "跳过 $service_name 启动"
                return 2
                ;;
            3)
                log_info "退出脚本"
                exit 0
                ;;
            *)
                log_error "无效选择,退出脚本"
                exit 1
                ;;
        esac
    fi
    return 0
}

# 检查依赖是否安装
check_dependencies() {
    log_info "检查依赖..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装,请先安装 Node.js (>= 18.0.0)"
        exit 1
    fi

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi

    log_success "依赖检查完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装后端依赖..."
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        if [ ! -d "node_modules" ]; then
            npm install
            log_success "后端依赖安装完成"
        else
            log_info "后端依赖已存在,跳过安装"
        fi
    fi

    log_info "安装前端依赖..."
    if [ -d "$WEB_DIR" ]; then
        cd "$WEB_DIR"
        if [ ! -d "node_modules" ]; then
            npm install
            log_success "前端依赖安装完成"
        else
            log_info "前端依赖已存在,跳过安装"
        fi
    fi
}

# 启动后端服务
start_backend() {
    cd "$BACKEND_DIR"

    # 检查后端端口
    handle_port_conflict $BACKEND_PORT "后端"
    local result=$?

    if [ $result -eq 2 ]; then
        return 1
    fi

    log_info "启动后端服务 (端口: $BACKEND_PORT)..."

    # 导出端口环境变量
    export PORT=$BACKEND_PORT

    # 启动后端并记录 PID
    nohup npm run dev > "$PROJECT_ROOT/backend.log" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"

    # 等待后端启动
    sleep 3

    # 检查进程是否仍在运行
    if ps -p $backend_pid > /dev/null; then
        log_success "后端服务启动成功 (PID: $backend_pid)"
        log_info "后端日志: $PROJECT_ROOT/backend.log"
        return 0
    else
        log_error "后端服务启动失败,请查看日志: $PROJECT_ROOT/backend.log"
        return 1
    fi
}

# 启动前端服务
start_frontend() {
    cd "$WEB_DIR"

    # 检查前端端口
    handle_port_conflict $FRONTEND_PORT "前端"
    local result=$?

    if [ $result -eq 2 ]; then
        return 1
    fi

    log_info "启动前端服务 (端口: $FRONTEND_PORT)..."

    # 启动前端并记录 PID
    nohup npm run dev > "$PROJECT_ROOT/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"

    # 等待前端启动
    sleep 3

    # 检查进程是否仍在运行
    if ps -p $frontend_pid > /dev/null; then
        log_success "前端服务启动成功 (PID: $frontend_pid)"
        log_info "前端日志: $PROJECT_ROOT/frontend.log"
        return 0
    else
        log_error "前端服务启动失败,请查看日志: $PROJECT_ROOT/frontend.log"
        return 1
    fi
}

# 停止服务
stop_services() {
    log_info "停止所有服务..."

    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if ps -p $backend_pid > /dev/null 2>&1; then
            kill $backend_pid 2>/dev/null
            log_success "已停止后端服务 (PID: $backend_pid)"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p $frontend_pid > /dev/null 2>&1; then
            kill $frontend_pid 2>/dev/null
            log_success "已停止前端服务 (PID: $frontend_pid)"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
}

# 显示服务状态
show_status() {
    echo ""
    echo "========== 服务状态 =========="
    echo ""

    # 后端状态
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if ps -p $backend_pid > /dev/null 2>&1; then
            echo -e "后端服务: ${GREEN}运行中${NC} (PID: $backend_pid, 端口: $BACKEND_PORT)"
        else
            echo -e "后端服务: ${RED}已停止${NC}"
            rm -f "$BACKEND_PID_FILE"
        fi
    else
        echo -e "后端服务: ${YELLOW}未启动${NC}"
    fi

    # 前端状态
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p $frontend_pid > /dev/null 2>&1; then
            echo -e "前端服务: ${GREEN}运行中${NC} (PID: $frontend_pid, 端口: $FRONTEND_PORT)"
        else
            echo -e "前端服务: ${RED}已停止${NC}"
            rm -f "$FRONTEND_PID_FILE"
        fi
    else
        echo -e "前端服务: ${YELLOW}未启动${NC}"
    fi

    echo ""
    echo "============================"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "======================================"
    echo "       SuperInbox 启动工具"
    echo "======================================"
    echo ""

    # 检查是否传入了命令
    if [ $# -gt 0 ]; then
        case "$1" in
            stop)
                stop_services
                exit 0
                ;;
            status)
                show_status
                exit 0
                ;;
            restart)
                stop_services
                sleep 2
                ;;
            *)
                echo "用法: $0 [stop|status|restart]"
                echo "  无参数: 启动所有服务"
                echo "  stop: 停止所有服务"
                echo "  status: 查看服务状态"
                echo "  restart: 重启所有服务"
                exit 1
                ;;
        esac
    fi

    # 检查依赖
    check_dependencies

    # 询问是否安装依赖
    if [ ! -d "$BACKEND_DIR/node_modules" ] || [ ! -d "$WEB_DIR/node_modules" ]; then
        echo ""
        read -p "是否需要安装依赖? [y/N]: " install_choice
        if [[ $install_choice =~ ^[Yy]$ ]]; then
            install_dependencies
        fi
    fi

    # 停止已存在的服务
    stop_services
    sleep 1

    # 启动服务
    echo ""
    log_info "开始启动服务..."
    echo ""

    start_backend
    backend_success=$?

    start_frontend
    frontend_success=$?

    # 显示启动结果
    echo ""
    echo "======================================"
    echo "           启动完成"
    echo "======================================"
    echo ""

    if [ $backend_success -eq 0 ]; then
        echo -e "✓ 后端服务: ${GREEN}http://localhost:$BACKEND_PORT${NC}"
        echo "  API 端点: http://localhost:$BACKEND_PORT/v1"
    else
        echo -e "✗ 后端服务: ${RED}启动失败${NC}"
    fi

    if [ $frontend_success -eq 0 ]; then
        echo -e "✓ 前端服务: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    else
        echo -e "✗ 前端服务: ${RED}启动失败${NC}"
    fi

    echo ""
    echo "使用命令:"
    echo "  查看状态: ./start.sh status"
    echo "  停止服务: ./start.sh stop"
    echo "  重启服务: ./start.sh restart"
    echo ""

    # 显示实时日志
    echo "按 Ctrl+C 停止查看日志 (服务将继续运行)"
    echo ""
    sleep 2

    # 合并显示日志
    tail -f "$PROJECT_ROOT/backend.log" "$PROJECT_ROOT/frontend.log" 2>/dev/null || true
}

# 捕获 Ctrl+C 信号
trap 'echo ""; log_info "退出脚本"; exit 0' INT

# 运行主函数
main "$@"
