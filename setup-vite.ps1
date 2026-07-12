$ErrorActionPreference = 'Stop'
$rootDir = "e:\SupplyHUB"

Write-Host "Criando arquivos base do Vite..."

# tsconfig.json
New-Item -Path "$rootDir\tsconfig.json" -ItemType File -Force -Value @"
{
  `"compilerOptions`": {
    `"target`": `"ES2020`",
    `"useDefineForClassFields`": true,
    `"lib`": [`"ES2020`", `"DOM`", `"DOM.Iterable`"],
    `"module`": `"ESNext`",
    `"skipLibCheck`": true,
    `"moduleResolution`": `"bundler`",
    `"allowImportingTsExtensions`": true,
    `"resolveJsonModule`": true,
    `"isolatedModules`": true,
    `"noEmit`": true,
    `"jsx`": `"react-jsx`",
    `"strict`": true,
    `"noUnusedLocals`": true,
    `"noUnusedParameters`": true,
    `"noFallthroughCasesInSwitch`": true,
    `"baseUrl`": `".`",
    `"paths`": {
      `"@/*`": [`"./src/*`"]
    }
  },
  `"include`": [`"src`"],
  `"references`": [{ `"path`": `"./tsconfig.node.json`" }]
}
"@ | Out-Null

# tsconfig.node.json
New-Item -Path "$rootDir\tsconfig.node.json" -ItemType File -Force -Value @"
{
  `"compilerOptions`": {
    `"composite`": true,
    `"skipLibCheck`": true,
    `"module`": `"ESNext`",
    `"moduleResolution`": `"bundler`",
    `"allowSyntheticDefaultImports`": true,
    `"strict`": true
  },
  `"include`": [`"vite.config.ts`"]
}
"@ | Out-Null

# vite.config.ts
New-Item -Path "$rootDir\vite.config.ts" -ItemType File -Force -Value @"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
"@ | Out-Null

# index.html
New-Item -Path "$rootDir\index.html" -ItemType File -Force -Value @"
<!doctype html>
<html lang=`"en`">
  <head>
    <meta charset=`"UTF-8`" />
    <link rel=`"icon`" type=`"image/svg+xml`" href=`"/vite.svg`" />
    <meta name=`"viewport`" content=`"width=device-width, initial-scale=1.0`" />
    <title>SupplyHub</title>
  </head>
  <body>
    <div id=`"root`"></div>
    <script type=`"module`" src=`"/src/main.tsx`"></script>
  </body>
</html>
"@ | Out-Null

# tailwind.config.js
New-Item -Path "$rootDir\tailwind.config.js" -ItemType File -Force -Value @"
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    `"./index.html`",
    `"./src/**/*.{js,ts,jsx,tsx}`",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"@ | Out-Null

# postcss.config.js
New-Item -Path "$rootDir\postcss.config.js" -ItemType File -Force -Value @"
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"@ | Out-Null

# src/index.css
New-Item -Path "$rootDir\src\index.css" -ItemType File -Force -Value @"
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
}
"@ | Out-Null

# src/App.tsx
New-Item -Path "$rootDir\src\App.tsx" -ItemType File -Force -Value @"
import React from 'react';

export default function App() {
  return (
    <div className=`"min-h-screen bg-slate-50 flex items-center justify-center`">
      <h1 className=`"text-4xl font-bold text-slate-900`">SupplyHub Initialized</h1>
    </div>
  );
}
"@ | Out-Null

# src/main.tsx
New-Item -Path "$rootDir\src\main.tsx" -ItemType File -Force -Value @"
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"@ | Out-Null

Write-Host "Arquivos base criados com sucesso!"
