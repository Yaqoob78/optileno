import '@testing-library/jest-dom';

if (!(globalThis as any).TextEncoder) {
  class TestTextEncoder {
    encode(input: string = ''): Uint8Array {
      const values = Array.from(input).map((char) => char.charCodeAt(0));
      return new Uint8Array(values);
    }
  }
  (globalThis as any).TextEncoder = TestTextEncoder;
}

if (!(globalThis as any).TextDecoder) {
  class TestTextDecoder {
    decode(input?: ArrayBuffer | ArrayBufferView | null): string {
      if (!input) return '';
      const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array((input as any).buffer);
      return String.fromCharCode(...Array.from(bytes));
    }
  }
  (globalThis as any).TextDecoder = TestTextDecoder;
}

// Mock Socket.IO
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Not implemented: HTMLFormElement.prototype.submit')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
