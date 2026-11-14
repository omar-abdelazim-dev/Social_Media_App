import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
function fixture(){const mail:{email:string;kind:string;token:string}[]=[];const {app,db}=createApp({databasePath:':memory:',secret:'test-secret-that-is-longer-than-32-characters',async sendMail(email,kind,token){mail.push({email,kind,token});}});return {api:request(app),db,mail};}
const pass='a-strong-password-123';
test('verification, refresh replay, reset and revocation',async()=>{
 const {api,db,mail}=fixture();try{
 await api.post('/auth/register').send({email:'A@example.com',username:'alice',name:'Alice',password:pass}).expect(201);
 await api.post('/auth/login').send({email:'a@example.com',password:pass}).expect(403);
 const verification=mail[0].token;
 await api.post('/auth/verify-email').send({token:verification}).expect(200);
 await api.post('/auth/verify-email').send({token:verification}).expect(400);
 let session=(await api.post('/auth/login').send({email:'a@example.com',password:pass}).expect(200)).body;
 const rotated=(await api.post('/auth/refresh').send({refreshToken:session.refreshToken}).expect(200)).body;
 await api.get('/users/me').auth(session.accessToken,{type:'bearer'}).expect(401);
 await api.post('/auth/refresh').send({refreshToken:session.refreshToken}).expect(401);
 await api.get('/users/me').auth(rotated.accessToken,{type:'bearer'}).expect(401);
 session=(await api.post('/auth/login').send({email:'a@example.com',password:pass})).body;
 await api.post('/auth/forgot-password').send({email:'a@example.com'}).expect(200);
 await api.post('/auth/reset-password').send({token:mail.at(-1)!.token,password:pass+'new'}).expect(200);
 await api.get('/users/me').auth(session.accessToken,{type:'bearer'}).expect(401);
 await api.post('/auth/reset-password').send({token:mail.at(-1)!.token,password:pass}).expect(400);
 await api.post('/auth/login').send({email:'a@example.com',password:pass}).expect(401);
 await api.post('/auth/login').send({email:'a@example.com',password:pass+'new'}).expect(200);
 }finally{db.close();}
});
test('private profiles, follow acceptance, search, settings and logout',async()=>{
 const {api,db,mail}=fixture();try{
 async function register(name:string){await api.post('/auth/register').send({email:`${name}@example.com`,username:name,name,password:pass}).expect(201);await api.post('/auth/verify-email').send({token:mail.at(-1)!.token}).expect(200);const s=(await api.post('/auth/login').send({email:`${name}@example.com`,password:pass})).body;const me=(await api.get('/users/me').auth(s.accessToken,{type:'bearer'})).body;return {...s,...me};}
 const a=await register('alice'),b=await register('bob');
 const get=(path:string,who=a)=>api.get(path).auth(who.accessToken,{type:'bearer'});
 await api.patch('/users/me').auth(b.accessToken,{type:'bearer'}).send({bio:'Private biography'}).expect(200);
 await api.patch('/users/me/settings').auth(b.accessToken,{type:'bearer'}).send({isPrivate:true}).expect(200);
 assert.equal((await get(`/users/${b.id}`)).body.bio,undefined);
 await api.post(`/users/${b.id}/follow`).auth(a.accessToken,{type:'bearer'}).expect(200);
 assert.equal((await get(`/users/${b.id}`)).body.bio,undefined);
 assert.equal((await get('/users/me/follow-requests',b)).body.length,1);
 await api.post(`/users/me/follow-requests/${a.id}/accept`).auth(b.accessToken,{type:'bearer'}).expect(204);
 assert.equal((await get(`/users/${b.id}`)).body.bio,'Private biography');
 assert.equal((await get('/users/search?q=bob')).body.length,1);
 assert.equal((await get('/users/suggestions')).body.length,0);
 await api.delete(`/users/${b.id}/follow`).auth(a.accessToken,{type:'bearer'}).expect(204);
 assert.equal((await get(`/users/${b.id}`)).body.bio,undefined);
 await api.post('/auth/logout').auth(a.accessToken,{type:'bearer'}).expect(204);
 await get('/users/me').expect(401);
 await api.get('/users/search?q=bob').expect(401);
 }finally{db.close();}
});
test('validation, duplicate accounts and unavailable OAuth',async()=>{const {api,db}=fixture();try{
 await api.post('/auth/register').send({}).expect(400);
 const data={email:'a@example.com',username:'alice',name:'Alice',password:pass};
 await api.post('/auth/register').send(data).expect(201);
 await api.post('/auth/register').send(data).expect(409);
 await api.post('/auth/google').send({idToken:'fake'}).expect(503);
 await api.post('/auth/refresh').send({refreshToken:'fake'}).expect(401);
 }finally{db.close();}});
