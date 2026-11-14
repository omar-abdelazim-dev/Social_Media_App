import 'dotenv/config';
import nodemailer from 'nodemailer';
import { createApp } from './app.js';
const transport=process.env.SMTP_HOST?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_PORT==='465',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined}):null;
if(process.env.NODE_ENV==='production'&&!transport)throw new Error('SMTP is required in production');
const {app,db}=createApp({databasePath:process.env.DATABASE_PATH??'data/social.sqlite',secret:process.env.JWT_SECRET??'',googleClientId:process.env.GOOGLE_CLIENT_ID,
  async sendMail(to,kind,token){const text=`${kind==='verify'?'Verify your email':'Reset your password'} using this token: ${token}\nSubmit it to POST /auth/${kind==='verify'?'verify-email':'reset-password'}.`;
    if(transport)await transport.sendMail({from:process.env.MAIL_FROM,to,subject:kind==='verify'?'Verify your email':'Reset your password',text});
    else console.log(`[development email] ${to}\n${text}`);
  }});
const server=app.listen(Number(process.env.PORT??3000),()=>console.log('Social App API listening'));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
