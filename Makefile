# Lệnh tắt (Windows không có make thì chạy trực tiếp lệnh docker compose trong README)
.PHONY: dev dev-tools down logs prod prod-down test

dev:        ## Chạy môi trường dev, tự đồng bộ code khi sửa
	docker compose up --build --watch

dev-tools:  ## Dev + mongo-express (http://localhost:8081)
	docker compose --profile tools up --build --watch

down:       ## Dừng môi trường dev
	docker compose down

logs:
	docker compose logs -f backend frontend

prod:       ## Build và chạy production (cần file .env)
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

test:       ## Chạy unit test cả hai phía
	cd backend && npm test
	cd frontend && npm test
