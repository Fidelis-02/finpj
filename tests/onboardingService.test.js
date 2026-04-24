const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ONBOARDING_STEPS,
    createInitialOnboardingState,
    getNextStep,
    mergeOnboardingState
} = require('../src/services/onboardingService');

test('onboarding steps stay in the expected product order', () => {
    assert.deepEqual(ONBOARDING_STEPS, [
        'verify-email',
        'profile',
        'plan',
        'template',
        'checklist',
        'first-value'
    ]);
});

test('createInitialOnboardingState starts on email verification for new users', () => {
    const state = createInitialOnboardingState({
        id: 'user-1',
        email: 'user@example.com'
    });

    assert.equal(state.userId, 'user-1');
    assert.equal(state.currentStep, 'verify-email');
    assert.deepEqual(state.completedSteps, []);
});

test('verified users skip verify-email and completed steps advance currentStep', () => {
    const verifiedState = createInitialOnboardingState({
        id: 'user-2',
        email: 'verified@example.com',
        emailVerifiedAt: new Date().toISOString()
    });

    assert.deepEqual(verifiedState.completedSteps, ['verify-email']);
    assert.equal(verifiedState.currentStep, 'profile');
    assert.equal(getNextStep(['verify-email', 'profile', 'plan']), 'template');
});

test('mergeOnboardingState stores step data and marks completion', () => {
    const current = createInitialOnboardingState({
        id: 'user-3',
        email: 'user3@example.com'
    });
    const merged = mergeOnboardingState(current, {
        step: 'verify-email',
        data: { verifiedAt: '2026-04-23T12:00:00.000Z' },
        completed: true
    });

    assert.deepEqual(merged.completedSteps, ['verify-email']);
    assert.equal(merged.currentStep, 'profile');
    assert.deepEqual(merged.data['verify-email'], {
        verifiedAt: '2026-04-23T12:00:00.000Z'
    });
});
