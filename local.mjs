import {DatabaseSync} from 'node:sqlite'
import {createServer} from 'node:http'
import {readFileSync} from 'node:fs'
import worker from './dist/server/index.js'
const sqlite=new DatabaseSync(process.env.DB_PATH||'guftagu.sqlite')
if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE name='rooms'").get())sqlite.exec(readFileSync('drizzle/0000_rooms.sql','utf8'))
const DB={prepare(sql){return {bind(...args){const q=sqlite.prepare(sql);return {first:()=>q.get(...args),run:()=>q.run(...args),all:()=>q.all(...args)}}}},batch(qs){sqlite.exec('BEGIN IMMEDIATE');try{const result=qs.map(q=>({results:q.all()}));sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}}
const port=Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||3000
createServer(async(req,res)=>{try{
 const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>90000){res.writeHead(413).end();return}chunks.push(part)}
 const scheme=req.headers['x-forwarded-proto']==='https'?'https':'http'
 const response=await worker.fetch(new Request(scheme+'://'+req.headers.host+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined}),{DB,ICE_SERVERS:process.env.ICE_SERVERS})
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
}catch{res.writeHead(500).end('Service error')}}).listen(port,'0.0.0.0',()=>console.log('Guftagu listening on '+port))
