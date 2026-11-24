import {readFileSync as read,writeFileSync as write,mkdirSync,cpSync} from 'node:fs'
const assets={}
for(const [path,file,type] of [['/','index.html','text/html'],['/style.css','style.css','text/css'],['/app.js','app.js','application/javascript']])assets[path]=[read('public/'+file,'utf8'),type]
assets['/mark.webp']=[read('public/mark.webp').toString('base64'),'image/webp']
mkdirSync('dist/server',{recursive:true})
cpSync('.openai','dist/.openai',{recursive:true})
cpSync('drizzle','dist/.openai/drizzle',{recursive:true})
write('dist/server/index.js',read('api.mjs','utf8')+'\nconst assets='+JSON.stringify(assets)+`
export default {async fetch(req,env){
  const path=new URL(req.url).pathname
  if(path==='/api')return api(req,env)
  const asset=assets[path]
  if(path==='/mark.webp'){
    const bytes=Uint8Array.from(atob(asset[0]), character=>character.charCodeAt(0))
    return new Response(bytes,{headers:{'Content-Type':asset[1]}})
  }
  return asset?new Response(asset[0],{headers:{'Content-Type':asset[1]+'; charset=utf-8','Permissions-Policy':'camera=(self), microphone=(self)'}}):new Response('Not found',{status:404})
}}
`)
