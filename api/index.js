module.exports = (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GSCODER IDE - Production Ready</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #d4d4d4; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .brand-logo { font-size: 2rem; font-weight: bold; color: #007acc; margin-bottom: 2rem; }
        .hero { text-align: center; padding: 4rem 0; }
        .hero h1 { font-size: 3rem; margin-bottom: 1rem; color: #fff; }
        .hero p { font-size: 1.2rem; color: #9cdcfe; margin-bottom: 2rem; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-top: 2rem; }
        .feature { background: #252526; padding: 2rem; border-radius: 8px; border: 1px solid #3c3c3c; }
        .feature h3 { color: #007acc; margin-bottom: 1rem; }
        nav { background: #2d2d2d; padding: 1rem 2rem; display: flex; gap: 2rem; }
        nav a { color: #9cdcfe; text-decoration: none; }
        nav a:hover { color: #fff; }
        .status { background: #4ec9b0; color: #1e1e1e; padding: 0.5rem 1rem; border-radius: 4px; display: inline-block; }
      </style>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/features">Features</a>
        <a href="/docs">Documentation</a>
        <a href="/download">Download</a>
      </nav>
      <div class="container">
        <div class="brand-logo">GSCODER</div>
        <div class="hero">
          <h1>Production-Ready AI IDE</h1>
          <p>16-Phase Complete Implementation with Privacy-First Architecture</p>
          <span class="status">✓ Build Successful</span>
        </div>
        <div class="features">
          <div class="feature">
            <h3>Phase 1-8</h3>
            <p>Core Features: Rebranding, Inline AI, AST Indexing, Priompt, Fast Inference, Agent Orchestrator, Production Build, Model Routing</p>
          </div>
          <div class="feature">
            <h3>Phase 9-12</h3>
            <p>Privacy & Settings: Privacy Shield, Private Extensions, Performance Metrics, AI Settings Panel</p>
          </div>
          <div class="feature">
            <h3>Phase 13-16</h3>
            <p>Advanced Features: Fine-Tuning Pipeline, Terminal Integration, Update Server, Remote Index Caching</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
};
