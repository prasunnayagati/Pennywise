import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { v4 as uuid } from "uuid";
import { fileURLToPath } from "node:url";
import { initStore, read, update, resetStore, uploadsDir } from "./store.js";
import { auth, AuthError } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 5000;
const here = path.dirname(fileURLToPath(import.meta.url));
app.disable("x-powered-by");
app.set("trust proxy", 1);
const configuredOrigins = new Set((process.env.CLIENT_ORIGIN || "").split(",").map(value => value.trim()).filter(Boolean));
function isAllowedOrigin(origin) {
  if (configuredOrigins.has(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && url.port === "5173";
  } catch {
    return false;
  }
}
app.use(cors({
  origin(origin, callback) {
    callback(null, origin && isAllowedOrigin(origin) ? origin : false);
  },
  credentials: true
}));
app.use(express.json({limit:"1mb"}));
function verifyRequestOrigin(req,res,next) {
  if(req.method==="OPTIONS")return next();
  const origin=req.get("origin"),site=req.get("sec-fetch-site");
  const requestOrigin = `${req.protocol}://${req.get("host")}`;
  if(origin&&origin!==requestOrigin&&!isAllowedOrigin(origin))return res.status(403).json({error:"Request origin is not allowed."});
  if(!origin&&site&&site!=="same-origin"&&site!=="none"){
    const referrer=req.get("referer");
    let referrerOrigin;
    try{referrerOrigin=referrer?new URL(referrer).origin:""}catch{return res.status(403).json({error:"Request origin is not allowed."})}
    if(!isAllowedOrigin(referrerOrigin))return res.status(403).json({error:"Request origin is not allowed."});
  }
  next();
}
app.use("/api",verifyRequestOrigin);
const categories = ["Food & Dining","Shopping","Transportation","Bills & Utilities","Education","Healthcare","Entertainment","Travel","Housing","Other","Salary","Freelance"];
const fail = (res, msg, status=400) => res.status(status).json({error:msg});
const validAmount = v => Number.isFinite(Number(v)) && Number(v)>0;
const upload = multer({
  storage: multer.diskStorage({destination:uploadsDir,filename:(req,file,cb)=>cb(null,uuid()+path.extname(file.originalname).toLowerCase())}),
  limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=>cb(null,["image/jpeg","image/png","image/webp"].includes(file.mimetype))
});
app.get("/api/health",(req,res)=>res.json({status:"ok",service:"Pennywise API"}));
app.get("/api/auth/session",(req,res)=>{
  res.set("Cache-Control","no-store");
  const session=auth.getSession(req);
  res.json(session?{authenticated:true,username:session.username}:{authenticated:false,setupRequired:auth.needsSetup()});
});
const failedLoginAttempts = new Map();
const failedSetupAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxFailedLogins = 5;
app.post("/api/auth/setup",async(req,res,next)=>{
  res.set("Cache-Control","no-store");
  const key=req.ip||req.socket.remoteAddress||"unknown",now=Date.now();
  let attempts=failedSetupAttempts.get(key);
  if(!attempts||attempts.expiresAt<=now){attempts={count:0,expiresAt:now+loginWindowMs};failedSetupAttempts.set(key,attempts)}
  if(attempts.count>=maxFailedLogins){res.set("Retry-After",String(Math.ceil((attempts.expiresAt-now)/1000)));return fail(res,"Too many setup attempts. Try again later.",429)}
  try{
    const {setupToken,username,password}=req.body||{};
    await auth.setupAccount(setupToken,username,password);
    failedSetupAttempts.delete(key);
    auth.setSessionCookie(req,res);
    res.json({authenticated:true,username:username.trim()});
  }catch(error){
    if(error instanceof AuthError){
      if(error.status===403)attempts.count++;
      return fail(res,error.message,error.status);
    }
    next(error);
  }
});
app.post("/api/auth/login",async(req,res,next)=>{
  res.set("Cache-Control","no-store");
  const key=req.ip||req.socket.remoteAddress||"unknown",now=Date.now();
  let attempts=failedLoginAttempts.get(key);
  if(!attempts||attempts.expiresAt<=now){attempts={count:0,expiresAt:now+loginWindowMs};failedLoginAttempts.set(key,attempts)}
  if(attempts.count>=maxFailedLogins){res.set("Retry-After",String(Math.ceil((attempts.expiresAt-now)/1000)));return fail(res,"Too many sign-in attempts. Try again later.",429)}
  if(auth.needsSetup())return fail(res,"Complete the one-time account setup first.",409);
  try{
    const {username,password}=req.body||{};
    if(!(await auth.verifyCredentials(username,password))){
      attempts.count++;
      return fail(res,"Invalid username or password.",401);
    }
    failedLoginAttempts.delete(key);
    auth.setSessionCookie(req,res);
    res.set("Cache-Control","no-store");
    res.json({authenticated:true,username:username.trim()});
  }catch(error){next(error)}
});
app.post("/api/auth/logout",(req,res)=>{
  auth.clearSessionCookie(req,res);
  res.set("Cache-Control","no-store");
  res.json({success:true});
});
app.use("/api",auth.requireAuth);
app.post("/api/auth/change-password",async(req,res,next)=>{
  try{
    await auth.changePassword(req.authenticatedUser,req.body?.currentPassword,req.body?.newPassword);
    auth.setSessionCookie(req,res,req.authenticatedUser);
    res.set("Cache-Control","no-store");
    res.json({success:true});
  }catch(error){
    if(error instanceof AuthError)return fail(res,error.message,error.status);
    next(error);
  }
});
app.use("/uploads",verifyRequestOrigin,auth.requireAuth,express.static(uploadsDir,{setHeaders:res=>res.setHeader("Cache-Control","private, no-store")}));

app.get("/api/transactions",(req,res)=>{
  let {type,category,month,search}=req.query;
  let rows=read().transactions.filter(t=>(!type||t.type===type)&&(!category||t.category===category)&&(!month||t.date.startsWith(month))&&(!search||`${t.description} ${t.category} ${t.note||""}`.toLowerCase().includes(search.toLowerCase())));
  rows.sort((a,b)=>b.date.localeCompare(a.date));res.json(rows);
});
app.post("/api/transactions",(req,res)=>{
  const {description,amount,type,category,date,note=""}=req.body;
  if(!description?.trim()||!validAmount(amount)||!["Income","Expense"].includes(type)||!category||!date)return fail(res,"Enter a description, valid amount, type, category and date.");
  const now=new Date().toISOString();
  const item={id:uuid(),description:description.trim(),amount:Number(amount),type,category,date,note:String(note).slice(0,500),receiptId:null,createdAt:now,updatedAt:now};
  update(db=>db.transactions.push(item));res.status(201).json(item);
});
app.put("/api/transactions/:id",(req,res)=>{
  const {description,amount,type,category,date,note=""}=req.body;let result;
  update(db=>{let t=db.transactions.find(x=>x.id===req.params.id);if(!t)return; if(!description?.trim()||!validAmount(amount)||!["Income","Expense"].includes(type)||!category||!date)return;Object.assign(t,{description:description.trim(),amount:Number(amount),type,category,date,note:String(note).slice(0,500),updatedAt:new Date().toISOString()});result=t});
  if(!result)return fail(res,"Transaction not found or invalid fields.");res.json(result);
});
app.delete("/api/transactions/:id",(req,res)=>{let found=false;update(db=>{let n=db.transactions.length;db.transactions=db.transactions.filter(t=>t.id!==req.params.id);found=n!==db.transactions.length;if(found)db.receipts.forEach(r=>{if(r.transactionId===req.params.id)r.transactionId=null})});found?res.json({success:true}):fail(res,"Transaction not found.",404)});

app.get("/api/budgets",(req,res)=>res.json(read().budgets));
app.post("/api/budgets",(req,res)=>{let {category,monthlyLimit}=req.body;if(!category||!validAmount(monthlyLimit))return fail(res,"Category and a positive monthly limit are required.");let item;update(db=>{item=db.budgets.find(b=>b.category===category);if(item){item.monthlyLimit=Number(monthlyLimit);item.updatedAt=new Date().toISOString()}else{const now=new Date().toISOString();item={id:uuid(),category,monthlyLimit:Number(monthlyLimit),createdAt:now,updatedAt:now};db.budgets.push(item)}});res.status(201).json(item)});
app.put("/api/budgets/:id",(req,res)=>{let item;update(db=>{item=db.budgets.find(b=>b.id===req.params.id);if(item&&validAmount(req.body.monthlyLimit)){item.monthlyLimit=Number(req.body.monthlyLimit);item.updatedAt=new Date().toISOString()}else item=null});item?res.json(item):fail(res,"Budget not found or invalid amount.")});
app.delete("/api/budgets/:id",(req,res)=>{let found=false;update(db=>{let n=db.budgets.length;db.budgets=db.budgets.filter(x=>x.id!==req.params.id);found=n!==db.budgets.length});found?res.json({success:true}):fail(res,"Budget not found.",404)});

app.get("/api/goals",(req,res)=>res.json(read().goals));
app.post("/api/goals",(req,res)=>{let {name,targetAmount,savedAmount=0,targetDate=""}=req.body;if(!name?.trim()||!validAmount(targetAmount)||!Number.isFinite(Number(savedAmount))||Number(savedAmount)<0||Number(savedAmount)>Number(targetAmount))return fail(res,"Enter a goal name and valid target/saved amounts.");let item={id:uuid(),name:name.trim(),targetAmount:Number(targetAmount),savedAmount:Number(savedAmount),targetDate,createdAt:new Date().toISOString()};update(db=>db.goals.push(item));res.status(201).json(item)});
app.post("/api/goals/:id/contributions",(req,res)=>{let {amount}=req.body;if(!validAmount(amount))return fail(res,"Contribution must be greater than zero.");let item;update(db=>{item=db.goals.find(g=>g.id===req.params.id);if(item)item.savedAmount+=Number(amount)});item?res.json(item):fail(res,"Goal not found.",404)});
app.delete("/api/goals/:id",(req,res)=>{let found=false;update(db=>{let n=db.goals.length;db.goals=db.goals.filter(g=>g.id!==req.params.id);found=n!==db.goals.length});found?res.json({success:true}):fail(res,"Goal not found.",404)});

app.get("/api/subscriptions",(req,res)=>res.json(read().subscriptions));
app.post("/api/subscriptions",(req,res)=>{let {name,amount,frequency,nextDueDate,category="Other"}=req.body;if(!name?.trim()||!validAmount(amount)||!["Weekly","Monthly","Yearly"].includes(frequency)||!nextDueDate)return fail(res,"Enter a name, valid amount, frequency and next due date.");let item={id:uuid(),name:name.trim(),amount:Number(amount),frequency,nextDueDate,category,createdAt:new Date().toISOString()};update(db=>db.subscriptions.push(item));res.status(201).json(item)});
app.delete("/api/subscriptions/:id",(req,res)=>{let found=false;update(db=>{let n=db.subscriptions.length;db.subscriptions=db.subscriptions.filter(x=>x.id!==req.params.id);found=n!==db.subscriptions.length});found?res.json({success:true}):fail(res,"Recurring expense not found.",404)});

app.get("/api/receipts",(req,res)=>res.json(read().receipts));
app.post("/api/receipts",upload.single("receipt"),(req,res)=>{if(!req.file)return fail(res,"Choose a JPG, PNG or WEBP image (maximum 5 MB).");const transactionId=req.body.transactionId||null;if(transactionId){const db=read();if(!db.transactions.some(t=>t.id===transactionId)){fs.unlink(path.join(uploadsDir,req.file.filename)).catch(()=>{});return fail(res,"Transaction not found.",404)}}let item={id:uuid(),originalName:req.file.originalname,storedName:req.file.filename,mimeType:req.file.mimetype,size:req.file.size,transactionId,uploadedAt:new Date().toISOString()};update(db=>{db.receipts.push(item);if(transactionId){const transaction=db.transactions.find(t=>t.id===transactionId);if(transaction)transaction.receiptId=item.id}});res.status(201).json({...item,url:`/uploads/${item.storedName}`})});
app.delete("/api/receipts/:id",async(req,res)=>{let item;update(db=>{item=db.receipts.find(x=>x.id===req.params.id);if(item){db.receipts=db.receipts.filter(x=>x.id!==req.params.id);db.transactions.forEach(t=>{if(t.receiptId===item.id)t.receiptId=null})}});if(!item)return fail(res,"Receipt not found.",404);await fs.unlink(path.join(uploadsDir,item.storedName)).catch(()=>{});res.json({success:true})});

app.get("/api/settings",(req,res)=>res.json(read().settings));
app.put("/api/settings",(req,res)=>{let {displayName,currency,monthlyIncomeTarget}=req.body;if(!["₹","$","€","£"].includes(currency))return fail(res,"Unsupported currency.");let settings;update(db=>{db.settings={displayName:String(displayName||"").slice(0,60),currency,monthlyIncomeTarget:Math.max(0,Number(monthlyIncomeTarget)||0)};settings=db.settings});res.json(settings)});
app.get("/api/analytics/summary",(req,res)=>{let db=read(),month=String(req.query.month||new Date().toISOString().slice(0,7)),tx=db.transactions.filter(t=>t.date.startsWith(month)),income=tx.filter(t=>t.type==="Income").reduce((s,t)=>s+t.amount,0),expenses=tx.filter(t=>t.type==="Expense").reduce((s,t)=>s+t.amount,0),byCategory={};tx.filter(t=>t.type==="Expense").forEach(t=>byCategory[t.category]=(byCategory[t.category]||0)+t.amount);res.json({month,income,expenses,net:income-expenses,balance:db.transactions.reduce((s,t)=>s+(t.type==="Income"?t.amount:-t.amount),0),savingsRate:income?Math.round((income-expenses)/income*100):0,byCategory,transactions:tx.length})});
app.get("/api/analytics/forecast",(req,res)=>{let tx=read().transactions.filter(t=>t.type==="Expense"),totals={};tx.forEach(t=>{let m=t.date.slice(0,7);totals[m]=(totals[m]||0)+t.amount});let vals=Object.keys(totals).sort().map(k=>totals[k]),recent=vals.slice(-3),last=vals.at(-1)||0,avg=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:0;const estimate=vals.length?Math.round(avg*.6+last*.4):0;res.json({estimatedNextMonth:estimate,monthlyAverage:Math.round(avg),monthsUsed:vals.length,method:vals.length===1?"Latest month carried forward; only one month of expense history is available":"60% of the recent three-month average + 40% of the latest month",disclaimer:"An indicative estimate based on manually recorded expenses, not financial advice."})});
app.post("/api/reset",async(req,res)=>{const old=read();for(const receipt of old.receipts||[])await fs.unlink(path.join(uploadsDir,receipt.storedName)).catch(()=>{});res.json(await resetStore())});
const clientDist = path.resolve(here, "../../client/dist");
app.use(express.static(clientDist));
app.get("*",(req,res,next)=>{
  if(req.path==="/api"||req.path.startsWith("/api/"))return next();
  res.sendFile(path.join(clientDist,"index.html"),err=>{if(err)next(err)});
});
app.use((err,req,res,next)=>{console.error(err);if(err instanceof multer.MulterError)return fail(res,err.code==="LIMIT_FILE_SIZE"?"Image must be 5 MB or smaller.":"Upload failed.");res.status(500).json({error:"Something went wrong on the server."})});
await initStore();
const generatedSetupToken=await auth.initialize();
if(generatedSetupToken)console.warn(`Pennywise one-time setup token (enter this in the account setup screen): ${generatedSetupToken}`);
app.listen(PORT,()=>console.log(`Pennywise API listening on http://localhost:${PORT}`));
