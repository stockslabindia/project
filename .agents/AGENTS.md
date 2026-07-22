# StocksLab India — Project Rules

## Infrastructure & Deployment

- **The project is deployed on AWS EC2. Render has been completely deleted and is NOT used.**
- Never mention Render, Render.com, or suggest deploying to Render for this project.
- The backend runs on an AWS EC2 instance at IP: **51.20.248.9**
- SSH user: **ubuntu**
- SSH key: `c:\Users\HP\Desktop\Trading Company Project\stockslab-backend-aws-key.pem`
- Project path on server: **/home/ubuntu/project**
- PM2 process name: **tradex-backend**
- Deployment steps:
  1. `git push origin main` (from local project root)
  2. `ssh -i "stockslab-backend-aws-key.pem" ubuntu@51.20.248.9 "cd /home/ubuntu/project && git pull origin main && pm2 restart tradex-backend"`

