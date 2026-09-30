# InvoiceFlow

> A modern invoicing platform designed for the transition to e-invoicing in France, with AI-assisted invoice management.

InvoiceFlow is a fullstack web application for creating, managing, and tracking invoices.

The project is designed around the French e-invoicing reform, which is being introduced progressively from September 2026. Small and medium-sized businesses and micro-businesses will have to issue electronic invoices from September 2027.

This project is also an opportunity to explore how AI coding agents can be used in a real software engineering workflow.

---

## Features

### Company management
- Manage company information
- Manage billing information
- Manage customers

### Customer management
- Create customers
- Update customers
- Delete customers
- View customer details

### Product & service management
- Create products and services
- Set prices
- Set VAT rates
- Manage descriptions

### Invoice management
- Create invoices
- Add products and services
- Calculate subtotal, VAT and total
- Invoice numbering
- Invoice status
- Update and delete invoices
- Track payment status

### Invoice documents
- Generate PDF invoices
- Download invoices
- Prepare invoices for electronic transmission

### Dashboard
- Total revenue
- Paid invoices
- Pending invoices
- Overdue invoices
- Recent invoices

### Authentication & security
- User authentication
- Role-based access
- Secure REST API
- JWT / OAuth2 / OIDC

### AI features
- Create invoices using natural language
- Analyze invoice information
- Ask questions about invoices
- AI-assisted workflows

Example:

> "Create an invoice for ACME with 3 days of development at €450 per day and 20% VAT."

The AI converts the request into structured data.

The backend validates the data and applies the business rules before creating the invoice.

---

## Tech Stack

### Frontend

<p>
  <img src="https://skillicons.dev/icons?i=angular,typescript,rxjs,bootstrap" />
</p>

- Angular
- TypeScript
- RxJS
- Bootstrap

### Backend

<p>
  <img src="https://skillicons.dev/icons?i=java,spring" />
</p>

- Java
- Spring Boot
- Spring Security
- Spring Data JPA
- REST API

### Database

<p>
  <img src="https://skillicons.dev/icons?i=postgres" />
</p>

- PostgreSQL

### DevOps

<p>
  <img src="https://skillicons.dev/icons?i=docker,githubactions,git" />
</p>

- Docker
- Docker Compose
- GitHub Actions
- Git

### AI

- Claude Code
- OpenAI Codex
- LLM API

---

## Architecture

InvoiceFlow will start as a modular monolith.

```text
invoiceflow/
│
├── backend/
│   ├── auth/
│   ├── user/
│   ├── company/
│   ├── customer/
│   ├── product/
│   ├── invoice/
│   ├── payment/
│   ├── pdf/
│   └── ai/
│
├── frontend/
│   ├── auth/
│   ├── dashboard/
│   ├── customers/
│   ├── products/
│   ├── invoices/
│   └── shared/
│
├── infrastructure/
│   ├── docker/
│   └── docker-compose.yml
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── adr/
│
├── .github/
│   └── workflows/
│
└── README.md