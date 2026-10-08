# CLOUDSTOCK - Concurrent Inventory Management System

A professional CI/CD-enabled inventory management system designed to solve complex concurrency problems in high-traffic eCommerce scenarios.

## Features
- Dashboard with live system health and inventory statistics
- Product CRUD with optimistic locking support
- Order system with transactional integrity
- Bullet-proof concurrency handling to strictly prevent overselling (negative stock)
- Consistent lock ordering to prevent MySQL deadlocks
- Clean, responsive React UI

## Technology Stack
- **Frontend**: React + Vite (Vanilla CSS)
- **Backend**: Node.js + Express.js
- **Database**: MySQL 8.0 (InnoDB)
- **Testing**: Jest + Supertest

## Architecture
The application currently runs completely locally. The backend utilizes a MySQL connection pool to interact with the database. The React frontend interacts with the REST API.
API Endpoints:
- `GET /health`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders`
- `POST /api/orders`

## Production Docker Setup
The entire application is fully dockerized for production use.
1. Clone the repository and `cd cloudstock`.
2. Build and start the full stack (MySQL, Backend Node, Frontend Nginx):
   ```bash
   docker compose up --build -d
   ```
3. The services will be exposed at:
   - Frontend (React): [http://localhost:8080](http://localhost:8080)
   - Backend API: [http://localhost:5000](http://localhost:5000)
   - MySQL Database: `localhost:3307`

## Environment Variables
See `.env.example`.
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `PORT`

## Testing
Run `npm run test` inside the `backend` folder. The tests use the live local database and verify actual transaction atomicity and failure on insufficient stock.

## Concurrency Problem
When two customers try to buy the last item simultaneously, a naive system will sell it twice, resulting in -1 stock. Cloudstock solves this with atomic `UPDATE ... WHERE quantity >= ?` checks embedded directly in the query, allowing the database row lock to guarantee atomicity.

## Isolation Level Documentation

CLOUDSTOCK uses MySQL's default InnoDB isolation level: **REPEATABLE READ**.

- **READ COMMITTED**: A transaction sees only data committed before it began, and it never sees uncommitted data. However, if another transaction commits changes, subsequent reads within the current transaction will reflect those changes (Non-Repeatable Reads). Provides high concurrency but sacrifices some consistency.
- **REPEATABLE READ (MySQL Default)**: Ensures that any row read during a transaction will remain unchanged for the duration of the transaction. Provides a great balance of strong consistency and concurrency. It uses snapshot isolation in InnoDB.
- **SERIALIZABLE**: The strictest level. It effectively forces transactions to execute sequentially by locking all rows read. Solves phantom reads perfectly but heavily impacts performance and concurrency.

In Cloudstock, we stick with **REPEATABLE READ** but use atomic `UPDATE ... WHERE quantity >= ?` to perform stock decrements. This pushes the concurrency control natively to the storage engine row-level locks (which act serializeable on the specific modified row during the update) without suffering the global performance penalty of the Serializable isolation level.

## Test Commands
From the project root:
- `npm run test`: Runs the entire test suite.
- `npm run test:integration`: Runs the backend API tests.
- `npm run test:concurrency`: Runs the concurrent stress tests and deadlock verifications.

## Current Limitations
- Phase 2 focuses entirely on concurrency testing. AWS and CI/CD will be configured in Phase 3.
