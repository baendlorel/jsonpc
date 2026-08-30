import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';

describe('parse complex JSON', () => {
  // Helper function to get comments for a property path
  function getComments(jpc: JSONPC, path: string): string[] | undefined {
    return jpc.get(path)?.comments;
  }

  describe('Complex nested structure with comments', () => {
    const complexJson = `
// Configuration file for application
// This file contains all the settings needed
// Last updated: 2024-01-15

{
  // Database connection settings
  // These are critical for the application to run
  "database": {
    // Connection string format
    "host": "localhost",
    "port": 5432,
    // SSL configuration
    "useSSL": true,
    "credentials": {
      "username": "admin",
      "password": "secret123",
    },
  },

  // API configuration section
  "api": {
    "endpoints": [
      {
        "path": "/api/users",
        "method": "GET",
        "rateLimit": 100,
      },
      {
        "path": "/api/auth",
        "method": "POST",
        "rateLimit": 50,
      },
      {
        "path": "/api/data",
        "method": "GET",
        "rateLimit": 200,
      },
    ],
    "timeout": 30000,
    "retries": 3,
  },

  // Feature flags
  "features": {
    "enableCache": true,
    "enableLogs": false,
    "betaFeatures": {
      "newUI": true,
      "advancedSearch": false,
    },
  },

  // UI preferences
  "ui": {
    "theme": "dark",
    "language": "en-US",
    "fontSize": 14,
  },
}

// End of configuration file
// Please review changes before deploying
`;

    it('should parse complex nested structure with all comment positions', () => {
      const jpc = new JSONPC(complexJson);

      // Test top-level comments
      const output = jpc.stringify();
      expect(output).toContain('// Configuration file for application');
      expect(output).toContain('// Last updated: 2024-01-15');

      // Test nested property comments
      expect(getComments(jpc, 'database')).toEqual([
        'Database connection settings',
        'These are critical for the application to run',
      ]);
      expect(getComments(jpc, 'database.host')).toEqual(['Connection string format']);
      expect(getComments(jpc, 'database.useSSL')).toEqual(['SSL configuration']);

      // Test array-related comments
      expect(getComments(jpc, 'api')).toEqual(['API configuration section']);
      expect(getComments(jpc, 'api.endpoints')).toBeUndefined(); // Arrays don't have direct comments

      // Test nested object comments
      expect(getComments(jpc, 'features')).toEqual(['Feature flags']);
      expect(getComments(jpc, 'ui')).toEqual(['UI preferences']);

      // Test bottom comments
      expect(output).toContain('// End of configuration file');
      expect(output).toContain('// Please review changes before deploying');
    });

    it('should correctly access nested values in complex structure', () => {
      const jpc = new JSONPC(complexJson);

      expect(jpc.get('database.host')?.value).toBe('localhost');
      expect(jpc.get('database.port')?.value).toBe(5432);
      expect(jpc.get('database.credentials.username')?.value).toBe('admin');

      expect(jpc.get('api.endpoints.0.path')?.value).toBe('/api/users');
      expect(jpc.get('api.endpoints.1.method')?.value).toBe('POST');
      expect(jpc.get('api.endpoints.2.rateLimit')?.value).toBe(200);

      expect(jpc.get('api.timeout')?.value).toBe(30000);
      expect(jpc.get('features.enableCache')?.value).toBe(true);
      expect(jpc.get('features.betaFeatures.newUI')?.value).toBe(true);

      expect(jpc.get('ui.theme')?.value).toBe('dark');
      expect(jpc.get('ui.fontSize')?.value).toBe(14);
    });

    it('should handle trailing commas in complex structure', () => {
      const jpc = new JSONPC(complexJson);
      const output = jpc.stringify();

      // The parser should handle trailing commas correctly
      expect(jpc.get('database')?.value).toBeDefined();
      expect(jpc.get('api')?.value).toBeDefined();
      expect(jpc.get('features')?.value).toBeDefined();
      expect(jpc.get('ui')?.value).toBeDefined();

      // Array should be parsed correctly with trailing commas
      expect(Array.isArray(jpc.get('api.endpoints')?.value)).toBe(true);
      expect(jpc.get('api.endpoints')?.value).toHaveLength(3);
    });

    it('should produce clean object from complex structure', () => {
      const jpc = new JSONPC(complexJson);
      const clean = jpc.toObject();

      expect(clean).toEqual({
        database: {
          host: 'localhost',
          port: 5432,
          useSSL: true,
          credentials: {
            username: 'admin',
            password: 'secret123',
          },
        },
        api: {
          endpoints: [
            { path: '/api/users', method: 'GET', rateLimit: 100 },
            { path: '/api/auth', method: 'POST', rateLimit: 50 },
            { path: '/api/data', method: 'GET', rateLimit: 200 },
          ],
          timeout: 30000,
          retries: 3,
        },
        features: {
          enableCache: true,
          enableLogs: false,
          betaFeatures: {
            newUI: true,
            advancedSearch: false,
          },
        },
        ui: {
          theme: 'dark',
          language: 'en-US',
          fontSize: 14,
        },
      });
    });
  });

  describe('Complex data types and arrays with comments', () => {
    const complexDataJson = `
// Data export from legacy system
// Generated: 2024-01-15T10:30:00Z
// Export ID: EXP-2024-001

{
  // User records with mixed data types
  "users": [
    // Administrator account
    {
      "id": 1,
      "username": "admin",
      "roles": ["admin", "superuser"],
      "active": true,
      "metadata": {
        "lastLogin": "2024-01-15T09:00:00Z",
        "loginCount": 150,
      },
    },
    // Regular user account
    {
      "id": 2,
      "username": "john_doe",
      "roles": ["user"],
      "active": true,
      "metadata": {
        "lastLogin": "2024-01-14T16:30:00Z",
        "loginCount": 45,
      },
    },
    // Suspended account
    {
      "id": 3,
      "username": "jane_smith",
      "roles": ["user"],
      "active": false,
      "metadata": {
        "lastLogin": "2023-12-01T08:15:00Z",
        "loginCount": 12,
      },
    },
  ],

  // System configuration settings
  "config": {
    "version": "2.1.0",
    "environment": "production",
    // Rate limiting configuration
    "rateLimits": {
      "global": 1000,
      "perUser": 100,
      "burst": 20,
    },
    // Feature toggles
    "features": [
      "authentication",
      "logging",
      "caching",
      "monitoring",
    ],
  },

  // Statistics and metrics
  "statistics": {
    "totalUsers": 1500,
    "activeUsers": 1200,
    "suspendedUsers": 300,
    "systemLoad": 0.75,
    "uptime": "99.9%",
  },

  // Empty sections for future expansion
  "futureFeatures": {
    "notifications": null,
    "integrations": [],
    "betaTesting": {},
  },
}

// End of export data
// Total records: 3 users
`;

    it('should parse complex array structures with various data types', () => {
      const jpc = new JSONPC(complexDataJson);

      // Test array structure parsing
      expect(Array.isArray(jpc.get('users')?.value)).toBe(true);
      expect(jpc.get('users')?.value).toHaveLength(3);

      // Test nested array access
      expect(jpc.get('users.0.username')?.value).toBe('admin');
      expect(jpc.get('users.0.roles')?.value).toEqual(['admin', 'superuser']);
      expect(jpc.get('users.1.id')?.value).toBe(2);
      expect(jpc.get('users.2.active')?.value).toBe(false);

      // Test nested object within array
      expect(jpc.get('users.0.metadata.lastLogin')?.value).toBe('2024-01-15T09:00:00Z');
      expect(jpc.get('users.1.metadata.loginCount')?.value).toBe(45);
    });

    it('should handle comments in complex array structure', () => {
      const jpc = new JSONPC(complexDataJson);
      const output = jpc.stringify();

      // Test top and bottom comments
      expect(output).toContain('// Data export from legacy system');
      expect(output).toContain('// Export ID: EXP-2024-001');
      expect(output).toContain('// End of export data');
      expect(output).toContain('// Total records: 3 users');

      // Test property comments
      expect(output).toContain('// User records with mixed data types');
      expect(output).toContain('// System configuration settings');
      expect(output).toContain('// Statistics and metrics');
    });

    it('should parse mixed data types and null values', () => {
      const jpc = new JSONPC(complexDataJson);

      // Test various data types
      expect(jpc.get('config.version')?.value).toBe('2.1.0');
      expect(jpc.get('config.environment')?.value).toBe('production');
      expect(jpc.get('statistics.systemLoad')?.value).toBe(0.75);
      expect(jpc.get('statistics.uptime')?.value).toBe('99.9%');

      // Test null and empty values
      expect(jpc.get('futureFeatures.notifications')?.value).toBeNull();
      expect(jpc.get('futureFeatures.integrations')?.value).toEqual([]);
      expect(jpc.get('futureFeatures.betaTesting')?.value).toEqual({});
    });

    it('should handle nested arrays and objects with trailing commas', () => {
      const jpc = new JSONPC(complexDataJson);

      // Test nested arrays
      expect(Array.isArray(jpc.get('config.features')?.value)).toBe(true);
      expect(jpc.get('config.features')?.value).toHaveLength(4);

      // Test nested objects with trailing commas
      expect(jpc.get('config.rateLimits.global')?.value).toBe(1000);
      expect(jpc.get('config.rateLimits.perUser')?.value).toBe(100);
      expect(jpc.get('config.rateLimits.burst')?.value).toBe(20);

      // Verify structure integrity
      const clean = jpc.toObject();
      expect(clean.users).toHaveLength(3);
      expect(clean.config.rateLimits).toEqual({
        global: 1000,
        perUser: 100,
        burst: 20,
      });
    });

    it('should preserve comment positions during round-trip', () => {
      const jpc = new JSONPC(complexDataJson);
      const output = jpc.stringify();

      // Create new instance from output to test round-trip
      const jpc2 = new JSONPC(output);
      const original = jpc.toObject();
      const roundTrip = jpc2.toObject();

      // Data should be identical
      expect(roundTrip).toEqual(original);

      // Comments should be preserved
      expect(output).toContain('// Administrator account');
      expect(output).toContain('// Regular user account');
      expect(output).toContain('// Suspended account');
      expect(output).toContain('// Rate limiting configuration');
      expect(output).toContain('// Feature toggles');
      expect(output).toContain('// Empty sections for future expansion');
    });
  });
});
