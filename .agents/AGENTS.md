# StocksLab India — Project Rules

## Infrastructure & Deployment

- **The project is deployed on AWS. Render has been completely deleted and is NOT used.**
- Never mention Render, Render.com, or suggest deploying to Render for this project.
- The backend runs on an AWS EC2 instance.
- The SSH key for AWS is at: `c:\Users\HP\Desktop\Trading Company Project\stockslab-backend-aws-key.pem`
- Deployment is done via SSH + git pull on the EC2 instance.
- Always push to Git first, then SSH into AWS to pull and restart the backend.

