# 📧 Email Testing Quick Reference

## 🚀 Quick Start

```bash
# 1. Start backend (development mode - emails to console)
pnpm run dev

# 2. Run automated tests
./scripts/test-email.sh

# 3. Load helper commands (optional)
source scripts/email-helpers.sh
email_help
```

## 🔧 Helper Commands

Load helpers: `source scripts/email-helpers.sh`

| Command                                  | Description         |
| ---------------------------------------- | ------------------- |
| `email_test_register [email] [password]` | Register test user  |
| `email_test_resend [email]`              | Resend verification |
| `email_check_tokens`                     | View tokens in DB   |
| `email_check_user [email]`               | Check user status   |
| `email_show_mode`                        | Show current mode   |
| `email_mode_development`                 | Switch to dev mode  |
| `email_mode_production`                  | Switch to prod mode |

## 📝 Manual Testing

```bash
# Register
curl -X POST http://localhost:8787/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","display_name":"Test"}'

# Resend
curl -X POST http://localhost:8787/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check DB
wrangler d1 execute auth-db --local \
  --command "SELECT * FROM email_verification_tokens LIMIT 1;"
```

## 🔄 Mode Switching

**Development** (default - logs to console):

```bash
# In wrangler.toml
ENVIRONMENT = "development"
```

**Production** (sends real emails):

```bash
# In wrangler.toml
ENVIRONMENT = "production"
EMAIL_FROM = "noreply@yourdomain.com"  # Must be verified!
```

## ⚙️ Setup Scripts

```bash
# Interactive Email Routing setup
./scripts/setup-email-routing.sh

# Automated email testing
./scripts/test-email.sh

# Load helper commands
source scripts/email-helpers.sh
```

## 📚 Documentation

- [LOCAL_EMAIL_SETUP.md](./LOCAL_EMAIL_SETUP.md) - Complete guide
- [EMAIL_ROUTING_SETUP.md](./EMAIL_ROUTING_SETUP.md) - Cloud setup
- [../infrastructure/README.md](../infrastructure/README.md) - Infrastructure

## ✅ Testing Checklist

- [ ] Backend running: `pnpm run dev`
- [ ] Register user works
- [ ] Email logged to console
- [ ] Token created in DB
- [ ] Resend verification works
- [ ] (Optional) Production mode test

## 🐛 Troubleshooting

**No email in console?**

- Check `ENVIRONMENT = "development"` in wrangler.toml
- Restart backend

**Production mode not sending?**

- Email Routing enabled in Dashboard?
- Sender email verified?
- `EMAIL_FROM` matches verified address?

**"Email service not configured"?**

- Check `[[send_email]]` binding in wrangler.toml
- Restart backend

## 💡 Quick Tips

- Dev mode = No setup needed, emails to console
- Prod mode = Requires Email Routing setup
- Free tier = 100 emails/day
- Monitor usage in Dashboard > Analytics
