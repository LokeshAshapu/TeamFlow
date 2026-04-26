# TeamFlow LMS Platform

A modern Learning Management and Team Collaboration system built with React, Express, and Supabase.

## Features
- **Real-time Collaboration**: Chat and task tracking powered by Supabase and Socket.IO.
- **Team Management**: Robust admin tools for managing teams and members.
- **WebRTC Video Calls**: Integrated video conferencing (Local dev only, requires dedicated WebSocket server for production).
- **Secure Auth**: Powered by Supabase Auth with Row-Level Security (RLS).

## Local Development

### 1. Setup Database (Supabase)
- Run the SQL commands in `supabase/schema.sql` in your Supabase SQL Editor.
- Ensure you have the `teams`, `profiles`, `tasks`, `messages`, and `activities` tables with RLS enabled.

### 2. Configure Environment Variables
- Copy `client/.env.example` to `client/.env` and fill in your Supabase credentials.
- Copy `server/.env.example` to `server/.env` and fill in your Supabase credentials and Service Role Key.

### 3. Install Dependencies & Run
```bash
# In the client directory
npm install
npm run dev

# In the server directory
npm install
npm run dev
```

## Deployment

### GitHub
1. Create a new repository on GitHub.
2. Initialize git and push the project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

### Vercel
1. Connect your GitHub repository to Vercel.
2. **Deploy Client**:
   - Create a new project.
   - Set "Root Directory" to `client`.
   - Add environment variables from `client/.env`.
3. **Deploy Server**:
   - Create a another project.
   - Set "Root Directory" to `server`.
   - Add environment variables from `server/.env`.
   - *Note*: Socket.IO features will not work on Vercel Serverless. For full real-time support, consider deploying the server to Render or Railway.

## License
MIT
