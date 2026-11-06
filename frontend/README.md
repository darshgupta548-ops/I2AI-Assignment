# Frontend

The React and Vite client lives in this directory. For complete project setup, backend setup, environment variables, and dataset notes, see the [repository README](../README.md).

```bash
npm ci --legacy-peer-deps
npm run dev
```

The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`. Run the FastAPI backend in a separate terminal. Use `npm run build` to create the production bundle.
