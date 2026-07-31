import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): string {
    return 'OK';
  }

  @Get()
  @Header('Content-Type', 'text/html')
  getHello(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotel Management API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1b2d; color: #e0d5c1; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 2.5rem 3rem; border: 1px solid #c9973a44; border-radius: 12px; }
    h1 { color: #c9973a; margin: 0 0 0.5rem; font-size: 1.8rem; }
    .dot { display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 50%; margin-right: 8px; }
    p { margin: 0.3rem 0; opacity: 0.75; }
    a { color: #c9973a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏨 Hotel Management API</h1>
    <p><span class="dot"></span>Backend is running</p>
    <p>API base: <a href="/api/v1">/api/v1</a></p>
  </div>
</body>
</html>`;
  }
}
