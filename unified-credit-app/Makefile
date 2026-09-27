install:
	cd frontend && npm install
	cd backend && pip install -r requirements.txt

backend:
	cd backend && python -u main.py

frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

test:
	cd backend && python -m pytest tests/ -v
	cd frontend && npm run build

clean:
	rm -rf frontend/node_modules frontend/dist backend/__pycache__
