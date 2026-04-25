const test = require('node:test');
const assert = require('node:assert/strict');

function loadEmailService() {
    delete require.cache[require.resolve('../src/services/emailService')];
    return require('../src/services/emailService');
}

test('emailTransportConfigured only returns true with host, user and secret', () => {
    const original = {
        MAIL_HOST: process.env.MAIL_HOST,
        MAIL_USER: process.env.MAIL_USER,
        MAIL_PASS: process.env.MAIL_PASS,
        BREVO_API_KEY: process.env.BREVO_API_KEY
    };

    delete process.env.MAIL_HOST;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;
    delete process.env.BREVO_API_KEY;
    assert.equal(loadEmailService().emailTransportConfigured(), false);

    process.env.MAIL_HOST = 'smtp.example.com';
    process.env.MAIL_USER = 'user@example.com';
    assert.equal(loadEmailService().emailTransportConfigured(), false);

    process.env.BREVO_API_KEY = 'brevo-secret';
    assert.equal(loadEmailService().emailTransportConfigured(), true);

    delete process.env.BREVO_API_KEY;
    process.env.MAIL_PASS = 'smtp-password';
    assert.equal(loadEmailService().emailTransportConfigured(), true);

    if (original.MAIL_HOST === undefined) delete process.env.MAIL_HOST;
    else process.env.MAIL_HOST = original.MAIL_HOST;
    if (original.MAIL_USER === undefined) delete process.env.MAIL_USER;
    else process.env.MAIL_USER = original.MAIL_USER;
    if (original.MAIL_PASS === undefined) delete process.env.MAIL_PASS;
    else process.env.MAIL_PASS = original.MAIL_PASS;
    if (original.BREVO_API_KEY === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = original.BREVO_API_KEY;
});
