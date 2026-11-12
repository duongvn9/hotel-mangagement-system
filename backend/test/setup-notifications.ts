// E2E runs must never use live SMTP, even when a developer's .env enables mail.
process.env.NOTIFICATIONS_ENABLED = 'false';
