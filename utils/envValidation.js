/**
 * Environment variable validation
 * Run this early in application startup to fail fast on missing configuration
 */

/**
 * Validate URL format
 */
function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validate Supabase key format
 */
function isValidSupabaseKey(value) {
  // Supabase supports multiple key formats:
  // 1. JWT tokens (anon/service role): 3 parts separated by dots
  // 2. Secret keys: sb_secret_... format
  const isJWT = /^[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+$/.test(value);
  const isSecretKey = /^sb_[a-z]+_[A-Za-z0-9]+$/.test(value);
  return isJWT || isSecretKey || value.length >= 20; // Fallback: accept if long enough
}

/**
 * Required environment variables with descriptions
 * Note: SUPABASE_URL and SUPABASE_KEY are now optional (legacy/CLI support)
 * Auth uses NEXT_PUBLIC_AUTH_SUPABASE_URL and related vars
 */
const REQUIRED_ENV_VARS = {
  // Auth Supabase (central project for authentication)
  NEXT_PUBLIC_AUTH_SUPABASE_URL: {
    description: 'Central Supabase URL for authentication',
    validate: isValidUrl,
    errorMessage: 'Must be a valid URL (e.g., https://your-auth-project.supabase.co)',
  },
  NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: {
    description: 'Central Supabase anon key for client-side auth',
    validate: isValidSupabaseKey,
    errorMessage: 'Must be a valid Supabase key (JWT format)',
  },
  AUTH_SUPABASE_SERVICE_KEY: {
    description: 'Central Supabase service role key for server-side auth',
    validate: isValidSupabaseKey,
    errorMessage: 'Must be a valid Supabase service role key',
  },
  ENCRYPTION_KEY: {
    description: 'Encryption key for storing user API keys (32 bytes, hex or base64)',
    validate: (value) => {
      // Check hex format (64 chars = 32 bytes)
      if (/^[a-f0-9]+$/i.test(value) && value.length === 64) {
        return true;
      }
      // Check base64 format
      try {
        const decoded = Buffer.from(value, 'base64');
        return decoded.length === 32;
      } catch {
        return false;
      }
    },
    errorMessage: 'Must be 32 bytes (64 hex characters or 44 base64 characters)',
  },
};

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  // Legacy Supabase vars (for CLI tool backward compatibility)
  SUPABASE_URL: {
    description: 'Legacy Supabase project URL (for CLI tool)',
    validate: isValidUrl,
    errorMessage: 'Must be a valid URL',
  },
  SUPABASE_KEY: {
    description: 'Legacy Supabase service key (for CLI tool)',
    validate: isValidSupabaseKey,
    errorMessage: 'Must be a valid Supabase key',
  },
  SUPABASE_BUCKET: {
    description: 'Default storage bucket name',
    default: 'files',
  },
  MAX_RETRIES: {
    description: 'Maximum retry attempts for failed operations',
    default: '3',
    validate: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
    errorMessage: 'Must be a non-negative integer',
  },
  LOG_FILE: {
    description: 'Log file path',
    default: 'supabase-uploader.log',
  },
  ENABLE_LOGGING: {
    description: 'Enable file logging',
    default: 'true',
    validate: (value) => ['true', 'false', '1', '0'].includes(value.toLowerCase()),
    errorMessage: 'Must be true, false, 1, or 0',
  },
  NODE_ENV: {
    description: 'Node environment',
    default: 'development',
  },
};

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether all validations passed
 * @property {string[]} errors - List of validation errors
 * @property {string[]} warnings - List of validation warnings
 */

/**
 * Validate all environment variables
 * @returns {ValidationResult}
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Check required variables
  for (const [name, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[name];

    if (!value) {
      errors.push(`Missing required environment variable: ${name} - ${config.description}`);
      continue;
    }

    if (config.validate && !config.validate(value)) {
      errors.push(`Invalid ${name}: ${config.errorMessage}`);
    }
  }

  // Check optional variables
  for (const [name, config] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[name];

    if (!value) {
      // Set default if not provided
      if (config.default !== undefined) {
        process.env[name] = config.default;
      }
    } else if (config.validate && !config.validate(value)) {
      warnings.push(`Invalid ${name}: ${config.errorMessage}. Using default: ${config.default}`);
      if (config.default !== undefined) {
        process.env[name] = config.default;
      }
    }
  }

  // Additional security checks
  if (process.env.NODE_ENV === 'production') {
    // Warn if using development-like settings in production
    if (process.env.SUPABASE_URL?.includes('localhost')) {
      warnings.push('Using localhost Supabase URL in production environment');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment and exit if invalid (for use in server startup)
 * @param {boolean} exitOnError - Whether to exit the process on error
 */
export function validateEnvironmentOrExit(exitOnError = true) {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment warnings:');
    result.warnings.forEach(w => console.warn(`   - ${w}`));
  }

  if (!result.valid) {
    console.error('\n❌ Environment validation failed:');
    result.errors.forEach(e => console.error(`   - ${e}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');

    if (exitOnError) {
      process.exit(1);
    }
  } else if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Environment validation passed');
  }

  return result;
}

/**
 * Check if we're in a server-side context
 * @returns {boolean}
 */
export function isServerSide() {
  return typeof window === 'undefined';
}

/**
 * Get validated environment variable
 * @param {string} name - Environment variable name
 * @param {string} defaultValue - Default value if not set
 * @returns {string}
 */
export function getEnv(name, defaultValue = '') {
  return process.env[name] || defaultValue;
}

/**
 * Check if running in production
 * @returns {boolean}
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 * @returns {boolean}
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}
