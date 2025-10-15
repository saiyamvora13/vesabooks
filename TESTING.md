# Testing Infrastructure Documentation

## Overview

This document describes the testing infrastructure for the AI Storybook Builder application. The test suite provides comprehensive coverage for critical user flows including authentication, payments, and story generation.

## Test Statistics

- **Total Tests**: 42 passing tests
- **Test Files**: 3 test suites
- **Coverage**: Auth API, Payment Flow, Story Generation

## Running Tests

### Run All Tests
```bash
npx vitest run
```

### Run Tests in Watch Mode
```bash
npx vitest
```

### Run Tests with UI
```bash
npx vitest --ui
```

### Run Tests with Coverage
```bash
npx vitest run --coverage
```

## Test Structure

### Configuration Files

#### `vitest.config.ts`
Main Vitest configuration with:
- Node environment for server tests
- Path aliases (@, @shared, @server)
- Test setup files
- Coverage configuration

#### `.env.test`
Test environment variables:
- Mock API keys for Gemini, Stripe, Resend
- Test database configuration
- Disabled rate limiting

### Test Setup Files

#### `tests/server/setup.ts`
- Sets NODE_ENV to 'test'
- Mocks rate limiters
- Configures test environment variables

#### `client/src/__tests__/setup.ts`
- Configures jsdom environment
- Mocks i18next for translation testing
- Mocks window.matchMedia and IntersectionObserver
- Suppresses non-critical console errors

### Test Utilities

#### `tests/shared/fixtures.ts`
Shared test data including:
- Test user accounts (valid, unverified, etc.)
- Sample storybooks
- Purchase records
- Stripe test data
- Story generation test data

#### `tests/server/helpers.ts`
Backend test utilities:
- `TestStorage`: In-memory storage implementation
- `createMockRequest()`: Mock Express request objects
- `createMockResponse()`: Mock Express response objects
- `createAuthenticatedRequest()`: Helper for authenticated requests

#### `tests/server/mocks.ts`
Mock implementations for external services:
- **Gemini AI**: Story generation and image creation
- **Stripe**: Payment processing
- **Resend**: Email delivery

#### `client/src/__tests__/test-utils.tsx`
React testing utilities:
- `renderWithProviders()`: Renders components with React Query, Router, and Toast providers
- Pre-configured test query client
- Memory router support

## Test Suites

### 1. Auth API Tests (`tests/server/auth.test.ts`)
**14 tests covering:**

#### Signup Flow
- ✅ Create user with valid credentials
- ✅ Reject invalid email formats
- ✅ Reject passwords shorter than 8 characters
- ✅ Prevent duplicate email registration
- ✅ Normalize email to lowercase

#### Login Flow
- ✅ Authenticate with correct credentials
- ✅ Reject incorrect password
- ✅ Reject non-existent email
- ✅ Handle case-insensitive email

#### Logout
- ✅ Successfully logout authenticated user

#### Password Reset
- ✅ Create password reset token
- ✅ Retrieve valid reset token
- ✅ Update user password
- ✅ Delete token after use

### 2. Payment Flow Tests (`tests/server/payment.test.ts`)
**13 tests covering:**

#### Cart Pricing
- ✅ Calculate digital purchase price ($3.99)
- ✅ Calculate print purchase price ($24.99)
- ✅ Validate purchase type
- ✅ Reject invalid purchase types

#### Checkout
- ✅ Create Stripe payment intent for digital
- ✅ Create Stripe payment intent for print
- ✅ Prevent duplicate purchases of same type
- ✅ Allow both digital and print for same storybook

#### Purchase Verification
- ✅ Create purchase record after payment
- ✅ Retrieve user purchases
- ✅ Update purchase status
- ✅ Verify purchase ownership
- ✅ Prevent access to other users' purchases

### 3. Story Generation Tests (`tests/server/generation.test.ts`)
**15 tests covering:**

#### Prompt to Story Pipeline
- ✅ Generate story from simple prompt
- ✅ Generate story with custom page count
- ✅ Handle inspiration images
- ✅ Store generated storybook

#### Character Consistency
- ✅ Include main character description
- ✅ Include default clothing
- ✅ Maintain story arc across pages
- ✅ Generate unique image prompts

#### Image Generation
- ✅ Generate illustration from prompt
- ✅ Optimize image for web
- ✅ Generate cover image
- ✅ Generate all page images

#### Error Handling
- ✅ Handle generation failures gracefully
- ✅ Validate minimum prompt length
- ✅ Validate page count limits

## Key Design Decisions

### In-Memory Storage for Tests
Tests use `TestStorage` class instead of real database:
- Fast test execution
- No database setup required
- Isolated test data
- Easy cleanup between tests

### Mocked External Services
All external APIs are mocked:
- **Gemini**: Returns predictable story structures
- **Stripe**: Returns mock payment intents
- **Resend**: Returns mock email receipts

### Rate Limiter Mocking
Rate limiters are disabled in tests to:
- Speed up test execution
- Prevent test failures due to rate limits
- Allow rapid test iteration

### i18n Mocking
Translation functions return keys directly:
- Prevents missing translation warnings
- Simplifies test assertions
- Reduces noise in test output

## Adding New Tests

### Server-Side Test Example
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TestStorage } from './helpers';

describe('My New Feature', () => {
  let testStorage: TestStorage;

  beforeEach(() => {
    testStorage = new TestStorage();
    testStorage.clear();
  });

  it('should do something', async () => {
    // Arrange
    const data = await testStorage.createUser({ /* ... */ });
    
    // Act
    const result = await someFunction(data);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### Client-Side Test Example
```typescript
import { render, screen } from '@/__tests__/test-utils';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByTestId('my-element')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **Use fixtures**: Import test data from `tests/shared/fixtures.ts`
2. **Clean up**: Use `beforeEach` to reset storage state
3. **Mock external calls**: Never call real APIs in tests
4. **Test data-testid**: Use `data-testid` attributes for reliable element selection
5. **Async/await**: Always await async operations
6. **Descriptive names**: Use clear, descriptive test names

## CI/CD Integration

To add tests to CI/CD pipeline, add to your workflow:

```yaml
- name: Run tests
  run: npx vitest run

- name: Generate coverage
  run: npx vitest run --coverage
```

## Troubleshooting

### Tests not found
- Ensure files match pattern: `**/*.test.{ts,tsx}`
- Check vitest.config.ts includes/excludes

### Import errors
- Verify path aliases in vitest.config.ts
- Check that @, @shared, @server resolve correctly

### Async test failures
- Always use `async/await` or return promises
- Increase timeout for slow tests: `it('test', async () => { /* ... */ }, 10000)`

### Mock not working
- Ensure mock is called before importing module under test
- Check vi.mock() placement in setup files

## Future Enhancements

Potential areas for additional testing:
- E2E tests with Playwright/Cypress
- Visual regression tests for storybook pages
- Performance tests for story generation
- Load tests for API endpoints
- Integration tests with real database
- Frontend component unit tests
