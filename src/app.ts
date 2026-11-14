import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { database } from './db.js';
import { digest, token, hash, matches } from './security.js';
type User = { id:string; email:string; username:string; name:string; bio:string; password:string|null; verified:number; private:number };
type Session = {id:string; user_id:string; family:string; expires:number; revoked:number};
type Options = { databasePath:string; secret:string; sendMail:(email:string,kind:string,token:string)=>Promise<void>; googleClientId?:string };
const email = z.string().email().transform(v=>v.toLowerCase());
const password = z.string().min(12).max(128);
const username = z.string().regex(/^[a-zA-Z0-9_]{3,30}$/).transform(v=>v.toLowerCase());
function fail(status:number,message:string):never { throw Object.assign(new Error(message),{status}); }
export function createApp(options:Options) {
  if(options.secret.length<32) throw new Error('JWT_SECRET must contain at least 32 characters');
  const db=database(options.databasePath), app=express();
  const one=(sql:string,...params:any[])=>db.prepare(sql).get(...params) as any;
  const run=(sql:string,...params:any[])=>db.prepare(sql).run(...params);
  const user=(id:string):User=>one('SELECT * FROM users WHERE id=?',id) ?? fail(404,'User not found');
  const transaction=<T>(fn:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  app.disable('x-powered-by'); app.use(helmet(),express.json({limit:'16kb'}));
  app.use(rateLimit({windowMs:900000,limit:300}));
  app.use('/auth',rateLimit({windowMs:900000,limit:40}));
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    try {const value=jwt.verify(req.headers.authorization?.replace(/^Bearer /,'')??'',options.secret,{algorithms:['HS256'],issuer:'social-app',audience:'social-app-api'}) as jwt.JwtPayload;
      const s=one('SELECT * FROM sessions WHERE id=?',value.sid) as Session|undefined;
      if(!s||s.revoked||s.expires<Date.now()||s.user_id!==value.sub) return next(Object.assign(new Error('Session expired'),{status:401}));
      res.locals.user=user(s.user_id);res.locals.session=s;next();
    } catch {next(Object.assign(new Error('Authentication required'),{status:401}));}
  };
  function issue(id:string,family:string=randomUUID()) {
    const refreshToken=token(),sid=randomUUID();
    run('INSERT INTO sessions(id,user_id,family,token,expires) VALUES(?,?,?,?,?)',sid,id,family,digest(refreshToken),Date.now()+30*86400000);
    return {accessToken:jwt.sign({sid},options.secret,{subject:id,expiresIn:'15m',issuer:'social-app',audience:'social-app-api'}),refreshToken,expiresIn:900};
  }
  async function challenge(u:User,kind:string) {
    const raw=token();
    run('DELETE FROM challenges WHERE user_id=? AND kind=?',u.id,kind);
    run('INSERT INTO challenges VALUES(?,?,?,?)',digest(raw),u.id,kind,Date.now()+(kind==='verify'?86400000:1800000));
    await options.sendMail(u.email,kind,raw);
  }
  const consume=(raw:string,kind:string)=>{
    const c=one('SELECT * FROM challenges WHERE token=? AND kind=? AND expires>?',digest(raw),kind,Date.now());
    if(!c) fail(400,'Invalid or expired token');
    run('DELETE FROM challenges WHERE token=?',digest(raw)); return c.user_id as string;
  };
  const profile=(u:User,viewer:string)=>{
    const allowed=u.id===viewer||!u.private||one('SELECT 1 FROM follows WHERE follower=? AND following=? AND accepted=1',viewer,u.id);
    return {id:u.id,username:u.username,name:u.name,isPrivate:!!u.private,...(allowed?{bio:u.bio,followers:one('SELECT count(*) AS n FROM follows WHERE following=? AND accepted=1',u.id).n,following:one('SELECT count(*) AS n FROM follows WHERE follower=? AND accepted=1',u.id).n}:{}),...(u.id===viewer?{email:u.email,emailVerified:!!u.verified}:{})};
  };
  app.get('/health',(_req,res)=>res.json({status:'ok'}));
  app.post('/auth/register',async(req,res)=>{
    const data=z.object({email,username,password,name:z.string().trim().min(1).max(80)}).parse(req.body);
    const encoded=await hash(data.password),id=randomUUID();
    run('INSERT INTO users(id,email,username,name,password,created) VALUES(?,?,?,?,?,?)',id,data.email,data.username,data.name,encoded,Date.now());
    await challenge(user(id),'verify');res.status(201).json({message:'Check your email to verify your account'});
  });
  app.post('/auth/verify-email',(req,res)=>{const data=z.object({token:z.string()}).parse(req.body);transaction(()=>run('UPDATE users SET verified=1 WHERE id=?',consume(data.token,'verify')));res.json({message:'Email verified'});});
  app.post('/auth/resend-verification',async(req,res)=>{const data=z.object({email}).parse(req.body);const u=one('SELECT * FROM users WHERE email=?',data.email);if(u&&!u.verified)await challenge(u,'verify');res.json({message:'If eligible, an email has been sent'});});
  app.post('/auth/login',async(req,res)=>{
    const data=z.object({email,password:z.string().max(128)}).parse(req.body),u=one('SELECT * FROM users WHERE email=?',data.email) as User|undefined;
    const valid=await matches(data.password,u?.password??dummyPassword);
    if(!u||!valid||!u.password)fail(401,'Invalid email or password');
    if(!u.verified)fail(403,'Verify your email first');res.json(issue(u.id));
  });
  app.post('/auth/refresh',(req,res)=>{
    const data=z.object({refreshToken:z.string()}).parse(req.body);
    const result=transaction(()=>{
      const s=one('SELECT * FROM sessions WHERE token=?',digest(data.refreshToken)) as Session|undefined;
      if(!s)return null;
      if(s.revoked){run('UPDATE sessions SET revoked=1 WHERE family=?',s.family);return null;}
      if(s.expires<Date.now())return null;
      run('UPDATE sessions SET revoked=1 WHERE id=?',s.id);return issue(s.user_id,s.family);
    });if(!result)fail(401,'Invalid refresh token');res.json(result);
  });
  app.post('/auth/logout',auth,(_req,res)=>{run('UPDATE sessions SET revoked=1 WHERE family=?',res.locals.session.family);res.sendStatus(204);});
  app.post('/auth/logout-all',auth,(_req,res)=>{run('UPDATE sessions SET revoked=1 WHERE user_id=?',res.locals.user.id);res.sendStatus(204);});
  app.post('/auth/forgot-password',async(req,res)=>{const data=z.object({email}).parse(req.body),u=one('SELECT * FROM users WHERE email=?',data.email);if(u?.password)await challenge(u,'reset');res.json({message:'If eligible, an email has been sent'});});
  app.post('/auth/reset-password',async(req,res)=>{const data=z.object({token:z.string(),password}).parse(req.body),encoded=await hash(data.password);transaction(()=>{const id=consume(data.token,'reset');run('UPDATE users SET password=? WHERE id=?',encoded,id);run('UPDATE sessions SET revoked=1 WHERE user_id=?',id);});res.json({message:'Password reset'});});
  app.post('/auth/google',async(req,res)=>{
    if(!options.googleClientId)fail(503,'Google sign-in is not configured');
    const data=z.object({idToken:z.string()}).parse(req.body);
    let payload;try{payload=(await new OAuth2Client(options.googleClientId).verifyIdToken({idToken:data.idToken,audience:options.googleClientId})).getPayload();}catch{fail(401,'Invalid Google credential');}
    if(!payload?.email||!payload.email_verified)fail(401,'Google email must be verified');
    const existing=one('SELECT * FROM users WHERE google_id=?',payload.sub);
    if(existing)return res.json(issue(existing.id));
    if(one('SELECT 1 FROM users WHERE email=?',payload.email.toLowerCase()))fail(409,'An account with this email already exists; sign in with your password');
    const id=randomUUID();run('INSERT INTO users(id,email,username,name,google_id,verified,created) VALUES(?,?,?,?,?,1,?)',id,payload.email.toLowerCase(),`user_${token().slice(0,16).replace(/-/g,'_')}`,payload.name??'Google user',payload.sub,Date.now());res.status(201).json(issue(id));
  });
  app.use('/users',auth);
  app.get('/users/me',(_req,res)=>res.json(profile(res.locals.user,res.locals.user.id)));
  app.patch('/users/me',(req,res)=>{const data=z.object({name:z.string().trim().min(1).max(80).optional(),username:username.optional(),bio:z.string().max(500).optional()}).strict().parse(req.body);transaction(()=>{for(const [key,value]of Object.entries(data))run(`UPDATE users SET ${key}=? WHERE id=?`,value,res.locals.user.id);});res.json(profile(user(res.locals.user.id),res.locals.user.id));});
  app.patch('/users/me/settings',(req,res)=>{const data=z.object({isPrivate:z.boolean()}).strict().parse(req.body);transaction(()=>{run('UPDATE users SET private=? WHERE id=?',+data.isPrivate,res.locals.user.id);if(!data.isPrivate)run('UPDATE follows SET accepted=1 WHERE following=?',res.locals.user.id);});res.json({isPrivate:data.isPrivate});});
  app.get('/users/search',(req,res)=>{const q=z.string().trim().min(1).max(80).parse(req.query.q);const rows=db.prepare("SELECT * FROM users WHERE instr(username,?)>0 OR instr(lower(name),lower(?))>0 ORDER BY username LIMIT 30").all(q.toLowerCase(),q) as User[];res.json(rows.map(u=>profile(u,res.locals.user.id)));});
  app.get('/users/suggestions',(_req,res)=>{const id=res.locals.user.id;const rows=db.prepare('SELECT * FROM users WHERE verified=1 AND id!=? AND id NOT IN (SELECT following FROM follows WHERE follower=?) ORDER BY created DESC LIMIT 20').all(id,id) as User[];res.json(rows.map(u=>profile(u,id)));});
  app.get('/users/me/follow-requests',(_req,res)=>{const rows=db.prepare('SELECT u.* FROM users u JOIN follows f ON f.follower=u.id WHERE f.following=? AND f.accepted=0').all(res.locals.user.id) as User[];res.json(rows.map(u=>profile(u,res.locals.user.id)));});
  app.post('/users/me/follow-requests/:id/accept',(req,res)=>{const result=run('UPDATE follows SET accepted=1 WHERE follower=? AND following=?',req.params.id,res.locals.user.id);if(!result.changes)fail(404,'Follow request not found');res.sendStatus(204);});
  app.delete('/users/me/follow-requests/:id',(req,res)=>{run('DELETE FROM follows WHERE follower=? AND following=? AND accepted=0',req.params.id,res.locals.user.id);res.sendStatus(204);});
  app.get('/users/:id',(req,res)=>res.json(profile(user(req.params.id as string),res.locals.user.id)));
  app.post('/users/:id/follow',(req,res)=>{const target=user(req.params.id as string);if(target.id===res.locals.user.id)fail(400,'Cannot follow yourself');run('INSERT OR IGNORE INTO follows VALUES(?,?,?)',res.locals.user.id,target.id,target.private?0:1);res.json({status:target.private?'requested':'following'});});
  app.delete('/users/:id/follow',(req,res)=>{run('DELETE FROM follows WHERE follower=? AND following=?',res.locals.user.id,req.params.id);res.sendStatus(204);});
  app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
  app.use((error:any,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError)return res.status(400).json({error:'Validation failed',details:error.issues});
    if(error.code==='ERR_SQLITE_ERROR'&&error.message.includes('UNIQUE constraint'))return res.status(409).json({error:'Email or username already in use'});
    const status=error.status??500;if(status===500)console.error(error);res.status(status).json({error:status===500?'Internal server error':error.message});
  });
  return {app,db};
}
// Fixed dummy hash keeps unknown-email password checks on the same expensive path.
const dummyPassword=await hash('unusable-random-dummy-password');
