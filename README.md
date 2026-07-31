# MarketFlow Demo

A portfolio version of a grocery commerce and store-operations platform built with React Native, Expo, TypeScript, and Supabase.

This repository is a sanitized demonstration. It contains fictitious store details and a small sample catalog. Production credentials, customer data, internal documents, and the original Git history are not included.

## What it demonstrates

- Customer catalog, search, cart, checkout, orders, addresses, and loyalty experience
- Responsive web dashboards for administrators and store operators
- Product, category, promotion, banner, delivery-zone, and customer management
- Order preparation, weighing, pickup, and delivery workflows
- Authentication, role-aware navigation, API integration, and database migrations
- Shared codebase for web and mobile through Expo Router

## Technology

- React Native 0.79 and React 19
- Expo 53 and Expo Router
- TypeScript
- Supabase authentication, database, and storage integration
- React Native Web

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and enter the URL and anonymous key for your own Supabase project.

3. Start the project:

   ```bash
   npm run web
   ```

The included SQL files describe the database used by the project. Review and adapt their security policies before using them in any production environment.

## Privacy and security

- Do not commit `.env` files or production credentials.
- Use only fictitious data when testing this public demo.
- The sample WhatsApp number, address, and product catalog are placeholders.
- This project is provided as a portfolio case study, not as a production-ready commerce service.

## Author

Vinícius Silva — web and mobile developer with a marketing background.
