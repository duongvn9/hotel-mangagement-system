// E2E runs must never use live notification providers, even when a developer's .env enables mail.
process.env.NOTIFICATIONS_ENABLED = 'false';
