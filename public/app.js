const el=id=>document.getElementById(id)
const tag=localStorage.guftaguTag||(localStorage.guftaguTag=crypto.randomUUID())
let active=null,avoid=''
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function request(s,action,extra={}){
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:s.id,token:s.token,...extra})})
  if(!response.ok)throw Error('The chat service is unavailable. Please try again.')
  return response.json()
}
function status(title,message){el('title').textContent=title;el('status').textContent=message;el('empty').hidden=false}
function reset(s){
  if(active!==s)return
  active=null
  s.pc?.close()
  s.stream?.getTracks().forEach(track=>track.stop())
  for(const name of ['local','remote'])el(name).srcObject=null
  for(const id of ['end','report','mic','cam'])el(id).disabled=true
  el('adult').disabled=false
  el('selfEmpty').hidden=false
  el('start').disabled=false
  el('start').textContent='Start video chat'
  el('mic').textContent='Mic on'
  el('cam').textContent='Camera on'
}
async function stop(message,action='leave'){
  const s=active
  if(!s)return
  if(s.partner)avoid=s.partner
  reset(s)
  status('Chat ended',message)
  if(s.id)await request(s,action,{reason:el('category').value})
}
async function describe(s,type){
  const pc=s.pc
  const desc=type==='offer'?await pc.createOffer():await pc.createAnswer()
  await pc.setLocalDescription(desc)
  const until=Date.now()+6500
  while(active===s&&pc.iceGatheringState!=='complete'&&Date.now()<until)await sleep(100)
  if(active===s)await request(s,'signal',{sdp:pc.localDescription.sdp})
}
async function start(){
  if(!el('adult').checked){el('adult').focus();status('Before you start','Please confirm you are 18+ and agree to the house rules.');return}
  const s={token:crypto.randomUUID()}
  active=s
  el('start').disabled=true
  el('adult').disabled=true
  el('end').disabled=false
  status('Camera check','Allow access to your camera and microphone.')
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Open the app using HTTPS or localhost to enable your camera.')
    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true})
    if(active!==s){stream.getTracks().forEach(t=>t.stop());return}
    s.stream=stream
    el('local').srcObject=stream
    el('selfEmpty').hidden=true
    el('cam').disabled=el('mic').disabled=false
    Object.assign(s,await request(s,'join',{tag,avoid}))
    if(active!==s){await request(s,'leave');return}
    status('Finding a partner','Waiting for another person to start a chat.')
    while(active===s){
      const state=await request(s,'poll')
      if(active!==s)return
      if(state.ended){await stop('Your partner left or the session expired. Start again to meet someone new.');return}
      if(state.partner&&!s.pc){
        s.partner=state.partner
        s.connectBy=Date.now()+35000
        status('Partner found','Connecting your video call…')
        el('start').disabled=el('report').disabled=false
        el('start').textContent='Next partner'
        const pc=s.pc=new RTCPeerConnection({iceServers:state.iceServers})
        stream.getTracks().forEach(t=>pc.addTrack(t,stream))
        pc.ontrack=e=>{if(active===s)el('remote').srcObject=e.streams[0]}
        pc.onconnectionstatechange=()=>{
          if(active!==s)return
          if(pc.connectionState==='connected'){el('empty').hidden=true;s.connectBy=0}
          if(pc.connectionState==='disconnected'){status('Reconnecting','Checking your connection…');s.connectBy=Date.now()+15000}
          if(pc.connectionState==='failed')stop('The connection failed. Try again or use another network.').catch(()=>{})
        }
        if(s.host)await describe(s,'offer')
      }
      if(s.pc&&state.sdp&&!s.pc.remoteDescription){
        await s.pc.setRemoteDescription({type:s.host?'answer':'offer',sdp:state.sdp})
        if(!s.host)await describe(s,'answer')
      }
      if(s.connectBy&&Date.now()>s.connectBy){await stop('Could not connect these networks. Try another partner.');return}
      await sleep(1200)
    }
  }catch(e){
    if(active!==s)return
    reset(s)
    if(s.id)request(s,'leave').catch(()=>{})
    status('Could not start the call',e.name==='NotAllowedError'?'Camera or microphone access was denied. Allow both in your browser settings and try again.':e.message)
  }
}
el('start').onclick=async()=>{if(active)await stop('Searching again.').catch(()=>{});if(!active)start()}
el('end').onclick=()=>stop('Start a new chat whenever you are ready.').catch(()=>{})
for(const [id,kind,label] of [['mic','audio','Mic'],['cam','video','Camera']]){
  el(id).onclick=()=>{const track=active?.stream?.getTracks().find(t=>t.kind===kind);if(track){track.enabled=!track.enabled;el(id).textContent=label+(track.enabled?' on':' off')}}
}
el('guide').onclick=()=>el('rules').showModal()
el('report').onclick=()=>el('reason').showModal()
el('cancel').onclick=()=>el('reason').close()
el('submitReport').onclick=async()=>{el('reason').close();try{await stop('Sending report…','report');status('Report submitted','Your call has ended.')}catch{status('Call ended','The report could not be delivered.')}} 
addEventListener('pagehide',()=>{if(active?.id)navigator.sendBeacon('/api',JSON.stringify({action:'leave',id:active.id,token:active.token}))})
