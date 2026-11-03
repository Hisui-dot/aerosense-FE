const { z } = require('zod');

const readingSchema = z.object({
  pm25: z.number().nonnegative().finite(),
  voc: z.number().nonnegative().finite(),
  temperature: z.number().finite().optional(),
  humidity: z.number().min(0).max(100).optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
});

function parseReading(body) {
  const result = readingSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) };
}

// User validation schemas
const signupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  email: z.string().email('Please enter a valid email address').max(100, 'Email is too long'),
  name: z.string().max(50, 'Name is too long').optional(),
  role: z.enum(['admin', 'security', 'supervisor']).optional(),
});

function parseSignup(body) {
  const result = signupSchema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, message: result.error.issues[0].message };
}

module.exports = { readingSchema, parseReading, parseSignup };
