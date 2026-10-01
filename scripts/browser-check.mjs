import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const edge=process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const pages=process.argv.slice(2);
if(!pages.length)pages.push('browser-tests','miniprogram-browser-tests','web-policy-tests','play-browser-tests','experience-tests','file:play-browser-tests');
let failed=false;
for(const page of pages){
  const profile=fs.mkdtempSync(path.join(root,'.tmp-edge-check-'));
  try{
    const url=page.startsWith('file:')?pathToFileURL(path.join(root,'packages/core/test',page.slice(5)+'.html')).href:`http://127.0.0.1:8000/packages/core/test/${page}.html`;
    const result=await new Promise((resolve,reject)=>{
      const child=spawn(edge,['--headless','--no-sandbox','--disable-gpu','--disable-crash-reporter','--disable-background-networking','--no-first-run','--allow-file-access-from-files',`--user-data-dir=${profile}`,'--virtual-time-budget=20000','--dump-dom',url]);
      let stdout='',stderr='';
      const timeout=setTimeout(()=>{child.kill();reject(new Error('Browser test timed out'));},60000);
      child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
      child.on('error',reject);child.on('close',code=>{clearTimeout(timeout);resolve({stdout,stderr,code});});
    });
    const title=result.stdout.match(/<title>(.*?)<\/title>/)?.[1];
    const content=result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    console.log(`\n${page}: ${title || 'NO RESULT'}\n${content || result.stderr.slice(-1200)}`);
    if(!title?.includes('passed')||result.code!==0)failed=true;
  }finally{
    if(path.dirname(profile)!==root||!path.basename(profile).startsWith('.tmp-edge-check-'))throw new Error('Unsafe profile cleanup');
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200});}catch{console.warn('Temporary browser profile still locked: '+profile);}
  }
}
if(failed)process.exitCode=1;
