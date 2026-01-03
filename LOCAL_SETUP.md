# Running Supply Chain Frontend Locally

## Port Configuration

The frontend runs on **port 8080** by default (configured in `vite.config.ts`).

## Quick Start

### 1. Install Dependencies

```bash
cd /Applications/XAMPP/htdocs/emerald-supply-chain
npm install
```

Or if you're using bun (since there's a `bun.lockb` file):
```bash
bun install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and set your API URL:
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ENV=development
```

**Note**: If you're running the Laravel backend on a different port, update `VITE_API_BASE_URL` accordingly.

### 3. Start Development Server

```bash
npm run dev
```

Or with bun:
```bash
bun run dev
```

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

## Changing the Port

If port 8080 is already in use, you can:

1. **Modify vite.config.ts**:
   ```typescript
   server: {
     host: "::",
     port: 3000, // Change to your preferred port
   },
   ```

2. **Or use command line**:
   ```bash
   npm run dev -- --port 3000
   ```

## Backend Connection

Make sure your Laravel backend is running on port 8000 (or update `.env`):

```bash
cd /Applications/XAMPP/htdocs/supply-chain-backend
php artisan serve
```

This will start the backend on `http://localhost:8000`, and the frontend will connect to `http://localhost:8000/api`.

## Troubleshooting

### Port Already in Use
If port 8080 is busy:
- Kill the process using that port, or
- Change the port in `vite.config.ts`

### API Connection Issues
- Verify backend is running: `http://localhost:8000`
- Check `.env` file has correct `VITE_API_BASE_URL`
- Check browser console for CORS errors

### Dependencies Issues
If you encounter dependency errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Scripts

- `npm run dev` - Start development server (port 8080)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

