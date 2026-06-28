# NoteForge 部署方案

## 一、本地开发环境

```bash
# 克隆项目
git clone https://github.com/your-name/noteforge.git
cd noteforge

# 启动基础设施（PostgreSQL/Redis/ES/MinIO/RabbitMQ）
docker-compose up -d

# 启动后端服务
cd backend
./gradlew bootRun

# 启动 Tauri 桌面端
cd desktop
npm install
cargo tauri dev

# 启动 Web 端
cd web
npm install
npm run dev

# 启动 AI 服务
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload
```

## 二、生产环境部署 (K8s)

```
namespaces:
  noteforge
    ├── ingress-nginx
    ├── cert-manager
    ├── note-service (3 pods)
    ├── user-service (2 pods)
    ├── sync-service (3 pods)
    ├── search-service (2 pods)
    ├── ai-service (2 pods, GPU node)
    ├── rabbitmq (3 pods, cluster)
    ├── redis (3 pods, sentinel)
    ├── elasticsearch (3 pods, cluster)
    ├── minio (4 pods, distributed)
    └── monitoring (prometheus + grafana + loki)
```

## 三、CI/CD

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy
on:
  push:
    branches: [main]

jobs:
  build-rust-engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo build --release --manifest-path core/Cargo.toml
      - run: cargo test --manifest-path core/Cargo.toml

  build-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21', distribution: 'temurin' }
      - run: ./gradlew build
      - run: ./gradlew test

  build-desktop:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install && cargo tauri build

  deploy:
    needs: [build-rust-engine, build-backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t noteforge/note-service:latest ./backend
      - run: docker push noteforge/note-service:latest
      - run: kubectl apply -f k8s/
```
