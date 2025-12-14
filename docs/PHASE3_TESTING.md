# Phase 3 End-to-End Testing Guide

## Overview

This guide provides step-by-step instructions for testing the complete email verification and password reset flows in the authentication system.

## Prerequisites

1. **Backend running**: `npm run dev` in root directory
2. **Demo app running**: `npm run dev` in `demo-app` directory
3. **Email system configured**: AWS SES or development mode logging
4. **Clean database**: No existing test users

## Test Environment Setup

```bash
# Terminal 1: Start backend
cd /Users/logan.powell/Documents/projects/logan/cf-auth
npm run dev

# Terminal 2: Start demo app
cd /Users/logan.powell/Documents/projects/logan/cf-auth/demo-app
npm run dev

# Terminal 3: Monitor logs (optional)
cd /Users/logan.powell/Documents/projects/logan/cf-auth
wrangler tail
```

---

## Test 1: Email Verification Flow

### Objective

Verify that the complete registration → email verification → login flow works correctly with all UI states and toast notifications.

### Steps

#### 1. Register New User

- [ ] Navigate to http://localhost:5173
- [ ] Click "Create an account" link
- [ ] Fill in registration form:
  - Email: `test-user-${Date.now()}@example.com`
  - Display Name: `Test User`
  - Password: `Test123!@#`
- [ ] Submit form

**Expected Results:**

- ✅ Form submits without errors
- ✅ Redirected to login page
- ✅ Toast notification shows "Registration successful! Please check your email..."
- ✅ Console shows email content (if in development mode)
- ✅ Database has new user with `email_verified = 0`

#### 2. Check Email Content

- [ ] Check backend console for email output
- [ ] Verify email contains:
  - Subject: "Verify your email address"
  - Verification link with token
  - Professional HTML formatting
  - Fallback plain text version

**Expected Results:**

- ✅ Email template renders correctly
- ✅ Verification link format: `http://localhost:5173/verify-email?token=...`
- ✅ Token is valid (64-character hex string)

#### 3. Verify Email

- [ ] Copy verification token from email
- [ ] Navigate to: `http://localhost:5173/verify-email?token=<TOKEN>`
- [ ] Wait for verification to process

**Expected Results:**

- ✅ Page shows "Verifying your email..." loading state
- ✅ Successful verification message appears
- ✅ Toast notification shows "Email verified successfully!"
- ✅ Auto-redirects to login page after 2 seconds
- ✅ Database updated: `email_verified = 1`, `email_verified_at` set

#### 4. Login with Verified Account

- [ ] Fill in login form with registered credentials
- [ ] Submit form

**Expected Results:**

- ✅ Login successful
- ✅ Redirected to `/dashboard`
- ✅ Dashboard shows user info
- ✅ Email verification badge shows "Verified" (green)
- ✅ No "Resend verification" button visible

### Error Cases to Test

#### A. Invalid/Expired Token

- [ ] Navigate to: `http://localhost:5173/verify-email?token=invalid`
- **Expected**: Error message "Invalid or expired verification token"

#### B. Already Verified Email

- [ ] Copy original verification token
- [ ] Try to verify again
- **Expected**: Error message "Email already verified" or "Token already used"

#### C. Login Before Verification

- [ ] Register new user
- [ ] Try to login without verifying
- **Expected**: Login succeeds (no email verification requirement for login)
- [ ] Dashboard shows "Unverified" badge
- [ ] "Resend verification" button visible

---

## Test 2: Password Reset Flow

### Objective

Verify the complete forgot password → reset → confirmation → login flow with all security measures and notifications.

### Steps

#### 1. Request Password Reset

- [ ] Navigate to http://localhost:5173
- [ ] Click "Forgot password?" link
- [ ] Enter email of existing user
- [ ] Submit form

**Expected Results:**

- ✅ Form submits without errors
- ✅ Success message appears (even for non-existent email - security)
- ✅ Toast notification shows "If email exists, reset link sent..."
- ✅ Console shows password reset email (if in development mode)
- ✅ Database has new entry in `password_reset_tokens`

#### 2. Check Password Reset Email

- [ ] Check backend console for email output
- [ ] Verify email contains:
  - Subject: "Reset your password"
  - Reset link with token
  - Security warning
  - Expiration time (1 hour)

**Expected Results:**

- ✅ Email template renders correctly
- ✅ Reset link format: `http://localhost:5173/reset-password?token=...`
- ✅ Token is valid (64-character hex string)
- ✅ Security message: "If you didn't request this..."

#### 3. Reset Password

- [ ] Copy reset token from email
- [ ] Navigate to: `http://localhost:5173/reset-password?token=<TOKEN>`
- [ ] Enter new password: `NewTest123!@#`
- [ ] Confirm new password: `NewTest123!@#`
- [ ] Submit form

**Expected Results:**

- ✅ Token validation succeeds
- ✅ Form submits without errors
- ✅ Success message appears
- ✅ Toast notification shows "Password reset successful!"
- ✅ Database updated with new password hash
- ✅ Reset token marked as used
- ✅ Password changed confirmation email sent

#### 4. Check Password Changed Email

- [ ] Check backend console for email output
- [ ] Verify email contains:
  - Subject: "Your password was changed"
  - Security warnings
  - Account recovery link
  - Support contact info

**Expected Results:**

- ✅ Email template renders correctly
- ✅ Security warnings present
- ✅ Professional formatting

#### 5. Login with New Password

- [ ] Navigate to http://localhost:5173
- [ ] Enter email and NEW password
- [ ] Submit form

**Expected Results:**

- ✅ Login successful with new password
- ✅ Redirected to `/dashboard`
- ✅ Old password no longer works

#### 6. Verify Old Password Rejected

- [ ] Logout
- [ ] Try to login with OLD password
- [ ] Submit form

**Expected Results:**

- ✅ Login fails
- ✅ Error message: "Invalid email or password"

### Error Cases to Test

#### A. Invalid/Expired Reset Token

- [ ] Navigate to: `http://localhost:5173/reset-password?token=invalid`
- [ ] Try to submit new password
- **Expected**: Error message "Invalid or expired reset token"

#### B. Password Mismatch

- [ ] Enter valid reset token
- [ ] Enter password: `Test123!@#`
- [ ] Enter confirmation: `Different123!@#`
- [ ] Submit form
- **Expected**: Validation error "Passwords do not match"

#### C. Weak Password

- [ ] Enter valid reset token
- [ ] Enter password: `weak`
- [ ] Submit form
- **Expected**: Validation error about password requirements

#### D. Used Reset Token

- [ ] Use same reset token twice
- **Expected**: Error message "Token has already been used"

#### E. Rate Limiting (If Implemented)

- [ ] Request password reset 4+ times rapidly
- **Expected**: Rate limit error after threshold

---

## Test 3: Settings Page Password Change

### Objective

Verify authenticated users can change their password through settings.

### Steps

#### 1. Access Settings

- [ ] Login to dashboard
- [ ] Navigate to http://localhost:5173/settings
- [ ] Verify settings page loads

**Expected Results:**

- ✅ Settings page displays user info
- ✅ Password change form visible
- ✅ Form requires current + new password

#### 2. Change Password (Success)

- [ ] Enter current password
- [ ] Enter new password: `Changed123!@#`
- [ ] Confirm new password: `Changed123!@#`
- [ ] Submit form

**Expected Results:**

- ✅ Form submits without errors
- ✅ Success message appears
- ✅ Toast notification shows "Password changed successfully!"
- ✅ Password changed email sent
- ✅ User remains logged in

#### 3. Verify New Password Works

- [ ] Logout
- [ ] Login with new password
- **Expected**: Login successful

### Error Cases to Test

#### A. Wrong Current Password

- [ ] Enter incorrect current password
- [ ] Enter new password
- [ ] Submit form
- **Expected**: Error message "Current password is incorrect"

#### B. Same as Current Password

- [ ] Enter current password correctly
- [ ] Enter same password as new password
- [ ] Submit form
- **Expected**: Error message "New password must be different"

---

## Test 4: Resend Verification Email

### Objective

Verify users can resend verification emails from dashboard.

### Steps

#### 1. Register Unverified User

- [ ] Register new user
- [ ] Login without verifying email
- [ ] Navigate to dashboard

**Expected Results:**

- ✅ Dashboard shows "Unverified" badge
- ✅ "Resend verification email" button visible

#### 2. Resend Verification

- [ ] Click "Resend verification email" button
- [ ] Wait for response

**Expected Results:**

- ✅ Toast notification shows "Verification email sent!"
- ✅ New email appears in console
- ✅ New token generated (different from original)
- ✅ Button disabled temporarily (prevent spam)

#### 3. Verify with New Token

- [ ] Copy new verification token
- [ ] Navigate to verification URL
- **Expected**: Verification succeeds

### Error Cases to Test

#### A. Resend for Already Verified

- [ ] Login as verified user
- **Expected**: No resend button visible

#### B. Rate Limiting (If Implemented)

- [ ] Click resend multiple times rapidly
- **Expected**: Rate limit error or button disabled

---

## Test 5: Toast Notifications

### Objective

Verify toast notifications work correctly across all flows.

### Toast Types to Verify

#### Success Toasts (Green)

- [ ] Registration successful
- [ ] Email verified
- [ ] Password reset email sent
- [ ] Password changed
- [ ] Verification email resent

#### Error Toasts (Red)

- [ ] Invalid credentials
- [ ] Invalid/expired tokens
- [ ] Form validation errors
- [ ] Network errors

#### Info Toasts (Blue)

- [ ] Loading states
- [ ] Redirecting messages

### Toast Behavior to Check

- [ ] Auto-dismisses after 5 seconds
- [ ] Can be manually dismissed with X button
- [ ] Multiple toasts stack correctly
- [ ] Toasts animate in/out smoothly
- [ ] Toasts are accessible (keyboard navigation)

---

## Test 6: Edge Cases & Security

### Email Enumeration Protection

- [ ] Request password reset for non-existent email
- **Expected**: Same success message (no hint that email doesn't exist)

### Token Security

- [ ] Verify tokens are single-use
- [ ] Verify tokens expire (verification: 24h, reset: 1h)
- [ ] Verify tokens are cryptographically secure (64+ chars)

### SQL Injection Prevention

- [ ] Try `' OR '1'='1` in email field
- **Expected**: Treated as literal string, no SQL execution

### XSS Prevention

- [ ] Try `<script>alert('XSS')</script>` in display name
- **Expected**: Escaped/sanitized in output

---

## Checklist Summary

### Email Verification Flow

- [ ] Registration sends email
- [ ] Verification link works
- [ ] Verified badge updates
- [ ] Resend verification works

### Password Reset Flow

- [ ] Forgot password sends email
- [ ] Reset link works
- [ ] New password saves
- [ ] Confirmation email sends
- [ ] Old password rejected

### Settings Password Change

- [ ] Current password validation
- [ ] New password updates
- [ ] Confirmation email sends

### UI/UX

- [ ] All toasts display correctly
- [ ] Loading states show
- [ ] Error messages clear
- [ ] Form validation works
- [ ] Redirects happen properly

### Security

- [ ] Tokens are single-use
- [ ] Tokens expire correctly
- [ ] Email enumeration protected
- [ ] Passwords hashed properly
- [ ] XSS/SQL injection prevented

---

## Production Testing (AWS SES)

When ready to test with AWS SES:

### Prerequisites

1. Domain verified in AWS SES
2. Out of sandbox mode (or test emails in verified list)
3. Environment variables configured
4. DKIM/SPF/DMARC DNS records set

### Steps

1. [ ] Set `EMAIL_MODE=production` in environment
2. [ ] Deploy to staging/production
3. [ ] Run all tests above with real emails
4. [ ] Check AWS SES metrics for delivery rates
5. [ ] Monitor bounce/complaint rates
6. [ ] Verify emails don't go to spam

### AWS SES Monitoring

- [ ] Check delivery metrics in SES console
- [ ] Monitor SNS notifications for bounces
- [ ] Review CloudWatch logs for errors
- [ ] Test with multiple email providers (Gmail, Outlook, etc.)

---

## Automation Recommendations

Consider implementing automated E2E tests using:

- **Playwright** or **Cypress** for browser automation
- **Mailhog** or **Mailtrap** for email testing in CI/CD
- **GitHub Actions** for automated test runs on PR

Example test structure:

```typescript
test("complete email verification flow", async ({ page }) => {
  // Register
  await page.goto("/register");
  await page.fill('[name="email"]', generateTestEmail());
  // ... continue flow

  // Get verification token from test email service
  const token = await getLastEmailToken();

  // Verify email
  await page.goto(`/verify-email?token=${token}`);

  // Assert success
  await expect(page.locator(".toast-success")).toBeVisible();
});
```

---

## Reporting Issues

When reporting bugs found during testing:

1. **Include**:

   - Test flow being executed
   - Expected vs actual behavior
   - Screenshots/screen recordings
   - Console errors
   - Network tab (if relevant)

2. **Format**:
   ```markdown
   **Test**: Email Verification Flow - Step 3
   **Expected**: Verification success toast appears
   **Actual**: No toast shown, console error
   **Error**: `TypeError: Cannot read property 'user' of undefined`
   **Screenshot**: [attach]
   ```

---

## Next Steps After Testing

Once all tests pass:

1. [ ] Mark Phase 3 as **100% Complete** ✅
2. [ ] Update PLAN.md status section
3. [ ] Document any issues found
4. [ ] Create tickets for any bugs
5. [ ] Begin Phase 4: Permission System
