# VPS Migration Preparation

## Overview
This document outlines the migration of Hisabche from local development to a Virtual Private Server (VPS) environment. This migration is necessary for production deployment and scaling.

## Server Requirements

### Hardware Specifications
- **CPU**: Intel Xeon or AMD EPYC, minimum 4 cores
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: SSD, minimum 50GB, 100GB recommended
- **Network**: Static IP address, 100Mbps+ bandwidth

### Software Requirements
- Ubuntu 20.04 LTS or later
- Node.js 18.x or later
- PostgreSQL 14.x or later
- Redis (optional, for caching)
- Nginx (optional, for reverse proxy)

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL=postgresql://username:password@hostname:5432/dbname

# Application
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com

# Email (if using)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=production
PORT=3000

# Logging
LOG_LEVEL=info

# Cache
NEXT_PUBLIC_CACHE_ENABLED=true
```

## Database Migration

### Backup Current Database
```bash
pg_dump -h localhost -U your_user -d your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Migrate to New Database
1. Create new database on VPS:
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE hisabche;
GRANT ALL PRIVILEGES ON DATABASE hisabche TO your_user;
```

2. Import backup:
```bash
pg_restore -h your-vps-host -U your_user -d hisabche backup_file.sql
```

3. Update database configuration:
- Modify `packages/db` configuration
- Update connection strings
- Run database migrations (if any)

## Build Commands

### Local Development
```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start application
npm run dev
```

### Production Deployment
```bash
# Install dependencies
npm install --production

# Build application
npm run build

# Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name hisabche "run start"

# Or with systemd
sudo cp hisabche.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hisabche
sudo systemctl start hisabche
```

### Docker Deployment
```bash
# Create docker-compose.yml
docker-compose up -d

# Build and deploy
docker-compose build --no-cache
docker-compose up -d
```

## Deployment Steps

### Step 1: Prepare VPS
1. Connect to VPS via SSH
2. Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

3. Install Node.js and npm:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

4. Install PostgreSQL:
```bash
sudo apt install -y postgresql postgresql-contrib
```

5. Configure firewall:
```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Step 2: Prepare Application
1. Clone repository to VPS
2. Copy .env file
3. Install dependencies
4. Build application

### Step 3: Configure Services
1. Set up PostgreSQL user and database
2. Configure application environment variables
3. Set up log rotation
4. Configure monitoring (optional)

### Step 4: Deploy Application
1. Start application
2. Configure reverse proxy (nginx/apache)
3. Set up SSL certificates
4. Configure backup and restore
5. Test application

## Rollback Steps

### Emergency Rollback
1. Stop application:
```bash
pm2 stop hisabche
sudo systemctl stop hisabche
```

2. Restore database backup:
```bash
pg_dropdatabase hisabche
pg_restore -U your_user -d hisabche /path/to/backup.sql
```

3. Restart application:
```bash
pm2 start hisabche
sudo systemctl start hisabche
```

### Version Rollback
If you need to rollback to a previous version:
```bash
# Check available versions
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>
npm run build
pm2 restart hisabche
```

## Monitoring and Maintenance

### Monitoring
- Set up application monitoring (pm2, sentry, etc.)
- Configure log monitoring
- Set up database monitoring
- Monitor resource usage

### Backup and Recovery
- Daily database backups
- Weekly full system backups
- Test restore procedures
- Store backups in multiple locations

### Security Updates
- Regular security audits
- Keep dependencies updated
- Monitor for security vulnerabilities
- Update SSL certificates

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
sudo -u postgres psql -h localhost -U your_user -d hisabche
```

2. **Node.js Version Issues**
```bash
# Check Node.js version
node --version

# Install specific version
nvm install 18.19.0
nvm use 18.19.0
```

3. **Application Not Starting**
```bash
# Check logs
pm2 logs hisabche

# Check process status
pm2 status

# Start manually for debugging
npm start
```

## Post-Migration Checklist

- [ ] Application is running correctly
- [ ] All features are working
- [ ] Performance is acceptable
- [ ] Database is properly backed up
- [ ] Monitoring is configured
- [ ] SSL certificates are installed
- [ ] Security measures are in place
- [ ] Documentation is updated
- [ ] Team is trained on new procedures

## Support

For migration issues, contact support or refer to the Hisabche documentation.