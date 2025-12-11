/**
 * Email Service Entry Point
 *
 * Exports email sending functions based on configured provider
 * Currently using AWS SES for production-grade email delivery
 */

export * from "./ses.service";
