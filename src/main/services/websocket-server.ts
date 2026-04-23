/**
 * WebSocket 本地服务 - CAD 双向通信 (Section 3)
 * Electron Main 进程作为本地服务端，监听 127.0.0.1:8321
 * 供 CAD 插件连接实现参数双向驱动
 */

import { WebSocketServer, WebSocket } from 'ws'

let wss: WebSocketServer | null = null

interface JSONRPCRequest {
  jsonrpc: '2.0'
  method: string
  params: Record<string, any>
  id?: number | string
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  result?: any
  error?: { code: number; message: string }
  id: number | string | null
}

// 当前参数状态
const currentState: Record<string, any> = {}

// 方法处理器注册表
const handlers: Record<string, (params: any) => any> = {
  'get_state': () => ({ ...currentState }),
  'update_dimension': (params) => {
    const { feature, params: dimParams } = params
    currentState[feature] = dimParams
    return { status: 'accepted', feature, params: dimParams }
  },
  'ping': () => 'pong'
}

function attachServerHandlers(server: WebSocketServer, port: number) {
  server.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket Server] CAD client connected')
    
    ws.on('message', (data: Buffer) => {
      try {
        const request: JSONRPCRequest = JSON.parse(data.toString())
        const handler = handlers[request.method]
        
        if (!handler) {
          const response: JSONRPCResponse = {
            jsonrpc: '2.0',
            error: { code: -32601, message: `Method not found: ${request.method}` },
            id: request.id || null
          }
          ws.send(JSON.stringify(response))
          return
        }
        
        const result = handler(request.params)
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          result,
          id: request.id || null
        }
        ws.send(JSON.stringify(response))
      } catch (err: any) {
        const response: JSONRPCResponse = {
          jsonrpc: '2.0',
          error: { code: -32700, message: `Parse error: ${err.message}` },
          id: null
        }
        ws.send(JSON.stringify(response))
      }
    })
    
    ws.on('close', () => {
      console.log('[WebSocket Server] CAD client disconnected')
    })
    
    // 发送初始状态
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'init',
      params: { state: { ...currentState } }
    }))
  })

  server.on('error', (err: Error) => {
    console.error('[WebSocket Server] Error:', err.message)
  })
}

function openWebSocketServer(port: number) {
  return new Promise<WebSocketServer>((resolve, reject) => {
    const server = new WebSocketServer({
      host: '127.0.0.1',
      port,
    })

    const handleListening = () => {
      server.off('error', handleError)
      console.log(`[WebSocket Server] CAD sync server started on 127.0.0.1:${port}`)
      attachServerHandlers(server, port)
      resolve(server)
    }

    const handleError = (err: Error) => {
      server.off('listening', handleListening)
      server.removeAllListeners('connection')
      server.close()
      reject(err)
    }

    server.once('listening', handleListening)
    server.once('error', handleError)
  })
}

export async function startWebSocketServer(preferredPorts: number | number[] = 8321): Promise<number | null> {
  if (wss) return null

  const ports = Array.isArray(preferredPorts) ? preferredPorts : [preferredPorts]
  for (const port of ports) {
    try {
      wss = await openWebSocketServer(port)
      return port
    } catch (err: any) {
      if (err?.code === 'EADDRINUSE') {
        console.warn(`[WebSocket Server] Port ${port} already in use, trying next candidate...`)
        continue
      }
      console.error('[WebSocket Server] Start failed:', err?.message ?? err)
      return null
    }
  }

  console.warn('[WebSocket Server] No available port from candidate list')
  return null
}

export function stopWebSocketServer(): void {
  if (wss) {
    wss.close()
    wss = null
    console.log('[WebSocket Server] CAD sync server stopped')
  }
}

export function broadcastToClients(message: Record<string, any>): void {
  if (!wss) return
  
  const msg = JSON.stringify(message)
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  })
}
