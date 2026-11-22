/**
 * Chrome DevTools Protocol (CDP) Verification Script for JobHQ Desktop.
 * 
 * Usage:
 * 1. Launch the Tauri release app with remote debugging enabled:
 *      $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
 *      & "C:\Users\<user>\AppData\Local\JobHQ\app.exe"
 * 2. Run this script via Node:
 *      node scripts/debug/cdp_test.js
 * 
 * Verifies that the WebView2 webview is connected, evaluating JavaScript directly in the
 * running desktop window context to confirm the Python backend responds with 200 OK.
 */

import http from 'node:http';

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    let list;
    try {
      list = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse CDP JSON:', e.message);
      process.exit(1);
    }

    const target = list.find(t => t.type === 'page' && t.url.includes('tauri.localhost'));
    if (!target) {
      console.error('No tauri.localhost page found in CDP targets:', list);
      process.exit(1);
    }
    console.log('Target found:', target.id, target.url, target.webSocketDebuggerUrl);
    
    // Connect to WebSocket using native Node 22 WebSocket
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('WS connected!');
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Network.enable' }));
      
      const testJs = `
        (async () => {
          try {
            const res = await fetch("http://127.0.0.1:3001/api/dashboard");
            const text = await res.text();
            return { ok: res.ok, status: res.status, body: text.slice(0, 100) };
          } catch (err) {
            return { error: err.name + ": " + err.message, stack: err.stack };
          }
        })()
      `;
      ws.send(JSON.stringify({
        id: 10,
        method: 'Runtime.evaluate',
        params: {
          expression: testJs,
          awaitPromise: true,
          returnByValue: true
        }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 10) {
        console.log('EVAL_RESULT:', JSON.stringify(msg.result, null, 2));
        setTimeout(() => process.exit(0), 1000);
      } else if (msg.method && msg.method.startsWith('Console')) {
        console.log('CONSOLE:', msg.params);
      } else if (msg.method && msg.method.startsWith('Network.loadingFailed')) {
        console.log('NETWORK_FAILED:', msg.params);
      } else if (msg.method && msg.method.startsWith('Log.entryAdded')) {
        console.log('BROWSER_LOG:', msg.params);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      process.exit(1);
    };
  });
}).on('error', err => {
  console.error('HTTP Error connecting to CDP port 9222:', err.message);
  process.exit(1);
});
