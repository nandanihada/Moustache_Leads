# ⚡ Quick Deployment Steps

## 1. Push to GitHub ✅
```bash
git add .
git commit -m 'prepare for deployment'
git push origin main
```

## 2. Deploy Backend (Render) 🔧

### Go to: https://render.com

1. **New Web Service** → Connect GitHub repo
2. **Settings:**
   - Name: `ascend-backend`
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`

3. **Environment Variables:**
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   FLASK_ENV=production
   ```

4. **Deploy** → Wait 5-10 minutes
5. **Copy URL**: `https://ascend-backend.onrender.com`

## 3. Deploy Frontend (Vercel) 🚀

### Go to: https://vercel.com

1. **Import Project** → Select your GitHub repo
2. **Settings:**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Environment Variable:**
   ```
   VITE_API_URL=https://ascend-backend.onrender.com
   ```
   (Use your actual Render URL from step 2)

4. **Deploy** → Wait 2-3 minutes
5. **Copy URL**: `https://your-project.vercel.app`

## 4. Update CORS (Important!) 🔐

After getting your Vercel URL, update `backend/app.py` line 69:

```python
"https://your-project.vercel.app",  # Add your actual Vercel URL
```

Then:
```bash
git add backend/app.py
git commit -m 'add vercel URL to CORS'
git push origin main
```

Render will auto-redeploy.

## 5. Test Postback 🧪

1. **Set up webhook**: https://webhook.site
2. **Create partner** with webhook URL
3. **Create offer** with partner
4. **Run test**:
   ```bash
   cd backend
   python test_postback.py
   ```
5. **Check**:
   - webhook.site for incoming request
   - Admin → Postback Logs in your app

## ✅ Done!

Your app is live:
- Frontend: `https://your-project.vercel.app`
- Backend: `https://ascend-backend.onrender.com`

## 🐛 Troubleshooting

**Backend not working?**
- Check Render logs
- Verify MongoDB URI
- Wait 1-2 minutes for startup

**Frontend can't connect?**
- Check VITE_API_URL in Vercel
- Verify CORS includes your Vercel URL
- Check browser console

**Postbacks not sending?**
- Check partner is active
- Verify offer has partner_id
- Check Postback Logs in admin panel

---

**Need detailed guide?** See `DEPLOYMENT_GUIDE.md`
