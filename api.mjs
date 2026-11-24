const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function api(req,env){
  if(req.method!=='POST'||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return respond({error:'Request denied'},403)
  const raw=await req.text()
  if(raw.length>90000)return respond({error:'Request too large'},413)
  let b
  try{b=JSON.parse(raw)}catch{return respond({error:'Invalid request'},400)}
  const uuid=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s)
  if(!b||!uuid(b.token))return respond({error:'Invalid session'},400)
  const query=(sql,...args)=>env.DB.prepare(sql).bind(...args)
  const now=Date.now(),cut=now-45000
  if(b.action==='join'){
    if(!uuid(b.tag))return respond({error:'Invalid identity'},400)
    const avoid=uuid(b.avoid)?b.avoid:''
    await query('DELETE FROM rooms WHERE htime<? OR (guest IS NOT NULL AND gtime<?)',cut,cut).run()
    const prior=await query('SELECT id,host FROM rooms WHERE host=? OR guest=?',b.token,b.token).first()
    if(prior)return respond({id:prior.id,host:prior.host===b.token})
    const id=crypto.randomUUID()
    const [claim]=await env.DB.batch([
      query('UPDATE rooms SET guest=?,guest_tag=?,gtime=? WHERE id=(SELECT id FROM rooms WHERE guest IS NULL AND host_tag<>? AND host_tag<>? AND avoid<>? ORDER BY RANDOM() LIMIT 1) RETURNING id',b.token,b.tag,now,b.tag,avoid,b.tag),
      query('INSERT INTO rooms(id,host,host_tag,avoid,htime) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE guest=?)',id,b.token,b.tag,avoid,now,b.token)
    ])
    const match=claim.results[0]
    return respond({id:match?.id||id,host:!match})
  }
  if(!uuid(b.id))return respond({error:'Invalid room'},400)
  const room=await query('SELECT * FROM rooms WHERE id=? AND (host=? OR guest=?)',b.id,b.token,b.token).first()
  if(!room)return respond({ended:true})
  const host=b.token===room.host, partner=host?room.guest_tag:room.host_tag
  if(b.action==='leave'||b.action==='report'){
    if(b.action==='report'&&partner){
      await query('INSERT OR IGNORE INTO reports VALUES(?,?,?,?,?)',room.id+b.token.slice(-8),room.id,partner,String(b.reason||'Inappropriate behaviour').slice(0,240),now).run()
    }
    await query('DELETE FROM rooms WHERE id=?',b.id).run()
    return respond({ended:true})
  }
  if(b.action==='signal'){
    if(typeof b.sdp!=='string'||b.sdp.length>80000||!partner)return respond({error:'Invalid signal'},400)
    await query('UPDATE rooms SET '+(host?'offer':'answer')+'=? WHERE id=?',b.sdp,b.id).run()
    return respond({ok:true})
  }
  if(b.action!=='poll')return respond({error:'Unknown action'},400)
  if(room.htime<cut||(room.guest&&room.gtime<cut))return respond({ended:true})
  await query('UPDATE rooms SET '+(host?'htime':'gtime')+'=? WHERE id=?',now,b.id).run()
  let iceServers=[{urls:'stun:stun.l.google.com:19302'}]
  if(env.ICE_SERVERS)iceServers=JSON.parse(env.ICE_SERVERS)
  return respond({partner,sdp:host?room.answer:room.offer,iceServers})
}
