# ServeMate Backend

## Stack
- Node.js + Express
- MongoDB (Mongoose)
- JWT Auth + bcryptjs

## Setup
```bash
npm install
cp .env.example .env
# Fill in your MONGO_URI and JWT_SECRET in .env
node index.js
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | User signup |
| POST | /api/auth/login | User login |
| GET | /api/auth/me | Current user (JWT required) |
| POST | /api/auth/ngo/register | NGO application |
| POST | /api/auth/ngo/login | NGO login (verified only) |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/causes | All active causes |
| GET | /api/causes/:id | Single cause |
| GET | /api/ngos | Verified NGOs |
| GET | /api/ngos/:id | NGO + recent work |
| GET | /api/transparency | Public proof log |
| GET | /api/leaderboard/donors | Top donors |
| GET | /api/leaderboard/ngos | Top NGOs |
| GET | /api/stats | Platform stats |
| POST | /api/contact | Contact form |

### Protected (JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/donate | Make a donation |
| GET | /api/donations/history | User donation history |
| GET | /api/dashboard | Full dashboard data |

### Admin (Admin JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/overview | Platform stats |
| GET | /api/admin/ngos/pending | Unverified NGOs |
| PATCH | /api/admin/ngos/:id/verify | Approve NGO |
| POST | /api/admin/causes | Create cause |
| PATCH | /api/admin/donations/:id/complete | Mark done + add proof |
| PATCH | /api/admin/donations/:id/verify | Final verify |
| GET | /api/admin/contacts | Contact messages |

## Deploy on Render
1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variables: MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
4. Start command: `node index.js`
